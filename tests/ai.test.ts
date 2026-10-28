import { test } from "node:test";
import assert from "node:assert/strict";
import {
  calculateMeasurements,
  finiteValue,
  validateDraft,
  thresholdIndicators,
} from "../supabase/functions/_shared/machineEvidence";
import { createHandler } from "../supabase/functions/_shared/assistantHandler";
const asset = "10000000-0000-4000-8000-000000000001",
  user = "10000000-0000-4000-8000-000000000002",
  session = "10000000-0000-4000-8000-000000000003";
test("trends separate sensor identities and units, reject missing/invalid measurements and preserve zero", () => {
  const row = (
    id: string,
    value: unknown,
    unit = "mm/s",
    timestamp = "2026-10-13T10:00:00Z",
  ) => ({
    sensor_id: id,
    value,
    unit,
    timestamp,
    quality: "good",
    metadata: { metric: "x_rms" },
  });
  const result = calculateMeasurements([
    row("a", 2),
    row("a", 4, "mm/s", "2026-10-13T11:00:00Z"),
    row("b", 9),
    row("a", 3, "g"),
    row("a", null),
    row("a", ""),
    row("z", 0),
    { ...row("a", 99), quality: "bad" },
  ]);
  assert.equal(result.length, 4);
  const a = result.find((r) => r.sensor_id === "a" && r.unit === "mm/s")!;
  assert.equal(a.average, 3);
  assert.equal(a.change_percent, 100);
  assert.equal(a.count, 2);
  assert.equal(result.find((r) => r.sensor_id === "z")!.latest.value, 0);
  assert.equal(finiteValue(null), undefined);
  assert.equal(finiteValue("   "), undefined);
  const indicators = thresholdIndicators(result, [
    {
      id: "r",
      condition: { metric: "x_rms", operator: ">", threshold: 3, unit: "mm/s" },
      sensor_id: "a",
    },
    { id: "unsupported", condition: { threshold: 1 } },
  ]);
  assert.equal(indicators.length, 1);
  assert.equal(indicators[0].exceeded, true);
  assert.throws(() =>
    validateDraft({ title: "T", description: "D", priority: "urgent" }),
  );
});
function fixture(
  options: {
    key?: boolean;
    allowed?: boolean;
    role?: string;
    status?: number;
    draft?: boolean;
    rate?: number;
    sessionAllowed?: boolean;
    network?: boolean;
    bodyHang?: boolean;
    manual?: boolean;
    badCitation?: boolean;
  } = {},
) {
  let calls = 0;
  const writes: any[] = [];
  const db = {
    rpc: async () => ({ data: [{ document_id: "manual-1", page_number: 2, content: "The mounting torque is 12 Nm." }] }),
    auth: {
      getUser: async () => ({
        data: { user: { id: user, email_confirmed_at: "2026-10-13" } },
      }),
    },
    from: (table: string) => {
      let inserted: any,
        head = false;
      const result = () => {
        if (table === "assets")
          return {
            data:
              options.allowed === false
                ? null
                : {
                    id: asset,
                    organization_id: "org",
                    site_id: "site",
                    name: "Test Motor",
                  },
          };
        if (table === "organization_members")
          return { data: { role: options.role || "owner" } };
        if (table === "chat_sessions")
          return {
            data: options.sessionAllowed === false ? null : { id: session },
          };
        if (table === "chat_messages")
          return {
            data: inserted
              ? inserted.map((m: any, i: number) => ({
                  ...m,
                  id: `message-${i}`,
                  created_at: new Date().toISOString(),
                }))
              : [],
            count: head ? options.rate || 0 : 0,
          };
        if (table === "sensor_readings")
          return {
            data: [
              {
                sensor_id: "s",
                timestamp: new Date().toISOString(),
                value: 4.2,
                unit: "mm/s",
                metadata: { metric: "x_rms" },
              },
            ],
            count: 1,
          };
        if (table === "asset_documents" && options.manual)
          return { data: [{ id: "manual-1", name: "Verified Manual", metadata: { status: "Ready for AI" } }] };
        return { data: [] };
      };
      const q: any = {
        then: (resolve: any, reject: any) =>
          Promise.resolve(result()).then(resolve, reject),
        select: (_: unknown, args?: any) => {
          head = !!args?.head;
          return q;
        },
        eq: () => q,
        in: () => q,
        gte: () => q,
        order: () => q,
        limit: () => q,
        maybeSingle: () => q,
        single: () => q,
        insert: (v: any) => {
          inserted = v;
          writes.push({ table, value: v });
          return q;
        },
      };
      return q;
    },
  };
  const handler = createHandler({
    providerTimeoutMs: options.bodyHang ? 20 : 60000,
    createClient: () => db,
    env: (k) =>
      k === "OPENROUTER_API_KEY"
        ? options.key === false
          ? undefined
          : "test-server-only-key"
        : "test",
    fetch: async (_url, init) => {
      calls++;
      const request = JSON.parse(init!.body as string);
      assert.equal(request.model, "test");
      assert.match(request.messages[0].content, /4.2/);
      if (options.network) throw new Error("offline");
      if (options.bodyHang)
        return new Response(
          new ReadableStream({
            start(controller) {
              init?.signal?.addEventListener(
                "abort",
                () =>
                  controller.error(new DOMException("Aborted", "AbortError")),
                { once: true },
              );
            },
          }),
          { status: 200 },
        );
      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: options.draft
                  ? JSON.stringify({
                      title: "Inspect mounting",
                      description: "Review 4.2 mm/s recorded measurement.",
                      priority: "Medium",
                    })
                  : options.badCitation ? "Use 12 Nm [Verified Manual, page 99]" : options.manual ? "Use 12 Nm [Verified Manual, page 2]" : "## Inspection\nReview the recorded 4.2 mm/s reading.",
              },
            },
          ],
          usage: { total_tokens: 12 },
        }),
        { status: options.status || 200 },
      );
    },
  });
  const send = (action: string | undefined = "chat", extra: any = {}) =>
    handler(
      new Request("http://test/ai", {
        method: "POST",
        headers: {
          Authorization: "Bearer test",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          asset_id: asset,
          question: "What should I inspect?",
          action,
          ...extra,
        }),
      }),
    );
  return {
    send,
    handler,
    writes,
    get calls() {
      return calls;
    },
  };
}
test("machine insights remain available without a provider key; chat reports configuration failure", async () => {
  const f = fixture({ key: false });
  let r = await f.send("insights");
  assert.equal(r.status, 200);
  const data = await r.json();
  assert.equal(data.provider_configured, false);
  assert.equal(data.measurements[0].latest.value, 4.2);
  assert.equal(data.rag.available, false);
  r = await f.send();
  assert.equal(r.status, 503);
  assert.equal(f.calls, 0);
  assert.equal(f.writes.length, 0);
});
test("manual requests report unavailable retrieval and never fabricate citations", async () => {
  const f = fixture();
  const r = await f.send("chat", {
    question: "What does the OEM manual recommend?",
  });
  assert.equal(r.status, 200);
  const answer = await r.json();
  assert.match(answer.content, /could not find a verified manual passage/);
  assert.deepEqual(answer.citations, []);
  assert.equal(f.calls, 0);
});
test("manual answers include only retrieved page evidence and reject invented references", async () => {
  const f = fixture({ manual: true });
  const r = await f.send("chat", { question: "What torque does the OEM manual recommend?" });
  assert.equal(r.status, 200);
  const answer = await r.json();
  assert.equal(f.calls, 1);
  assert.match(answer.content, /Verified Manual, page 2/);
  assert.equal(answer.evidence.find((e: any) => e.kind === "OEM/RAG evidence").sources[0].page, 2);
  const invalid = fixture({ manual: true, badCitation: true });
  assert.equal((await invalid.send()).status, 502);
  assert.equal(invalid.writes.length, 0);
});
test("unauthenticated, foreign-machine and foreign-conversation requests never reach provider", async () => {
  const f = fixture();
  assert.equal(
    (await f.handler(new Request("http://test/ai", { method: "POST" }))).status,
    401,
  );
  const foreign = fixture({ allowed: false });
  assert.equal((await foreign.send()).status, 404);
  assert.equal(foreign.calls, 0);
  const sessionOther = fixture({ sessionAllowed: false });
  assert.equal(
    (await sessionOther.send("chat", { session_id: session })).status,
    404,
  );
  assert.equal(sessionOther.calls, 0);
});
test("provider failures and limits do not save a successful conversation", async () => {
  for (const opts of [{ status: 429 }, { network: true }, { rate: 10 }]) {
    const f = fixture(opts);
    const r = await f.send();
    assert.ok([429, 504].includes(r.status));
    assert.equal(f.writes.length, 0);
  }
});
test("a provider that returns headers but stalls its body has a bounded deadline", async () => {
  const f = fixture({ bodyHang: true });
  const r = await f.send();
  assert.equal(r.status, 504);
  assert.equal(f.writes.length, 0);
});
test("draft is reviewed separately and creates no work-order database writes", async () => {
  const f = fixture({ draft: true });
  const r = await f.send("draft");
  assert.equal(r.status, 200);
  const d = await r.json();
  assert.equal(d.draft.priority, "Medium");
  assert.equal(d.session_id, session);
  assert.ok(
    f.writes.every((w) => ["chat_messages", "chat_sessions"].includes(w.table)),
  );
  const viewer = fixture({ role: "viewer" });
  assert.equal((await viewer.send("draft")).status, 403);
  assert.equal(viewer.calls, 0);
});
