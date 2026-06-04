import type { Handle } from "remix/ui";
import { App } from "./App";
import css from "./index.css?inline";

export function Layout(_handle: Handle) {
  return () => (
    <html lang="ja">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <style type="text/css">{css}</style>
        <script
          type="module"
          src={
            /\.(tsx|ts)$/.test(import.meta.url)
              ? "/src/client.tsx"
              : "/client.js"
          }
        />
        <title>Remix 3 + Declarative Partial Updates</title>
      </head>
      <body class="bg-gray-100 text-gray-900 font-sans min-h-screen">
        <App />
      </body>
    </html>
  );
}
