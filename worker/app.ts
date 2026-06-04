import { Hono } from "hono";
import handler from "../src/server.tsx";

const app = new Hono();

app.get("*", async (c) => {
  const response = await handler(c.req.url, c.req.raw.signal);

  if (response.body && response.headers.get("Content-Type")?.includes("text/html")) {
    const headers = new Headers(response.headers);
    headers.set("Cache-Control", "no-cache, no-transform");
    headers.set("X-Content-Type-Options", "nosniff");

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers
    });
  }

  return response;
});

export default app;
