const { getDefaultConfig } = require("expo/metro-config");
const http = require("node:http");
const https = require("node:https");

const config = getDefaultConfig(__dirname);
// Playwright creates and removes these folders while Metro is watching.
const ignored = /[\\/](test-results|playwright-report|output|\.git)[\\/].*/;
config.resolver.blockList = [...(Array.isArray(config.resolver.blockList) ? config.resolver.blockList : config.resolver.blockList ? [config.resolver.blockList] : []), ignored];
const enhanceMiddleware = config.server.enhanceMiddleware;
config.server.enhanceMiddleware = (middleware, server) => {
  const next = enhanceMiddleware ? enhanceMiddleware(middleware, server) : middleware;
  return (req, res, done) => {
    const pathname = req.url?.split("?")[0];
    if (pathname?.startsWith("/api/rag/")) {
      const target = new URL(process.env.EXPO_PUBLIC_RAG_API_URL || "https://app.revuptime.com");
      const transport = target.protocol === "https:" ? https : http;
      const upstream = transport.request({
        hostname: target.hostname, port: target.port || undefined,
        path: target.pathname.replace(/\/$/, "") + pathname.replace("/api/rag/", "/api/ai/"),
        method: req.method, headers: { ...req.headers, host: target.host },
      }, response => { res.writeHead(response.statusCode || 502, response.headers); response.pipe(res); });
      upstream.on("error", () => {
        if (!res.headersSent) { res.writeHead(503, { "Content-Type": "application/json" }); res.end(JSON.stringify({ error: "Cannot reach the workspace server. Check your connection and retry." })); }
        else res.destroy();
      });
      req.on("aborted", () => upstream.destroy());
      res.on("close", () => { if (!res.writableFinished) upstream.destroy(); });
      req.pipe(upstream);
      return;
    }
    if (!/^\/api\/local-ai\/(asset-summary|asset-ai)$/.test(pathname || ""))
      return next(req, res, done);
    const upstream = http.request({
      hostname: "127.0.0.1",
      port: 8787,
      path: pathname.replace("/api/local-ai", ""),
      method: req.method,
      headers: { ...req.headers, host: "127.0.0.1:8787" },
    }, (response) => {
      res.writeHead(response.statusCode || 502, response.headers);
      response.pipe(res);
    });
    upstream.on("error", () => {
      if (!res.headersSent) {
        res.writeHead(503, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "The local AI backend is offline. Start npm run dev and retry." }));
      } else res.destroy();
    });
    req.on("aborted", () => upstream.destroy());
    res.on("close", () => { if (!res.writableFinished) upstream.destroy(); });
    req.pipe(upstream);
  };
};
module.exports = config;
