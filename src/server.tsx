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
const HTML_CLOSE_TAGS = "\n</body>\n</html>";

const escapeScriptJson = (json: string) => json.replace(/</g, "\\u003c");
const escapeTemplateContent = (html: string) =>
  html.replace(/<\/template/gi, "<\\/template");
const stripDocumentClose = (html: string) =>
  html.replace(/<\/body>\s*<\/html>\s*$/i, "");

type RouterContext = {
  serverUrl: string;
  navigate: (url: string) => void;
};

type RenderNode = Parameters<typeof renderToString>[0];

const createRouterContext = (url: string): RouterContext => ({
  serverUrl: url,
  navigate: () => {},
});

const withRouter = (routerContext: RouterContext, node: RenderNode) => (
  <RouterProvider value={routerContext}>{node}</RouterProvider>
);

const renderResolvedState = async (
  routerContext: RouterContext,
  state: SSRProps["states"][string]
) =>
  renderToString(
    withRouter(
      routerContext,
      <SSRData value={state.value} state="finished">
        {state.children}
      </SSRData>
    )
  );

const renderInitialDocument = async (
  routerContext: RouterContext,
  storage: SSRProps
) => {
  let initialHtml = await renderToString(
    withRouter(
      routerContext,
      <SSRProvider storage={storage}>
        <Layout />
      </SSRProvider>
    )
  );
  initialHtml = stripDocumentClose(initialHtml);

  const initialHtmlBytes = encoder.encode(initialHtml).byteLength;
  if (initialHtmlBytes < MIN_INITIAL_CHUNK_BYTES) {
    initialHtml += `\n<!--${" ".repeat(
      MIN_INITIAL_CHUNK_BYTES - initialHtmlBytes
    )}-->`;
  }

  return initialHtml;
};

const renderTemplate = (id: string, html: string) =>
  `<template for="${id}"><?start name="${id}">${escapeTemplateContent(html)}<?end></template>`;

const renderSSRDataScript = async (storage: SSRProps) => {
  const values: Record<string, unknown> = {};
  for (const [key, state] of Object.entries(storage.states)) {
    values[key] = await state.promise;
  }

  return `<script type="application/json" id="${SSR_DATA_NAME}">${escapeScriptJson(JSON.stringify(values))}</script>`;
};

const encoder = new TextEncoder();

const writeText = (writer: WritableStreamDefaultWriter<Uint8Array>, text: string) =>
  writer.write(encoder.encode(text));

const streamResolvedStates = async (
  writer: WritableStreamDefaultWriter<Uint8Array>,
  routerContext: RouterContext,
  storage: SSRProps,
  signal?: AbortSignal
) => {
  const processed = new Set<string>();
  while (processed.size < Object.keys(storage.states).length) {
    const batch = Object.entries(storage.states).filter(
      ([key]) => !processed.has(key)
    );

    await Promise.all(
      batch.map(async ([key, state]) => {
        processed.add(key);
        state.value = await state.promise;
        const html = await renderResolvedState(routerContext, state);
        if (!signal?.aborted) {
          await writeText(writer, renderTemplate(state.id, html));
        }
      })
    );
  }
};

const streamDocument = async (
  writer: WritableStreamDefaultWriter<Uint8Array>,
  routerContext: RouterContext,
  storage: SSRProps,
  initialHtml: string,
  signal?: AbortSignal
) => {
  await writeText(writer, initialHtml);
  await streamResolvedStates(writer, routerContext, storage, signal);

  if (!signal?.aborted) {
    await writeText(writer, await renderSSRDataScript(storage));
    await writeText(writer, HTML_CLOSE_TAGS);
  }
};

const handler = async (url: string, signal?: AbortSignal) => {
  const storage: SSRProps = { states: {}, nextId: 0 };
  const routerContext = createRouterContext(url);
  const initialHtml = await renderInitialDocument(routerContext, storage);
  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
  const writer = writable.getWriter();

  void (async () => {
    try {
      await streamDocument(writer, routerContext, storage, initialHtml, signal);
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
