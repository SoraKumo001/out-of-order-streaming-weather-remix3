import { createRoot } from "remix/ui";
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

const render = () => {
  const ssrData = document.getElementById("__REMIX3_SSR__")?.textContent;
  if (ssrData) {
    Object.defineProperty(globalThis, "__REMIX3_SSR_DATA__", {
      value: ssrData,
      configurable: true,
    });
  }
  document.body.replaceChildren();
  createRoot(document.body).render(Render);
};

if (document.body) {
  render();
} else {
  window.addEventListener(
    "DOMContentLoaded",
    () => {
      render();
    },
    { once: true }
  );
}

if (import.meta.hot) {
  import.meta.hot.accept(() => {});
}
