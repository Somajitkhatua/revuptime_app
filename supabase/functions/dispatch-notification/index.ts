import { admin, json, cors, assertResult } from "../_shared/runtime.ts";
// Configure as an INSERT database webhook for alerts/work_orders, with a secret header.
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const secret = Deno.env.get("PUSH_WEBHOOK_SECRET");
  if (!secret || req.headers.get("x-webhook-secret") !== secret)
    return json({ error: "Unauthorized" }, 401);
  try {
    const event = await req.json();
    if (
      event.type !== "INSERT" ||
      !["alerts", "work_orders"].includes(event.table)
    )
      return json({ error: "Unsupported event" }, 400);
    const db = admin();
    const result = await db
      .from(event.table)
      .select("*")
      .eq("id", event.record?.id)
      .single();
    assertResult(result);
    const row = result.data;
    if (!row) throw new Error("Record unavailable.");
    const org = row.organization_id;
    const members = await db
      .from("organization_members")
      .select("user_id")
      .eq("organization_id", org)
      .eq("status", "active");
    assertResult(members);
    const ids = (members.data || []).map((m) => m.user_id);
    const profiles = await db
      .from("profiles")
      .select("id,push_token")
      .eq("status", "active")
      .in(
        "id",
        event.table === "work_orders" && row.assigned_to
          ? ids.filter((id) => id === row.assigned_to)
          : ids,
      );
    assertResult(profiles);
    const tokens = [...new Set((profiles.data || [])
      .filter(
        (p) =>
          p.push_token &&
          (event.table !== "work_orders" || p.id === row.assigned_to),
      )
      .map((p) => p.push_token))];
    if (!tokens.length) return json({ sent: 0 });
    const messages = tokens.map((to) => ({
      to,
      sound: "default",
      channelId: "alerts",
      title:
        event.table === "alerts"
          ? `${row.severity}: ${row.title}`
          : "Work order assigned",
      body:
        event.table === "alerts"
          ? row.description || row.title
          : `${row.work_order_number || "Work order"} · ${row.title}`,
      data:
        event.table === "alerts"
          ? { alert_id: row.id }
          : { work_order_id: row.id },
    }));
    const tickets = [];
    for (let i = 0; i < messages.length; i += 100) {
      const response = await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(Deno.env.get("EXPO_ACCESS_TOKEN")
            ? { Authorization: `Bearer ${Deno.env.get("EXPO_ACCESS_TOKEN")}` }
            : {}),
        },
        body: JSON.stringify(messages.slice(i, i + 100)),
        signal: AbortSignal.timeout(30000),
      });
      if (!response.ok) throw new Error("Expo push delivery request failed.");
      tickets.push(await response.json());
    }
    return json({ sent: messages.length, tickets });
  } catch (e) {
    console.error(e);
    return json({ error: (e as Error).message }, 500);
  }
});
