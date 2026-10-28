import { createHandler } from "../supabase/functions/_shared/assistantHandler.ts";
const id = "10000000-0000-4000-8000-000000000001";
const db: any = {
  auth: {
    getUser: async () => ({
      data: { user: { id, email_confirmed_at: "2026-10-15" } },
    }),
  },
  from: (table: string) => {
    let inserted: any;
    const result = () => {
      if (table === "assets")
        return {
          data: {
            id,
            organization_id: "synthetic-org",
            site_id: "synthetic-site",
            name: "Synthetic test motor",
          },
        };
      if (table === "organization_members") return { data: { role: "owner" } };
      if (table === "chat_sessions") return { data: { id } };
      if (table === "chat_messages")
        return {
          data: inserted
            ? inserted.map((m: any, i: number) => ({ ...m, id: String(i) }))
            : [],
          count: 0,
        };
      return { data: [], count: 0 };
    };
    const q: any = {
      then: (resolve: any, reject: any) =>
        Promise.resolve(result()).then(resolve, reject),
      select: () => q,
      eq: () => q,
      in: () => q,
      gte: () => q,
      order: () => q,
      limit: () => q,
      single: () => q,
      maybeSingle: () => q,
      insert: (value: any) => {
        inserted = value;
        return q;
      },
    };
    return q;
  },
};
async function main() {
  const started = Date.now();
  const handler = createHandler({
    createClient: () => db,
    env: (name) => process.env[name],
    fetch: async (input, init) => {
      console.log("Synthetic provider request started.");
      const r = await fetch(input, init);
      console.log("Synthetic provider response headers:", r.status);
      return r;
    },
  });
  const r = await handler(
    new Request("http://synthetic-test/ai", {
      method: "POST",
      headers: {
        Authorization: "Bearer synthetic-session",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        asset_id: id,
        action: "chat",
        question:
          "Check available machine data and clearly say if readings are missing.",
      }),
    }),
  );
  const result = await r.json();
  console.log(
    JSON.stringify({
      check: "synthetic-full-handler",
      status: r.status,
      elapsedMs: Date.now() - started,
      hasAnswer: typeof result.content === "string",
      error: result.error,
    }),
  );
}
const keepAlive = setInterval(() => {}, 1000);
main()
  .finally(() => clearInterval(keepAlive))
  .catch(() => {
    console.error("Synthetic verification failed.");
    process.exitCode = 1;
  });
