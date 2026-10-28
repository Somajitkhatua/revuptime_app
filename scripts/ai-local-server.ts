import { createServer } from "node:http";
import { createClient } from "@supabase/supabase-js";
import { createHandler } from "../supabase/functions/_shared/assistantHandler.ts";

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const publicKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (!url || !publicKey)
  throw new Error(
    "Configure the existing Supabase URL and publishable key in .env.",
  );
const env = (name: string) =>
  name === "SUPABASE_URL"
    ? url
    : name === "SUPABASE_ANON_KEY"
      ? publicKey
      : process.env[name];
const handler = createHandler({ createClient, env });
const host = process.env.AI_LOCAL_HOST || "127.0.0.1",
  port = Number(process.env.AI_LOCAL_PORT || 8787);
const server = createServer(async (req, res) => {
  try {
    const path = new URL(req.url || "/", `http://localhost:${port}`).pathname;
    if (path === "/health" && req.method === "GET") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          status: "ok",
          provider_configured: !!process.env.OPENROUTER_API_KEY,
          model: process.env.OPENROUTER_MODEL || "nvidia/nemotron-3-ultra-550b-a55b:free",
        }),
      );
      return;
    }
    if (!["/asset-summary", "/asset-ai"].includes(path)) {
      res.writeHead(404);
      res.end();
      return;
    }
    let size = 0;
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      size += chunk.length;
      if (size > 16384) {
        res.writeHead(413);
        res.end();
        return;
      }
      chunks.push(Buffer.from(chunk));
    }
    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers))
      if (value)
        headers.set(key, Array.isArray(value) ? value.join(",") : value);
    const request = new Request(`http://localhost:${port}${path}`, {
      method: req.method,
      headers,
      ...(["GET", "HEAD"].includes(req.method || "GET")
        ? {}
        : { body: Buffer.concat(chunks).toString("utf8") }),
    });
    const response = await handler(request);
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(Buffer.from(await response.arrayBuffer()));
  } catch (error) {
    console.error("Local assistant transport error:", error instanceof Error ? error.stack : "Unknown error");
    if (!res.headersSent)
      res.writeHead(500, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        error: "Local assistant request failed. Please retry.",
      }),
    );
  }
});
server.on("error", () => {
  console.error(
    "Unable to start local AI server. Check the port and configuration.",
  );
  process.exitCode = 1;
});
server.listen(port, host, () => {
  console.log(`RevUpTime local AI: http://${host}:${port}`);
  console.log(
    `Provider key configured: ${!!process.env.OPENROUTER_API_KEY}. Supabase authentication is required.`,
  );
});
