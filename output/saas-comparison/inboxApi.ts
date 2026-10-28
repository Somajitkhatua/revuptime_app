import { authorizedDataClient, type Row } from "../data";
import { isMissingRelation } from "./pointsApi";

const db = () => authorizedDataClient();
export {
  WINDOW_MS,
  fillTemplate,
  windowLabel,
  windowLeftMs,
} from "./waWindow.ts";

export async function loadInbox(orgId: string) {
  const c = db();
  const [accounts, conversations, templates, contacts, support, org] =
    await Promise.all([
      // The organisation's own number if it has one, and the shared RevUptime number.
      c
        .from("wa_accounts")
        .select("*")
        .or(`organization_id.eq.${orgId},is_shared.eq.true`)
        .order("created_at"),
      c
        .from("wa_conversations")
        .select("*")
        .eq("organization_id", orgId)
        .order("last_message_at", { ascending: false, nullsFirst: false })
        .limit(300),
      c.from("wa_templates").select("*").eq("status", "APPROVED").order("name"),
      c
        .from("site_contacts")
        .select(
          "id, site_id, name, role, whatsapp, whatsapp_opt_in, whatsapp_opt_in_at, whatsapp_opt_in_source, language",
        )
        .eq("organization_id", orgId)
        .order("name"),
      c
        .from("support_requests")
        .select("id, conversation_id")
        .eq("organization_id", orgId)
        .eq("status", "open"),
      c
        .from("organizations")
        .select("digest_hour")
        .eq("id", orgId)
        .maybeSingle(),
    ]);
  if (isMissingRelation(accounts.error)) return null;
  for (const r of [accounts, conversations, templates])
    if (r.error) throw new Error(r.error.message);
  return {
    accounts: accounts.data || [],
    conversations: conversations.data || [],
    templates: templates.data || [],
    contacts: contacts.data || [],
    support: support.error ? [] : support.data || [],
    digestHour: (org.data as Row | null)?.digest_hour ?? 8,
  };
}
export async function loadThread(conversationId: string) {
  const { data, error } = await db()
    .from("wa_messages")
    .select(
      "id, conversation_id, wamid, direction, type, kind, body, media_path, media_mime, template_name, status, sender_type, sender_user_id, source, error, error_code, created_at, alert_id, payload, is_test:raw->test",
    )
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(1000);
  if (error) throw new Error(error.message);
  return data || [];
}
/** Alerts referenced by a thread (and the chat's linked alert) with their point names, and its open support requests. */
export async function loadThreadContext(
  conversationId: string,
  alertIds: string[],
) {
  const c = db();
  const [alerts, support] = await Promise.all([
    alertIds.length
      ? c
          .from("alerts")
          .select(
            "id, title, severity, status, value, threshold, unit, detected_at, last_value_at, evidence, asset_id, point_id, gateway_id, site_id, alert_rule_id, work_order_id, acknowledged_at, acknowledged_via, acknowledged_by_contact, notify_status, notify_error",
          )
          .in("id", alertIds)
      : Promise.resolve({ data: [], error: null }),
    c
      .from("support_requests")
      .select("id, alert_id, contact_name, status, email_status, created_at")
      .eq("conversation_id", conversationId)
      .eq("status", "open")
      .order("created_at", { ascending: false }),
  ]);
  const list = (alerts.data || []) as Row[];
  const pointIds = [...new Set(list.map((a) => a.point_id).filter(Boolean))];
  const points = pointIds.length
    ? (await c.from("measurement_points").select("id, name").in("id", pointIds))
        .data || []
    : [];
  return {
    alerts: list,
    points: points as Row[],
    support: (support.data || []) as Row[],
  };
}
/** Worst point status per machine (act, watch, offline, good) for the context pane. */
export async function machineStatuses(orgId: string, assetIds: string[]) {
  if (!assetIds.length) return {} as Record<string, string>;
  const { data } = await db()
    .from("point_vitals")
    .select("asset_id, status")
    .eq("organization_id", orgId)
    .in("asset_id", assetIds);
  const rank: Record<string, number> = {
    act: 4,
    watch: 3,
    offline: 2,
    no_data: 2,
    good: 1,
  };
  const out: Record<string, string> = {};
  for (const r of (data || []) as Row[]) {
    const st = r.status === "no_data" ? "offline" : r.status;
    if (!out[r.asset_id] || (rank[st] || 0) > (rank[out[r.asset_id]] || 0))
      out[r.asset_id] = st;
  }
  return out;
}
/** Server-side search over contact name, phone, last preview and message text. Returns matching conversation ids. */
export async function searchConversations(orgId: string, query: string) {
  const q = query.replace(/[%,()*\\]/g, " ").trim();
  if (!q) return null;
  const c = db();
  const [convs, msgs] = await Promise.all([
    c
      .from("wa_conversations")
      .select("id")
      .eq("organization_id", orgId)
      .or(
        `contact_name.ilike.%${q}%,contact_phone.ilike.%${q.replace(/\s+/g, "")}%,last_message_preview.ilike.%${q}%`,
      )
      .limit(200),
    c
      .from("wa_messages")
      .select("conversation_id")
      .eq("organization_id", orgId)
      .neq("kind", "event")
      .ilike("body", `%${q}%`)
      .limit(300),
  ]);
  return new Set<string>([
    ...((convs.data || []) as Row[]).map((r) => r.id),
    ...((msgs.data || []) as Row[]).map((r) => r.conversation_id),
  ]);
}
export const addNote = (conversationId: string, text: string) =>
  invoke({ action: "note", conversation_id: conversationId, text });
