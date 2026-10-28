import test from "node:test";
import assert from "node:assert/strict";
import {
  createOpenRouter,
  DEFAULT_MODEL,
  ULTRA_MODEL,
} from "../server/openrouter.mjs";
const answer = () =>
  Response.json({
    choices: [
      {
        message: {
          content: "A vibration sensor measures mechanical oscillation.",
        },
      },
    ],
    usage: { total_tokens: 30 },
  });

test("an unavailable default free model falls back to the alternate free model", async () => {
  const models = [];
  const run = createOpenRouter(
    { OPENROUTER_API_KEY: "server-test-key" },
    {
      pause: async () => {},
      sendFetch: async (url, options) => {
        assert.equal(url, "https://openrouter.ai/api/v1/chat/completions");
        models.push(JSON.parse(options.body).model);
        return models.length === 1
          ? Response.json(
              { error: { code: 404, message: "Provider returned error" } },
              { status: 404 },
            )
          : answer();
      },
    },
  );
  const result = await run([
    { role: "user", content: "What is a vibration sensor?" },
  ]);
  assert.deepEqual(models, [DEFAULT_MODEL, ULTRA_MODEL]);
  assert.equal(result.model, ULTRA_MODEL);
  assert.match(result.content, /mechanical oscillation/);
});

test("invalid credentials are actionable and never retried as a model outage", async () => {
  let calls = 0;
  const run = createOpenRouter(
    { OPENROUTER_API_KEY: "invalid" },
    {
      pause: async () => {},
      sendFetch: async () => {
        calls++;
        return Response.json({ error: { code: 401 } }, { status: 401 });
      },
    },
  );
  await assert.rejects(
    () => run([]),
    (error) => error.status === 503 && /credentials/.test(error.message),
  );
  assert.equal(calls, 1);
});

test("fallback cannot silently select a paid model, even when paid primary models are enabled", async () => {
  let calls = 0;
  const run = createOpenRouter(
    {
      OPENROUTER_API_KEY: "server-only",
      AI_ALLOW_PAID_MODELS: "true",
      OPENROUTER_FALLBACK_MODEL: "paid/model",
    },
    {
      sendFetch: async () => {
        calls++;
        return answer();
      },
    },
  );
  await assert.rejects(() => run([]), /fallback model must be a free model/);
  assert.equal(calls, 0);
});

test("provider error envelopes and exhausted capacity use a bounded free-only retry", async () => {
  const models = [];
  const run = createOpenRouter(
    { OPENROUTER_API_KEY: "test" },
    {
      pause: async () => {},
      sendFetch: async (url, options) => {
        models.push(JSON.parse(options.body).model);
        return Response.json({ error: { code: 429, message: "limited" } });
      },
    },
  );
  await assert.rejects(
    () => run([]),
    (error) => error.status === 429,
  );
  assert.equal(models.length, 2);
  assert.ok(models.every((model) => model.endsWith(":free")));
});

test("a stalled provider response can recover through the alternate model", async () => {
  let calls = 0;
  const run = createOpenRouter(
    { OPENROUTER_API_KEY: "test" },
    {
      pause: async () => {},
      sendFetch: async () => {
        if (++calls === 1)
          throw Object.assign(new Error("timeout"), { name: "TimeoutError" });
        return answer();
      },
    },
  );
  assert.equal((await run([])).model, ULTRA_MODEL);
  assert.equal(calls, 2);
});
