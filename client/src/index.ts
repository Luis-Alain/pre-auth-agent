import { serve } from "bun";
import index from "./index.html";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:3001";

async function proxyApi(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const target = new URL(BACKEND_URL);
  target.pathname = url.pathname;
  target.search = url.search;
  const headers = new Headers(req.headers);
  headers.delete("host");
  const res = await fetch(target, {
    method: req.method,
    headers,
    body: req.method === "GET" || req.method === "HEAD" ? undefined : await req.arrayBuffer(),
  });
  return new Response(res.body, { status: res.status, headers: res.headers });
}

const server = serve({
  routes: {
    "/health": {
      GET: () => Response.json({ status: "ok" }),
    },
    // Proxy API calls to the Express backend (same-origin in the browser).
    "/api/:path*": (req) => proxyApi(req),
    // Serve index.html for all unmatched routes.
    "/*": index,
  },

  development: process.env.NODE_ENV !== "production" && {
    // Enable browser hot reloading in development
    hmr: true,

    // Echo console logs from the browser to the server
    console: true,
  },
});

console.log(`🚀 Server running at ${server.url}`);
