import { createRoot } from "@remix-run/ui";
import { App } from "./App";
import { SSRProvider } from "./provider/SSRProvider";
import { RouterProvider } from "./provider/RouterProvider";

const Render = (
  <RouterProvider>
    <SSRProvider>
      <App />
    </SSRProvider>
  </RouterProvider>
);

const removeNode = (node: Node) => {
  node.parentNode?.removeChild(node);
};

const clearNode = (node: Node) => {
  while (node.firstChild) {
    node.removeChild(node.firstChild);
  }
};

const prepareDPUContentForClientRender = (container: HTMLElement) => {
  container.querySelectorAll("[data-ssr-frame]").forEach(clearNode);
  document.querySelectorAll("template[for]").forEach((node) => node.remove());

  const markers: Node[] = [];
  const walker = document.createTreeWalker(
    container,
    NodeFilter.SHOW_COMMENT | NodeFilter.SHOW_PROCESSING_INSTRUCTION,
  );

  while (walker.nextNode()) {
    const node = walker.currentNode;
    const data =
      node instanceof Comment ||
      node.nodeType === Node.PROCESSING_INSTRUCTION_NODE
        ? (node.nodeValue?.trim() ?? "")
        : "";

    if (
      data.startsWith("?start") ||
      data.startsWith("?end") ||
      data.startsWith("start ") ||
      data === "end"
    ) {
      markers.push(node);
    }
  }

  markers.forEach(removeNode);
};

const render = () => {
  const container = document.getElementById("app");
  if (!container) return;

  const ssrData = document.getElementById("__REMIX3_SSR__")?.textContent;
  if (ssrData) {
    Object.defineProperty(globalThis, "__REMIX3_SSR_DATA__", {
      value: ssrData,
      configurable: true,
    });
  }
  prepareDPUContentForClientRender(container);
  createRoot(container).render(Render);
};

if (document.body) {
  render();
} else {
  window.addEventListener(
    "DOMContentLoaded",
    () => {
      render();
    },
    { once: true },
  );
}

if (import.meta.hot) {
  import.meta.hot.accept(() => {});
}
