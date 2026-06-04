import { Hono } from "hono";
import handler from "../src/server.tsx";

const app = new Hono();

// Declarative Partial Updates (DPU) 形式へ変換する TransformStream
function createDPUTransformStream() {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = "";

  return new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      // チャンクをデコードしてバッファへ蓄積
      buffer += decoder.decode(chunk, { stream: true });

      // 1. Remix 3 のプレースホルダーコメント <!-- rmx:f:id --> を <?start name="id"> に置換
      buffer = buffer.replace(/<!--\s*rmx:f:([a-zA-Z0-9_-]+)\s*-->/g, '<?start name="$1">');

      // 2. 終了コメント <!-- /rmx:f --> を <?end> に置換
      buffer = buffer.replace(/<!--\s*\/rmx:f\s*-->/g, '<?end>');

      // 3. 後から流れる <template id="id">...</template> を <template for="id"><?start name="id">...<?end></template> に置換
      // ※ DPU での複数回置換に対応するため、置換後の中身にも <?start> と <?end> を再埋め込みします。
      const templateRegex = /<template\s+id="([a-zA-Z0-9_-]+)">([\s\S]*?)<\/template>/g;
      buffer = buffer.replace(templateRegex, (match, id, content) => {
        const unescapedContent = content.replace(/<\\\/template/gi, '</template');
        return `<template for="${id}"><?start name="${id}">${unescapedContent}<?end></template>`;
      });

      // 4. </body> と </html> を一時的に削除し、ストリーム末尾の flush まで遅延させる
      buffer = buffer.replace(/<\/body>/gi, '');
      buffer = buffer.replace(/<\/html>/gi, '');

      // チャンクの切れ目でタグが分断されるのを避けるため、最後の `<` より手前までを出力バッファにする
      const lastBracket = buffer.lastIndexOf("<");
      if (lastBracket !== -1 && lastBracket > buffer.length - 20) {
        const chunkText = buffer.slice(0, lastBracket);
        if (chunkText) {
          controller.enqueue(encoder.encode(chunkText));
          buffer = buffer.slice(lastBracket);
        }
      } else {
        if (buffer) {
          controller.enqueue(encoder.encode(buffer));
          buffer = "";
        }
      }
    },
    flush(controller) {
      buffer += decoder.decode();
      // 残りのバッファを置換
      buffer = buffer.replace(/<!--\s*rmx:f:([a-zA-Z0-9_-]+)\s*-->/g, '<?start name="$1">');
      buffer = buffer.replace(/<!--\s*\/rmx:f\s*-->/g, '<?end>');
      buffer = buffer.replace(/<template\s+id="([a-zA-Z0-9_-]+)">([\s\S]*?)<\/template>/g, (match, id, content) => {
        const unescapedContent = content.replace(/<\\\/template/gi, '</template');
        return `<template for="${id}"><?start name="${id}">${unescapedContent}<?end></template>`;
      });
      buffer = buffer.replace(/<\/body>/gi, '');
      buffer = buffer.replace(/<\/html>/gi, '');

      // 最後に </body> と </html> を付け足してクローズする
      buffer += "\n</body>\n</html>";

      if (buffer) {
        controller.enqueue(encoder.encode(buffer));
      }
    }
  });
}

app.get("*", async (c) => {
  const response = await handler(c.req.url);

  // HTML ストリームのときだけ DPU 変換処理を実行
  if (response.body && response.headers.get("Content-Type")?.includes("text/html")) {
    const transformedBody = response.body.pipeThrough(createDPUTransformStream());

    // ヘッダーをコピーし、ストリーミング部分更新用のキャッシュヘッダーを設定
    const headers = new Headers(response.headers);
    headers.set("Cache-Control", "no-cache, no-transform");
    headers.set("X-Content-Type-Options", "nosniff");

    return new Response(transformedBody, {
      status: response.status,
      statusText: response.statusText,
      headers
    });
  }

  return response;
});

export default app;
