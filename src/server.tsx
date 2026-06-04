import { renderToString } from "@remix-run/ui/server";
import { Layout } from "./root";
import {
  SSRData,
  SSRProvider,
  type SSRProps,
} from "./provider/SSRProvider";
import { RouterProvider } from "./provider/RouterProvider";

const SSR_DATA_NAME = "__REMIX3_SSR__";
const MIN_INITIAL_CHUNK_BYTES = 17 * 1024;

const escapeScriptJson = (json: string) => json.replace(/</g, "\\u003c");
const escapeTemplateContent = (html: string) =>
  html.replace(/<\/template/gi, "<\\/template");

const handler = async (url: string, signal?: AbortSignal) => {
  const storage: SSRProps = { states: {}, nextId: 0 };
  const routerContext = {
    serverUrl: url,
    navigate: () => {},
  };
  const encoder = new TextEncoder();

  const renderWithRouter = (node: Parameters<typeof renderToString>[0]) =>
    renderToString(
      <RouterProvider value={routerContext}>
        {node}
      </RouterProvider>
    );

  let initialHtml = await renderToString(
    <RouterProvider value={routerContext}>
      <SSRProvider storage={storage}>
        <Layout />
      </SSRProvider>
    </RouterProvider>
  );
  initialHtml = initialHtml.replace(/<\/body>\s*<\/html>\s*$/i, "");
  const initialHtmlBytes = encoder.encode(initialHtml).byteLength;
  if (initialHtmlBytes < MIN_INITIAL_CHUNK_BYTES) {
    initialHtml += `\n<!--${" ".repeat(
      MIN_INITIAL_CHUNK_BYTES - initialHtmlBytes
    )}-->`;
  }

  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
  const writer = writable.getWriter();

  void (async () => {
    try {
      await writer.write(encoder.encode(initialHtml));

      const processed = new Set<string>();
      while (processed.size < Object.keys(storage.states).length) {
        const batch = Object.entries(storage.states).filter(
          ([key]) => !processed.has(key)
        );

        await Promise.all(
          batch.map(async ([key, state]) => {
            processed.add(key);
            const value = await state.promise;
            state.value = value;
            const html = await renderWithRouter(
              <SSRData value={value} state="finished">
                {state.children}
              </SSRData>
            );
            if (signal?.aborted) return;
            await writer.write(
              encoder.encode(
                `<template for="${state.id}"><?start name="${state.id}">${escapeTemplateContent(html)}<?end></template>`
              )
            );
          })
        );
      }

      const values: Record<string, unknown> = {};
      for (const [key, state] of Object.entries(storage.states)) {
        values[key] = await state.promise;
      }

      if (!signal?.aborted) {
        await writer.write(
          encoder.encode(
            `<script type="application/json" id="${SSR_DATA_NAME}">${escapeScriptJson(JSON.stringify(values))}</script>`
          )
        );
        await writer.write(encoder.encode("\n</body>\n</html>"));
      }
      await writer.close();
    } catch (error) {
      console.error(error);
      await writer.abort(error);
    }
  })();

  return new Response(readable, {
    headers: {
      "Content-Encoding": "identity",
      "Content-Type": "text/html; charset=utf-8",
    },
  });
};

export default handler;