export const resolveChat = (conversationId: string) =>
  invoke({ action: "resolve", conversation_id: conversationId });
export const phoneStatus = (waAccountId: string) =>
  invoke({ action: "status", wa_account_id: waAccountId });
export async function sendMedia(conversationId: string, file: File) {
  if (file.size > 5 * 1024 * 1024) throw new Error("Files can be up to 5 MB.");
  if (!["image/jpeg", "image/png", "application/pdf"].includes(file.type))
    throw new Error("Attach a JPEG or PNG image, or a PDF.");
  const buf = new Uint8Array(await file.arrayBuffer());
  let bin = "";
  for (let i = 0; i < buf.length; i += 0x8000)
    bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return invoke({
    action: "send_media",
    conversation_id: conversationId,
    filename: file.name,
    mime: file.type,
    data: btoa(bin),
  });
}
export async function resolveSupport(id: string) {
  const { error } = await db()
    .from("support_requests")
    .update({ status: "resolved" })
    .eq("id", id);
  if (error)
    throw new Error(
      error.code === "42501"
        ? "Only Engineers and above can resolve support requests."
        : error.message,
    );
}
export async function sendTestAlert(siteContactId: string) {
  return invoke({ action: "test_alert", site_contact_id: siteContactId });
}
export async function isPlatformAdmin() {
  const { data } = await db().rpc("revuptime_is_platform_admin");
  return data === true;
}
/** Latest AI assistant decisions for a conversation (newest first). */
export async function loadAiRuns(conversationId: string) {
  const { data, error } = await db()
    .from("wa_ai_runs")
    .select("id, status, reason, error, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(5);
  if (error) return [];
  return data || [];
}
export async function saveQuickReplies(accountId: string, list: string[]) {
  const { error } = await db()
    .from("wa_accounts")
    .update({ quick_replies: list.map((t) => t.slice(0, 80)) })
    .eq("id", accountId);
  if (error)
    throw new Error(
      error.code === "42501"
        ? "Only owners and admins can change quick replies."
        : error.message,
    );
}
export async function setWaAi(accountId: string, on: boolean) {
  const { error } = await db()
    .from("wa_accounts")
    .update({ ai_enabled: on })
    .eq("id", accountId);
  if (error)
    throw new Error(
      error.code === "42501"
        ? "Only owners and admins can change the AI assistant."
        : error.message,
    );
}
export async function updateConversation(
  id: string,
  patch: Partial<
    Pick<
      Row,
      | "mode"
      | "assigned_to"
      | "assigned_team"
      | "status"
      | "unread_count"
      | "site_contact_id"
    >
  >,
) {
  const { error } = await db()
    .from("wa_conversations")
    .update(patch)
    .eq("id", id);
  if (error)
    throw new Error(
      error.code === "42501"
        ? "You can view this inbox but not change it."
        : error.message,
    );
}
export async function mediaUrl(path: string) {
  const { data, error } = await db()
    .storage.from("whatsapp-media")
    .createSignedUrl(path, 3600);
  if (error) throw new Error(error.message);
  return data.signedUrl;
}
async function invoke(body: Row) {
  const { data, error } = await db().functions.invoke("send-whatsapp", {
    body,
  });
  if (error) {
    let message = error.message;
    try {
      message = (await (error as any).context?.json())?.error || message;
    } catch {}
    throw new Error(message);
  }
  return data as Row;
}
export const sendText = (conversationId: string, text: string) =>
  invoke({ action: "send", conversation_id: conversationId, text });
export const sendTemplate = (
  conversationId: string,
  name: string,
  language: string,
  params: string[],
) =>
  invoke({
    action: "send",
    conversation_id: conversationId,
    template: { name, language, params },
  });
export const syncTemplates = (waAccountId: string) =>
  invoke({ action: "sync_templates", wa_account_id: waAccountId });

export async function saveWaAccount(orgId: string, a: Row, userId?: string) {
  const body = {
    organization_id: orgId,
    waba_id: String(a.waba_id).trim(),
    phone_number_id: String(a.phone_number_id).trim(),
    display_phone: String(a.display_phone).replace(/[\s()-]/g, ""),
    display_name: a.display_name || null,
    status: a.status || "active",
    ...(a.id ? {} : { created_by: userId }),
  };
  const q = a.id
    ? db().from("wa_accounts").update(body).eq("id", a.id)
    : db().from("wa_accounts").insert(body);
  const { error } = await q;
  if (error)
    throw new Error(
      error.code === "23505"
        ? "This phone number id is already connected to a workspace."
        : error.code === "23514"
          ? "Check the ids (digits only) and the number (+91…)."
          : error.code === "42501"
            ? "Only owners and admins can connect WhatsApp numbers."
            : error.message,
    );
}

// ---- Shared number, contacts and staff access (Phase 13) ----
export async function loadSharedAccount() {
  const { data } = await db()
    .from("wa_accounts")
    .select(
      "id, display_phone, display_name, status, wa_status, wa_quality, wa_limit, wa_status_checked_at",
    )
    .eq("is_shared", true)
    .maybeSingle();
  return data as Row | null;
}
export const sendTestAlertToMe = (orgId: string) =>
  invoke({ action: "test_alert_me", organization_id: orgId });
export async function loadOrgContacts(orgId: string) {
  const { data, error } = await db()
    .from("org_phone_numbers")
    .select("*")
    .eq("organization_id", orgId)
    .order("display_name");
  if (error) throw new Error(error.message);
  return data || [];
}
/** Is this number free to add? The answer is the same whichever workspace holds it. */
export async function phoneAvailable(phone: string, orgId: string) {
  const { data, error } = await db().rpc("phone_available", {
    p_phone: phone,
    p_org: orgId,
  });
  if (error) throw new Error(error.message);
  return data as { ok: boolean; message?: string; phone?: string };
}
export async function addContact(
  orgId: string,
  c: {
    name: string;
    phone: string;
    siteId: string;
    role: string;
    optedIn: boolean;
  },
) {
  const check = await phoneAvailable(c.phone, orgId);
  if (!check.ok)
    throw new Error(check.message || "That number cannot be added.");
  const { error } = await db()
    .from("site_contacts")
    .insert({
      organization_id: orgId,
      site_id: c.siteId,
      name: c.name.trim(),
      role: c.role,
      whatsapp: check.phone,
      whatsapp_opt_in: c.optedIn,
      whatsapp_opt_in_at: c.optedIn ? new Date().toISOString() : null,
      whatsapp_opt_in_source: c.optedIn ? "app" : null,
    });
  if (error) throw new Error(error.message);
}
export async function loadAccessLog(orgId: string) {
  const { data } = await db()
    .from("platform_access_log")
    .select("id, action, reason, created_at")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false })
    .limit(50);
  return data || [];
}
export async function setOrgAi(orgId: string, on: boolean) {
  const { error } = await db()
    .from("organizations")
    .update({ wa_ai_enabled: on })
    .eq("id", orgId);
  if (error) throw new Error(error.message);
}

// ---- Phase 14: summary, suggested reply, translation (none of these send anything) ----
export const refreshSummary = (conversationId: string) =>
  invoke({ action: "summary", conversation_id: conversationId });
export const suggestReply = async (conversationId: string) =>
  String(
    (await invoke({ action: "suggest_reply", conversation_id: conversationId }))
      .text || "",
  );
export const translateText = async (
  conversationId: string,
  text: string,
  to: string,
) =>
  String(
    (
      await invoke({
        action: "translate",
        conversation_id: conversationId,
        text,
        to,
      })
    ).text || "",
  );
