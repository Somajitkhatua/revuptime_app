import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import {
  ArrowDown,
  ArrowLeft,
  Check,
  CheckCheck,
  ChevronDown,
  Clock3,
  PanelRight,
  Paperclip,
  Search,
  Sparkles,
} from "lucide-react";
import type { Dataset, Row } from "../data";
import { authorizedDataClient } from "../data";
import { debounce, subscribeOrg } from "../orgLive";
import {
  addNote,
  fillTemplate,
  loadInbox,
  loadThread,
  loadThreadContext,
  machineStatuses,
  mediaUrl,
  phoneStatus,
  resolveChat,
  searchConversations,
  sendMedia,
  sendTemplate,
  sendText,
  updateConversation,
  windowLeftMs,
  refreshSummary,
  suggestReply,
  translateText,
} from "./inboxApi";
import {
  clockTime,
  formatAlertForHumans,
} from "../../supabase/functions/_shared/alert-text.ts";
import { ROLE_LABEL } from "./roles";
import { getDisplayTimeZone } from "./time";

const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e));
type Tab = "open" | "needs" | "mine" | "resolved";
type Inbox = {
  accounts: Row[];
  conversations: Row[];
  templates: Row[];
  contacts: Row[];
  support: Row[];
  digestHour: number;
};

export function inboxPath() {
  return location.hash.slice(1).split("/")[1] || "";
}

// ---------------------------------------------------------------------------------------------------
// Formatting

const tz = () => getDisplayTimeZone();
const parts = (d: Date, o: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: tz(), ...o }).format(d);
const dayKey = (d: Date) =>
  parts(d, { year: "numeric", month: "2-digit", day: "2-digit" });
const hhmm = (iso?: string | null) => (iso ? clockTime(iso, tz()) : "");

/** HH:mm today, weekday within the week, otherwise dd MMM. */
export function listTime(iso?: string | null, now = new Date()) {
  if (!iso) return "";
  const d = new Date(iso);
  if (dayKey(d) === dayKey(now)) return hhmm(iso);
  if (now.getTime() - d.getTime() < 6 * 86400000)
    return parts(d, { weekday: "short" });
  return parts(d, { day: "2-digit", month: "short" });
}
/** "Today", "Yesterday", or "Wednesday, 21 Oct". */
export function dayLabel(iso: string, now = new Date()) {
  const d = new Date(iso);
  if (dayKey(d) === dayKey(now)) return "Today";
  if (dayKey(d) === dayKey(new Date(now.getTime() - 86400000)))
    return "Yesterday";
  return `${parts(d, { weekday: "long" })}, ${parts(d, { day: "numeric", month: "short" })}`;
}
/** +91 63621 41843 */
export type SummaryParts = {
  summary: string;
  key_points: string[];
  next_steps: string[];
};
/** The cached AI summary: JSON from the server, or a plain sentence from before. */
export function parseSummary(raw?: string | null): SummaryParts | null {
  if (!raw) return null;
  try {
    const j = JSON.parse(raw);
    if (j && typeof j === "object" && (j.summary || j.key_points))
      return {
        summary: String(j.summary || ""),
        key_points: Array.isArray(j.key_points) ? j.key_points.map(String) : [],
        next_steps: Array.isArray(j.next_steps) ? j.next_steps.map(String) : [],
      };
  } catch {
    /* plain text */
  }
  return { summary: String(raw), key_points: [], next_steps: [] };
}
const stored = (key: string, fallback: boolean) => {
  try {
    const v = localStorage.getItem(key);
    return v === null ? fallback : v === "1";
  } catch {
    return fallback;
  }
};
const store = (key: string, on: boolean) => {
  try {
    localStorage.setItem(key, on ? "1" : "0");
  } catch {
    /* private window */
  }
};

export function formatPhone(p?: string | null) {
  const s = String(p || "");
  const m = s.match(/^\+91(\d{5})(\d{5})$/);
  if (m) return `+91 ${m[1]} ${m[2]}`;
  const g = s.match(/^\+(\d{1,3})(\d+)$/);
  return g ? `+${g[1]} ${g[2].replace(/(\d{4,5})(?=\d)/g, "$1 ")}` : s;
}
const initials = (s: string) =>
  String(s || "?")
    .replace(/^\+/, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("") || "?";
const first = (s?: string | null) =>
  String(s || "")
    .trim()
    .split(/[\s@]+/)[0] || "";

/** One status per chat; "window closed" is computed from the last inbound message. */
export function chatStatus(c: Row): { key: string; label: string } {
  if (c.status === "resolved") return { key: "resolved", label: "Resolved" };
  if (c.status === "needs_person")
    return { key: "needs", label: "Needs a person" };
  if (!windowLeftMs(c.last_inbound_at))
    return { key: "closed", label: "Window closed" };
  if (c.status === "ai_active") return { key: "ai", label: "AI replying" };
  return { key: "waiting", label: "Waiting on them" };
}
function StatusChip({ c }: { c: Row }) {
  const s = chatStatus(c);
  return <span className={"rv-ib-chip is-" + s.key}>{s.label}</span>;
}

function windowPill(lastInbound?: string | null) {
  const left = windowLeftMs(lastInbound);
  if (!left)
    return { tone: "grey", text: "Reply window closed · templates only" };
  const h = Math.floor(left / 3600000),
    m = Math.floor((left % 3600000) / 60000);
  return {
    tone: left > 2 * 3600000 ? "green" : "amber",
    text: `Free reply window: ${h} h ${m} m left`,
  };
}

const SEV_RANK: Record<string, number> = {
  act: 4,
  watch: 3,
  offline: 2,
  good: 1,
};
const MACHINE_LABEL: Record<string, string> = {
  act: "Act now",
  watch: "Watch",
  offline: "Offline",
  good: "Good",
};

// ---------------------------------------------------------------------------------------------------

/** WhatsApp chats with plant teams. The AI answers first; a person takes over when asked. */
export function InboxPage({
  orgId,
  userId,
  data,
  canWrite,
  navigate,
  notify,
  onCreateOrder,
}: {
  orgId: string;
  userId: string;
  data: Dataset;
  canWrite: boolean;
  navigate: (p: string) => void;
  notify: (m: string) => void;
  onCreateOrder: (row: Row) => void;
}) {
  const [state, setState] = useState<Inbox | null | undefined>(undefined);
  const [selected, setSelected] = useState(inboxPath);
  const [tab, setTab] = useState<Tab>("open");
  const [search, setSearch] = useState("");
  const [matches, setMatches] = useState<Set<string> | null>(null);
  const [error, setError] = useState("");
  const [detailsOpen, setDetailsOpen] = useState(() =>
    stored("inbox:details:v2:" + userId, false),
  );
  const toggleDetails = () =>
    setDetailsOpen((v) => {
      store("inbox:details:v2:" + userId, !v);
      return !v;
    });
  const [, tick] = useState(0);
  const load = useCallback(() => {
    loadInbox(orgId)
      .then(setState)
      .catch((e) => setError(errorText(e)));
  }, [orgId]);

  useEffect(() => {
    load();
    const refresh = debounce(load, 400);
    const t = setInterval(() => tick((n) => n + 1), 60_000);
    const off = subscribeOrg(orgId, "wa_conversations", refresh);
    return () => {
      clearInterval(t);
      refresh.cancel();
      off();
    };
  }, [load, orgId]);
  useEffect(() => {
    const on = () => setSelected(inboxPath());
    window.addEventListener("popstate", on);
    window.addEventListener("hashchange", on);
    return () => {
      window.removeEventListener("popstate", on);
      window.removeEventListener("hashchange", on);
    };
  }, []);
  // Server-side search, debounced 250 ms.
  useEffect(() => {
    if (!search.trim()) {
      setMatches(null);
      return;
    }
    const t = setTimeout(() => {
      searchConversations(orgId, search)
        .then(setMatches)
        .catch(() => setMatches(null));
    }, 250);
    return () => clearTimeout(t);
  }, [search, orgId]);

  const account =
    state?.accounts.find((a) => a.status === "active") || state?.accounts[0];
  // Phone status from Meta, refreshed at most every 10 minutes.
  useEffect(() => {
    if (
      !account ||
      (account.wa_status_checked_at &&
        Date.now() - Date.parse(account.wa_status_checked_at) < 600_000)
    )
      return;
    phoneStatus(account.id)
      .then(() => load())
      .catch(() => {});
  }, [account?.id]);

  const open = (id: string) => {
    navigate(id ? "inbox/" + id : "inbox");
    setSelected(id);
  };
  const all = state?.conversations || [];
  const counts = {
    open: all.filter((c) => c.status !== "resolved").length,
    needs: all.filter((c) => c.status === "needs_person").length,
    mine: all.filter((c) => c.assigned_to === userId && c.status !== "resolved")
      .length,
    resolved: all.filter((c) => c.status === "resolved").length,
  };
  const list = all
    .filter((c) =>
      tab === "open"
        ? c.status !== "resolved"
        : tab === "needs"
          ? c.status === "needs_person"
          : tab === "mine"
            ? c.assigned_to === userId && c.status !== "resolved"
            : c.status === "resolved",
    )
    .filter((c) => !matches || matches.has(c.id))
    .sort(
      (a, b) =>
        Number(b.status === "needs_person") -
          Number(a.status === "needs_person") ||
        Date.parse(b.last_message_at || 0) - Date.parse(a.last_message_at || 0),
    );
  const current = all.find((c) => c.id === selected);
  // j and k move through the list, e resolves the open chat (ignored while typing).
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (
        e.metaKey ||
        e.ctrlKey ||
        e.altKey ||
        (el &&
          (/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) ||
            el.isContentEditable))
      )
        return;
      if (e.key === "j" || e.key === "k") {
        const i = list.findIndex((c) => c.id === selected);
        const next =
          list[
            e.key === "j"
              ? Math.min(list.length - 1, i + 1)
              : Math.max(0, i - 1)
          ];
        if (next && next.id !== selected) {
          e.preventDefault();
          open(next.id);
        }
      } else if (
        e.key === "e" &&
        current &&
        canWrite &&
        current.status !== "resolved"
      ) {
        e.preventDefault();
        resolveChat(current.id)
          .then(() => {
            notify("Chat resolved. The AI answers again if they write later.");
            load();
          })
          .catch((err) => setError(errorText(err)));
      }
    };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  });
  const connected = account?.wa_status
    ? account.wa_status === "CONNECTED"
    : !!account && account.status === "active";
  const contactOf = (c: Row) =>
    (state?.contacts || []).find((s) => s.whatsapp === c.contact_phone) ||
    (state?.contacts || []).find((s) => s.id === c.site_contact_id);
  const plantName = (siteId?: string) =>
    (data.sites || []).find((s) => s.id === siteId)?.name;
  const person = (id?: string | null) => {
    const p = (data.profiles || []).find((x) => x.id === id);
    return p?.full_name || p?.email || "Teammate";
  };

  if (state === null)
    return (
      <div className="rv-page rv-ib">
        <h1 className="rv-ib-title">Inbox</h1>
        <p className="rv-muted">
          The WhatsApp inbox needs the latest database update.
        </p>
      </div>
    );

  return (
    <div className="rv-page rv-ib">
      <header className="rv-ib-header">
        <h1 className="rv-ib-title">Inbox</h1>
        {account &&
          (connected ? (
            <button
              type="button"
              className="rv-ib-conn is-ok"
              onClick={() => navigate("settings/notifications")}
              title="WhatsApp settings"
            >
              <span className="rv-ib-dot" aria-hidden="true" />
              WhatsApp · {formatPhone(account.display_phone)}
            </button>
          ) : (
            <button
              type="button"
              className="rv-ib-conn is-bad"
              onClick={() => navigate("settings/notifications")}
            >
              <span className="rv-ib-dot" aria-hidden="true" />
              WhatsApp disconnected — fix in Settings
            </button>
          ))}
      </header>
      {error && (
        <p className="rv-error-box" role="alert">
          {error}
        </p>
      )}

      {state && !state.accounts.length ? (
        <div className="rv-ib-card rv-ib-empty-card">
          <h2>Connect a WhatsApp number</h2>
          <p>
            Add your WhatsApp Business number under Settings › WhatsApp and
            notifications. Messages people send to it appear here.
          </p>
          <button
            type="button"
            className="rv-ib-btn is-primary"
            onClick={() => navigate("settings/notifications")}
          >
            Open WhatsApp settings
          </button>
        </div>
      ) : (
        <div
          className={
            "rv-ib-grid" +
            (current ? " has-thread" : "") +
            (detailsOpen ? "" : " no-details")
          }
        >
          <section className="rv-ib-card rv-ib-list" aria-label="Chats">
            <div className="rv-ib-list-head">
              <label className="rv-ib-search">
                <Search size={16} aria-hidden="true" />
                <span className="rv-sr-only">Search chats</span>
                <input
                  type="search"
                  placeholder="Search name, phone or message"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </label>
              <div
                className="rv-ib-tabs"
                role="tablist"
                aria-label="Filter chats"
              >
                {(
                  [
                    ["open", "Open", "Every chat that is not resolved"],
                    [
                      "needs",
                      "Needs person",
                      "The contact asked for a person, or is waiting for your team to reply",
                    ],
                    ["mine", "Mine", "Chats assigned to you"],
                    [
                      "resolved",
                      "Resolved",
                      "Closed chats. The AI answers again if they write later",
                    ],
                  ] as [Tab, string, string][]
                ).map(([k, label, tip]) => (
                  <button
                    key={k}
                    type="button"
                    role="tab"
                    aria-selected={tab === k}
                    title={tip}
                    className={tab === k ? "is-on" : ""}
                    onClick={() => setTab(k)}
                  >
                    {label}{" "}
                    <span
                      className={
                        "rv-ib-tab-count" +
                        (k === "needs" && counts.needs ? " is-amber" : "")
                      }
                    >
                      {counts[k]}
                    </span>
                  </button>
                ))}
              </div>
            </div>
            <ul className="rv-ib-rows">
              {state === undefined &&
                [0, 1, 2, 3].map((i) => (
                  <li key={i} className="rv-ib-skel" aria-hidden="true">
                    <span />
                    <span />
                    <span />
                  </li>
                ))}
              {state && !all.length && (
                <li className="rv-ib-none">
                  No WhatsApp chats yet. When someone replies to an alert or
                  messages {formatPhone(account?.display_phone)}, it shows up
                  here.{" "}
                  <button
                    type="button"
                    className="rv-link"
                    onClick={() => navigate("settings/notifications")}
                  >
                    Send a test alert
                  </button>
                </li>
              )}
              {state && !!all.length && !list.length && (
                <li className="rv-ib-none">
                  No chats here{search ? " match your search" : ""}.
                </li>
              )}
              {list.map((c) => {
                const contact = contactOf(c);
                const s = chatStatus(c);
                const who =
                  c.last_message_sender === "human"
                    ? "You: "
                    : c.last_message_sender === "ai"
                      ? "AI: "
                      : c.last_message_sender === "system"
                        ? "RevUptime: "
                        : "";
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      className={
                        "rv-ib-row" +
                        (c.id === selected ? " is-on" : "") +
                        (s.key === "needs" ? " is-needs" : "")
                      }
                      onClick={() => open(c.id)}
                      aria-current={c.id === selected || undefined}
                    >
                      <span className="rv-ib-avatar" aria-hidden="true">
                        {initials(
                          contact?.name || c.contact_name || c.contact_phone,
                        )}
                      </span>
                      <span className="rv-ib-row-main">
                        <span className="rv-ib-row-top">
                          <span
                            className={
                              "rv-ib-name" +
                              (c.unread_count > 0 ? " is-unread" : "")
                            }
                          >
                            {contact?.name ||
                              c.contact_name ||
                              formatPhone(c.contact_phone)}
                          </span>
                          <time>{listTime(c.last_message_at)}</time>
                        </span>
                        <span className="rv-ib-meta">
                          {contact
                            ? `${contact.role === "plant_head" ? "Plant Head" : "Maintenance"} · ${plantName(contact.site_id) || "Plant"}`
                            : "Not a plant contact"}
                        </span>
                        <span className="rv-ib-preview">
                          {who}
                          {c.last_message_preview || "No messages"}
                        </span>
                        <span className="rv-ib-row-foot">
                          <StatusChip c={c} />
                          <span className="rv-ib-assignee">
                            {c.assigned_to
                              ? c.assigned_to === userId
                                ? "You"
                                : first(person(c.assigned_to))
                              : c.assigned_team
                                ? "Maintenance team"
                                : c.status === "ai_active"
                                  ? "AI assistant"
                                  : "Unassigned"}
                          </span>
                          {c.unread_count > 0 && (
                            <span
                              className="rv-ib-unread"
                              aria-label={`${c.unread_count} unread`}
                            >
                              {c.unread_count}
                            </span>
                          )}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
            <p className="rv-ib-list-foot">
              Chats are matched to people by their verified WhatsApp number. Add
              people in{" "}
              <button
                type="button"
                className="rv-link"
                onClick={() => navigate("settings/plants")}
              >
                Settings › Team
              </button>
              .
            </p>
          </section>

          {current ? (
            <Thread
              key={current.id}
              conv={current}
              account={account}
              inbox={state!}
              data={data}
              userId={userId}
              canWrite={canWrite}
              detailsOpen={detailsOpen}
              onToggleDetails={toggleDetails}
              contact={contactOf(current)}
              plantName={plantName}
              person={person}
              onBack={() => open("")}
              onChanged={load}
              notify={notify}
              navigate={navigate}
              onCreateOrder={onCreateOrder}
            />
          ) : (
            <section className="rv-ib-card rv-ib-thread rv-ib-pick">
              <p>Choose a chat to read it and reply.</p>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------

function Thread({
  conv,
  account,
  inbox,
  data,
  userId,
  canWrite,
  detailsOpen,
  onToggleDetails,
  contact,
  plantName,
  person,
  onBack,
  onChanged,
  notify,
  navigate,
  onCreateOrder,
}: {
  conv: Row;
  account?: Row;
  inbox: Inbox;
  data: Dataset;
  userId: string;
  canWrite: boolean;
  detailsOpen: boolean;
  onToggleDetails: () => void;
  contact?: Row;
  plantName: (id?: string) => string | undefined;
  person: (id?: string | null) => string;
  onBack: () => void;
  onChanged: () => void;
  notify: (m: string) => void;
  navigate: (p: string) => void;
  onCreateOrder: (row: Row) => void;
}) {
  const [messages, setMessages] = useState<Row[] | null>(null);
  const [ctx, setCtx] = useState<{
    alerts: Row[];
    points: Row[];
    support: Row[];
  }>({ alerts: [], points: [], support: [] });
  const [machines, setMachines] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [, tick] = useState(0);
  const load = useCallback(() => {
    loadThread(conv.id)
      .then((rows) => {
        setMessages(rows);
        const ids = [
          ...new Set(
            [conv.linked_alert_id, ...rows.map((r: Row) => r.alert_id)].filter(
              Boolean,
            ),
          ),
        ] as string[];
        return loadThreadContext(conv.id, ids).then(setCtx);
      })
      .catch((e) => setError(errorText(e)));
  }, [conv.id, conv.linked_alert_id]);

  useEffect(() => {
    load();
    const refresh = debounce(load, 300);
    // The org channel carries every chat's messages; only this chat's events reload the thread.
    const mine = (p: any) =>
      (p?.new?.conversation_id ?? p?.old?.conversation_id) === conv.id;
    const t = setInterval(() => tick((n) => n + 1), 60_000);
    const off = [
      subscribeOrg(conv.organization_id, "wa_messages", (p) => {
        if (mine(p)) refresh();
      }),
      subscribeOrg(conv.organization_id, "wa_conversations", (p) => {
        if ((p?.new?.id ?? p?.old?.id) === conv.id) refresh();
      }),
    ];
    return () => {
      clearInterval(t);
      refresh.cancel();
      off.forEach((f) => f());
    };
  }, [load, conv.id]);
  // Opening a chat marks it read.
  useEffect(() => {
    if (conv.unread_count > 0 && canWrite)
      void updateConversation(conv.id, { unread_count: 0 })
        .then(onChanged)
        .catch(() => {});
  }, [conv.id, conv.unread_count]);

  const plantAssets = useMemo(
    () =>
      (data.assets || []).filter(
        (a) => contact && a.site_id === contact.site_id,
      ),
    [data.assets, contact?.site_id],
  );
  useEffect(() => {
    machineStatuses(
      conv.organization_id,
      plantAssets.map((a) => a.id),
    )
      .then(setMachines)
      .catch(() => {});
  }, [conv.organization_id, plantAssets.map((a) => a.id).join(",")]);

  const name =
    contact?.name || conv.contact_name || formatPhone(conv.contact_phone);
  const aiPossible = !!account?.ai_enabled && !!contact;
  const members = (data.organization_members || []).filter(
    (m) => m.status === "active",
  );
  const linked =
    ctx.alerts.find((a) => a.id === conv.linked_alert_id) ||
    [...ctx.alerts].sort(
      (a, b) => Date.parse(b.detected_at) - Date.parse(a.detected_at),
    )[0];

  async function change(patch: Row, message?: string) {
    setError("");
    try {
      await updateConversation(conv.id, patch);
      if (message) notify(message);
      onChanged();
    } catch (e) {
      setError(errorText(e));
    }
  }
  async function resolve() {
    setBusy("resolve");
    setError("");
    try {
      await resolveChat(conv.id);
      notify("Chat resolved. The AI answers again if they write later.");
      onChanged();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy("");
    }
  }
  const assignValue = conv.assigned_to
    ? conv.assigned_to === userId
      ? "me"
      : conv.assigned_to
    : conv.assigned_team
      ? "team:maintenance"
      : "";
  const onAssign = (v: string) =>
    change(
      v === ""
        ? { assigned_to: null, assigned_team: null }
        : v === "me"
          ? { assigned_to: userId, assigned_team: null }
          : v.startsWith("team:")
            ? { assigned_to: null, assigned_team: "maintenance" }
            : { assigned_to: v, assigned_team: null },
      v ? "Chat assigned." : "Chat unassigned.",
    );

  return (
    <>
      <section
        className="rv-ib-card rv-ib-thread"
        aria-label={`Chat with ${name}`}
      >
        <header className="rv-ib-thread-head">
          <button
            type="button"
            className="rv-back rv-ib-mobile"
            onClick={onBack}
          >
            <ArrowLeft size={16} /> All chats
          </button>
          <div className="rv-ib-head-row">
            <span className="rv-ib-avatar" aria-hidden="true">
              {initials(name)}
            </span>
            <div className="rv-ib-who">
              <h2>{name}</h2>
              <p>
                {[
                  contact
                    ? `${contact.role === "plant_head" ? "Plant Head" : "Maintenance"} · ${plantName(contact.site_id) || "Plant"}`
                    : "",
                  formatPhone(conv.contact_phone),
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
            <div className="rv-ib-head-actions">
              <label
                className="rv-ib-ai-toggle"
                title={
                  conv.mode === "ai"
                    ? "The AI answers new messages. Turn off to reply yourself."
                    : aiPossible
                      ? "Turn on to let the AI answer new messages"
                      : !account?.ai_enabled
                        ? "Turn on the AI assistant in Settings › WhatsApp and notifications"
                        : "The AI only answers numbers saved as plant contacts"
                }
              >
                <span>AI replies</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={conv.mode === "ai"}
                  aria-label="AI assistant replies in this chat"
                  className={
                    "rv-switch is-small" + (conv.mode === "ai" ? " is-on" : "")
                  }
                  disabled={!canWrite || (!aiPossible && conv.mode !== "ai")}
                  onClick={() =>
                    conv.mode === "ai"
                      ? void change(
                          {
                            mode: "human",
                            ...(conv.status === "ai_active"
                              ? { status: "needs_person" }
                              : {}),
                          },
                          "Your team replies in this chat now.",
                        )
                      : void change(
                          { mode: "ai", status: "ai_active" },
                          "The AI assistant answers this chat again.",
                        )
                  }
                >
                  <span />
                </button>
              </label>
              <label className="rv-ib-assign">
                <span className="rv-sr-only">Assigned to</span>
                <select
                  value={assignValue}
                  disabled={!canWrite}
                  onChange={(e) => void onAssign(e.target.value)}
                  title="Assigned to"
                >
                  <option value="">Unassigned</option>
                  <option value="me">Me</option>
                  {members
                    .filter((m) => m.user_id !== userId)
                    .map((m) => (
                      <option key={m.user_id} value={m.user_id}>
                        {person(m.user_id)} · {ROLE_LABEL[m.role] || m.role}
                      </option>
                    ))}
                  <option value="team:maintenance">Maintenance team</option>
                </select>
              </label>
              {conv.status !== "resolved" && (
                <button
                  type="button"
                  className="rv-ib-btn is-green"
                  disabled={!canWrite || !!busy}
                  onClick={() => void resolve()}
                  title="Closes the chat. The AI answers again if they write later."
                >
                  {busy === "resolve" ? "Resolving…" : "Resolve"}
                </button>
              )}
              <button
                type="button"
                className={"rv-ib-icon" + (detailsOpen ? " is-on" : "")}
                aria-pressed={detailsOpen}
                onClick={onToggleDetails}
                title="Show or hide details"
                aria-label="Details"
              >
                <PanelRight size={18} aria-hidden="true" />
              </button>
            </div>
          </div>
        </header>

        {conv.status === "needs_person" && (
          <div className="rv-ib-handover" role="status">
            <p className="rv-ib-handover-title">
              {conv.handover_requested_at
                ? `${first(name)} asked for a person · ${hhmm(conv.handover_requested_at)}`
                : `${first(name)} is waiting for a reply · ${hhmm(conv.last_inbound_at)}`}
            </p>
            <p>
              {linked && (
                <>About: {humanAlert(linked, data, ctx.points).headline}. </>
              )}
              The AI has stopped replying in this chat.
              {conv.handover_notified
                ? ` ${conv.handover_notified} teammate${conv.handover_notified === 1 ? " was" : "s were"} emailed.`
                : ""}
            </p>
            {canWrite && (
              <div className="rv-ib-handover-actions">
                <button
                  type="button"
                  className="rv-ib-btn is-primary"
                  onClick={() =>
                    void change(
                      {
                        assigned_to: userId,
                        assigned_team: null,
                        status: "waiting_contact",
                      },
                      "Assigned to you.",
                    )
                  }
                >
                  Assign to me
                </button>
                <button
                  type="button"
                  className="rv-ib-btn"
                  disabled={!aiPossible}
                  title={
                    aiPossible
                      ? "The AI answers new messages again"
                      : "The AI only answers plant contacts on a number with the AI assistant on"
                  }
                  onClick={() =>
                    void change(
                      { mode: "ai", status: "ai_active" },
                      "Given back to the AI.",
                    )
                  }
                >
                  Give back to AI
                </button>
              </div>
            )}
          </div>
        )}

        <SummaryCard conv={conv} canWrite={canWrite} onChanged={onChanged} />

        <Timeline
          messages={messages}
          ctx={ctx}
          data={data}
          userId={userId}
          name={name}
          person={person}
          onRetry={async (m) => {
            try {
              await sendText(conv.id, m.body);
              load();
              onChanged();
            } catch (e) {
              setError(errorText(e));
            }
          }}
          canWrite={canWrite}
        />

        {canWrite ? (
          <Composer
            conv={conv}
            account={account}
            onTakeOver={() =>
              void change(
                {
                  mode: "human",
                  ...(conv.status === "ai_active"
                    ? { status: "needs_person" }
                    : {}),
                },
                "Your team replies in this chat now.",
              )
            }
            templates={inbox.templates.filter(
              (t) => t.wa_account_id === conv.wa_account_id,
            )}
            onSent={() => {
              load();
              onChanged();
            }}
          />
        ) : (
          <p className="rv-ib-readonly">
            You can read this inbox. Replying needs the Engineer role or above.
          </p>
        )}
        {error && (
          <p className="rv-error-box rv-ib-error" role="alert">
            {error}
          </p>
        )}
      </section>

      {detailsOpen && (
        <ContextPane
          conv={conv}
          contact={contact}
          inbox={inbox}
          data={data}
          linked={linked}
          points={ctx.points}
          plantName={plantName}
          plantAssets={plantAssets}
          machines={machines}
          navigate={navigate}
          onCreateOrder={onCreateOrder}
        />
      )}
    </>
  );
}

/** Plain-language alert text using the asset, point and gateway names. */
/** AI summary at the top of the thread. It is regenerated on the server only when the chat has changed since the last one. */
function SummaryCard({
  conv,
  canWrite,
  onChanged,
}: {
  conv: Row;
  canWrite: boolean;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [more, setMore] = useState(false);
  const asked = useRef("");
  const s = parseSummary(conv.ai_summary);
  const stale =
    !conv.ai_summary_at ||
    (conv.last_message_at &&
      Date.parse(conv.last_message_at) > Date.parse(conv.ai_summary_at));
  useEffect(() => {
    const key = conv.id + ":" + conv.last_message_at;
    if (!stale || !canWrite || asked.current === key) return;
    asked.current = key;
    setBusy(true);
    refreshSummary(conv.id)
      .then(onChanged)
      .catch(() => {})
      .finally(() => setBusy(false));
  }, [conv.id, conv.last_message_at, stale, canWrite]);
  if (!s && !busy) return null;
  return (
    <section
      className={"rv-ib-aisum" + (more ? " is-open" : "")}
      aria-label="AI summary"
    >
      <button
        type="button"
        className="rv-ib-aisum-bar"
        aria-expanded={more}
        onClick={() => setMore((v) => !v)}
      >
        <Sparkles size={14} aria-hidden="true" />
        <span className="rv-ib-aisum-text">
          {busy && !s?.summary ? "Updating the summary…" : s?.summary}
        </span>
        <ChevronDown
          size={16}
          aria-hidden="true"
          className="rv-ib-aisum-chev"
        />
      </button>
      {more && (
        <div className="rv-ib-aisum-body">
          {!!s?.key_points.length && (
            <>
              <p className="rv-ib-aisum-label">Key points</p>
              <ul>
                {s.key_points.map((x, i) => (
                  <li key={i}>{x}</li>
                ))}
              </ul>
            </>
          )}
          {!!s?.next_steps.length && (
            <>
              <p className="rv-ib-aisum-label">Next steps</p>
              <ul>
                {s.next_steps.map((x, i) => (
                  <li key={i}>{x}</li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </section>
  );
}

function humanAlert(a: Row, data: Dataset, points: Row[]) {
  const gatewayAssets = [
    ...new Set(
      (data.sensors || [])
        .filter((s) => s.gateway_id === a.gateway_id && s.asset_id)
        .map((s) => s.asset_id),
    ),
  ];
  const assetId: string | undefined =
    a.asset_id || (gatewayAssets.length === 1 ? gatewayAssets[0] : undefined);
  const asset = (data.assets || []).find((x) => x.id === assetId)?.name;
  const gateway = (data.gateways || []).find(
    (g) => g.id === a.gateway_id,
  )?.name;
  const point = points.find((p) => p.id === a.point_id)?.name;
  const rule = (data.alert_rules || []).find(
    (r) => r.id === a.alert_rule_id,
  )?.rule_type;
  return {
    ...formatAlertForHumans(
      { ...a, rule_type: rule, asset, gateway, point },
      getDisplayTimeZone(),
    ),
    asset,
    assetId,
    gateway,
    point,
  };
}
const openAsset = (id: string) => {
  history.pushState(null, "", `/assets/${encodeURIComponent(id)}/overview`);
  window.dispatchEvent(new PopStateEvent("popstate"));
};

// ---------------------------------------------------------------------------------------------------

function Timeline({
  messages,
  ctx,
  data,
  userId,
  name,
  person,
  onRetry,
  canWrite,
}: {
  messages: Row[] | null;
  ctx: { alerts: Row[]; points: Row[] };
  data: Dataset;
  userId: string;
  name: string;
  person: (id?: string | null) => string;
  onRetry: (m: Row) => void;
  canWrite: boolean;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [atBottom, setAtBottom] = useState(true);
  const [fresh, setFresh] = useState(false);
  const count = messages?.length || 0;
  const toBottom = () => {
    box.current?.scrollTo({ top: box.current.scrollHeight });
    setFresh(false);
  };
  useEffect(() => {
    if (atBottom) toBottom();
    else if (count) setFresh(true);
  }, [count]);
  const onScroll = () => {
    const el = box.current;
    if (!el) return;
    const bottom = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
    setAtBottom(bottom);
    if (bottom) setFresh(false);
  };

  return (
    <div className="rv-ib-timeline-wrap">
      <div
        className="rv-ib-timeline"
        ref={box}
        onScroll={onScroll}
        aria-live="polite"
      >
        {messages === null && <p className="rv-ib-none">Loading the chat…</p>}
        {messages?.length === 0 && (
          <p className="rv-ib-none">No messages yet.</p>
        )}
        {(messages || []).map((m, i) => {
          const showDay =
            i === 0 ||
            dayLabel(messages![i - 1].created_at) !== dayLabel(m.created_at);
          return (
            <div key={m.id} className="rv-ib-item">
              {showDay && (
                <p className="rv-ib-event is-day">
                  <span className="rv-ib-dot is-grey" aria-hidden="true" />
                  {dayLabel(m.created_at)}
                </p>
              )}
              <Message
                m={m}
                ctx={ctx}
                data={data}
                userId={userId}
                contactName={name}
                person={person}
                onRetry={onRetry}
                canWrite={canWrite}
              />
            </div>
          );
        })}
      </div>
      {fresh && (
        <button type="button" className="rv-ib-new" onClick={toBottom}>
          New messages <ArrowDown size={14} />
        </button>
      )}
    </div>
  );
}

function Message({
  m,
  ctx,
  data,
  userId,
  contactName,
  person,
  onRetry,
  canWrite,
}: {
  m: Row;
  ctx: { alerts: Row[]; points: Row[] };
  data: Dataset;
  userId: string;
  contactName: string;
  person: (id?: string | null) => string;
  onRetry: (m: Row) => void;
  canWrite: boolean;
}) {
  if (m.kind === "event") {
    return (
      <p className="rv-ib-event">
        <span
          className={"rv-ib-dot is-" + (m.payload?.tone || "grey")}
          aria-hidden="true"
        />
        {m.body}
      </p>
    );
  }
  if (m.kind === "note") {
    return (
      <div className="rv-ib-bubble is-note">
        <span className="rv-ib-author">
          {m.sender_user_id === userId
            ? "You"
            : first(person(m.sender_user_id))}{" "}
          · internal note, not sent
        </span>
        <p>{m.body}</p>
        <span className="rv-ib-foot">{hhmm(m.created_at)}</span>
      </div>
    );
  }
  if (m.kind === "alert") {
    const a = ctx.alerts.find((x) => x.id === m.alert_id);
    const h = a ? humanAlert(a, data, ctx.points) : null;
    const sev = a?.severity || (m.payload?.test ? "info" : "warning");
    return (
      <div className={"rv-ib-alert is-" + sev}>
        <p className="rv-ib-alert-top">
          <span className={"rv-ib-sev is-" + sev}>
            {m.payload?.test ? "Test" : h?.chip || m.payload?.chip || "Alert"}
          </span>{" "}
          Alert sent on WhatsApp · {hhmm(m.created_at)}
        </p>
        <p className="rv-ib-alert-title">
          {h?.headline || m.payload?.headline || m.body}
        </p>
        <p className="rv-ib-alert-detail">
          {h?.detail || m.payload?.detail || ""}
        </p>
        <p className="rv-ib-alert-foot">
          {a && a.acknowledged_at && (
            <span className="rv-ib-chip is-resolved">
              Acknowledged
              {a.acknowledged_via === "whatsapp"
                ? ` by ${first(contactName)}`
                : ""}{" "}
              · {hhmm(a.acknowledged_at)}
            </span>
          )}
          {a && a.status === "open" && (
            <span className="rv-ib-chip is-needs">Not acknowledged yet</span>
          )}
          <Delivery m={m} />
          {h?.assetId && (
            <button
              type="button"
              className="rv-link"
              onClick={() => openAsset(h.assetId!)}
            >
              Open machine
            </button>
          )}
        </p>
      </div>
    );
  }
  const inbound = m.direction === "in";
  const cls = inbound
    ? "is-in"
    : m.sender_type === "ai"
      ? "is-ai"
      : m.sender_type === "human"
        ? "is-team"
        : "is-system";
  const author = inbound
    ? first(contactName) || "Contact"
    : m.sender_type === "ai"
      ? "RevUptime AI"
      : m.sender_type === "human"
        ? m.source === "business_app"
          ? "WhatsApp Business app"
          : m.sender_user_id === userId
            ? `${first(person(m.sender_user_id))} (you)`
            : first(person(m.sender_user_id))
        : "RevUptime (automatic)";
  const isFileName =
    m.media_path && /^[\w .()-]+\.(pdf|jpe?g|png)$/i.test(String(m.body || ""));
  return (
    <div
      className={
        "rv-ib-bubble " + cls + (m.status === "failed" ? " is-failed" : "")
      }
    >
      <span className="rv-ib-author">
        {author}
        {m.template_name ? ` · template ${m.template_name}` : ""}
      </span>
      {m.media_path ? (
        <Media path={m.media_path} mime={m.media_mime} />
      ) : (
        ["image", "video", "audio", "document", "sticker"].includes(m.type) && (
          <span className="rv-ib-foot">
            <Paperclip size={13} /> {m.type} (loading…)
          </span>
        )
      )}
      {m.body && !isFileName && <p>{m.body}</p>}
      <span className="rv-ib-foot">
        {hhmm(m.created_at)}
        {!inbound && (
          <>
            {" "}
            ·{" "}
            <Delivery
              m={m}
              onRetry={
                canWrite && m.type === "text" ? () => onRetry(m) : undefined
              }
            />
          </>
        )}
      </span>
    </div>
  );
}

function Delivery({ m, onRetry }: { m: Row; onRetry?: () => void }) {
  if (m.status === "failed") {
    return (
      <span className="rv-ib-failed">
        Failed{m.error ? ` (${m.error})` : ""}
        {onRetry && (
          <>
            {" "}
            ·{" "}
            <button type="button" className="rv-link is-red" onClick={onRetry}>
              Retry
            </button>
          </>
        )}
      </span>
    );
  }
  if (m.status === "read")
    return (
      <span className="rv-ib-status">
        <CheckCheck size={13} className="rv-text-blue" aria-hidden="true" />{" "}
        read
      </span>
    );
  if (m.status === "delivered")
    return (
      <span className="rv-ib-status">
        <CheckCheck size={13} aria-hidden="true" /> delivered
      </span>
    );
  return (
    <span className="rv-ib-status">
      <Check size={13} aria-hidden="true" /> sent
    </span>
  );
}

function Media({ path, mime }: { path: string; mime?: string }) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    mediaUrl(path)
      .then(setUrl)
      .catch(() => setUrl(""));
  }, [path]);
  if (!url) return <span className="rv-ib-foot">Loading attachment…</span>;
  if (mime?.startsWith("image/"))
    return (
      <a href={url} target="_blank" rel="noreferrer">
        <img className="rv-ib-image" src={url} alt="Photo in the chat" />
      </a>
    );
  if (mime?.startsWith("audio/")) return <audio controls src={url} />;
  if (mime?.startsWith("video/"))
    return <video controls src={url} className="rv-ib-image" />;
  return (
    <a className="rv-link" href={url} target="_blank" rel="noreferrer">
      <Paperclip size={13} /> Open attachment
    </a>
  );
}

// ---------------------------------------------------------------------------------------------------

function Composer({
  conv,
  account,
  templates,
  onSent,
  onTakeOver,
}: {
  conv: Row;
  account?: Row;
  templates: Row[];
  onSent: () => void;
  onTakeOver: () => void;
}) {
  const [mode, setMode] = useState<"reply" | "note">("reply");
  const [text, setText] = useState("");
  const [tpl, setTpl] = useState<{
    open: boolean;
    id: string;
    params: string[];
  }>({ open: false, id: "", params: [] });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const file = useRef<HTMLInputElement>(null);
  const windowOpen = windowLeftMs(conv.last_inbound_at) > 0;
  const template = templates.find((t) => t.id === tpl.id);
  const quick: string[] = account?.quick_replies || [];
  const aiReplying = conv.mode === "ai";
  const area = useRef<HTMLTextAreaElement>(null);
  const [sug, setSug] = useState<{
    text: string;
    loading: boolean;
    error: string;
  }>({ text: "", loading: false, error: "" });
  const pill = windowPill(conv.last_inbound_at);
  const [lang, setLang] = useState("");
  const suggest = async () => {
    setSug((x) => ({ ...x, loading: true, error: "", text: "" }));
    try {
      setSug((x) => ({ ...x, loading: false, text: "" }));
      const t = await suggestReply(conv.id);
      setSug((x) => ({ ...x, loading: false, text: t }));
    } catch (e) {
      setSug((x) => ({ ...x, loading: false, error: errorText(e) }));
    }
  };
  // Use puts the draft in the box; it is never sent without your click on Send.
  const useDraft = () => {
    setText(sug.text);
    setSug((x) => ({ ...x, text: "" }));
    setTimeout(() => {
      const el = area.current;
      if (el) {
        el.focus();
        el.setSelectionRange(el.value.length, el.value.length);
      }
    }, 0);
  };
  const translate = async (to: string) => {
    setLang(to);
    if (!text.trim()) return;
    setBusy(true);
    setError("");
    try {
      setText(await translateText(conv.id, text, to));
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
      setLang("");
    }
  };

  async function run(fn: () => Promise<unknown>, clear: () => void) {
    setBusy(true);
    setError("");
    try {
      await fn();
      clear();
      onSent();
    } catch (e) {
      setError(errorText(e)); // the typed text stays in the box
    } finally {
      setBusy(false);
    }
  }
  const send = () => {
    if (!text.trim() || busy) return;
    if (mode === "note")
      return run(
        () => addNote(conv.id, text.trim()),
        () => setText(""),
      );
    return run(
      () => sendText(conv.id, text.trim()),
      () => setText(""),
    );
  };
  const onKey = (e: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  };
  const pickTemplate = (id: string) => {
    const t = templates.find((x) => x.id === id);
    setTpl({ open: true, id, params: Array(t?.param_count || 0).fill("") });
  };

  const picker = tpl.open && (
    <div className="rv-ib-template">
      <label className="rv-ib-field is-block">
        <span>Approved template</span>
        <select value={tpl.id} onChange={(e) => pickTemplate(e.target.value)}>
          <option value="">
            {templates.length
              ? "Choose a template"
              : "No approved templates yet (sync them in Settings)"}
          </option>
          {templates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name} · {t.language}
            </option>
          ))}
        </select>
      </label>
      {template &&
        tpl.params.map((p, i) => (
          <label key={i} className="rv-ib-field is-block">
            <span>Value {`{{${i + 1}}}`}</span>
            <input
              value={p}
              onChange={(e) =>
                setTpl({
                  ...tpl,
                  params: tpl.params.map((x, j) =>
                    j === i ? e.target.value : x,
                  ),
                })
              }
            />
          </label>
        ))}
      {template && (
        <p className="rv-ib-preview-text">
          {fillTemplate(template.body_text || template.name, tpl.params)}
        </p>
      )}
      <div className="rv-ib-compose-actions">
        <button
          type="button"
          className="rv-ib-btn"
          onClick={() => setTpl({ open: false, id: "", params: [] })}
        >
          Cancel
        </button>
        <button
          type="button"
          className="rv-ib-btn is-primary"
          disabled={!template || busy || tpl.params.some((p) => !p.trim())}
          onClick={() =>
            void run(
              () =>
                sendTemplate(
                  conv.id,
                  template!.name,
                  template!.language,
                  tpl.params,
                ),
              () => setTpl({ open: false, id: "", params: [] }),
            )
          }
        >
          Send template
        </button>
      </div>
    </div>
  );

  return (
    <div className={"rv-ib-composer" + (mode === "note" ? " is-note" : "")}>
      <div className="rv-ib-compose-top">
        <div
          className="rv-ib-compose-tabs"
          role="tablist"
          aria-label="Message type"
        >
          <button
            type="button"
            role="tab"
            aria-selected={mode === "reply"}
            className={mode === "reply" ? "is-on" : ""}
            onClick={() => setMode("reply")}
          >
            Reply
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "note"}
            className={mode === "note" ? "is-on" : ""}
            onClick={() => setMode("note")}
          >
            Internal note
          </button>
        </div>
        {mode === "reply" && (
          <span
            className={"rv-ib-window is-" + (windowOpen ? pill.tone : "grey")}
            title="WhatsApp allows free-form replies for 24 hours after the person last wrote. After that you can only send an approved template."
          >
            <Clock3 size={13} aria-hidden="true" />{" "}
            {windowOpen
              ? pill.text.replace("Free reply window: ", "")
              : "Window closed"}
          </span>
        )}
      </div>

      {mode === "reply" && windowOpen && aiReplying && (
        <div className="rv-ib-takeover" role="status">
          <span>
            <Sparkles size={14} aria-hidden="true" /> The AI is answering this
            chat.
          </span>
          <button type="button" className="rv-link" onClick={onTakeOver}>
            Take over
          </button>
        </div>
      )}
      {mode === "reply" &&
        windowOpen &&
        (sug.loading || sug.text || sug.error) && (
          <div className="rv-ib-suggest">
            {sug.loading ? (
              <p className="rv-muted">Writing a suggestion…</p>
            ) : sug.error ? (
              <p className="rv-error" role="alert">
                {sug.error}
              </p>
            ) : (
              <>
                <p className="rv-ib-suggest-text">{sug.text}</p>
                <div className="rv-ib-suggest-actions">
                  <button
                    type="button"
                    className="rv-ib-btn is-primary"
                    onClick={useDraft}
                  >
                    Use
                  </button>
                  <button
                    type="button"
                    className="rv-ib-btn"
                    onClick={() => void suggest()}
                  >
                    Try again
                  </button>
                  <button
                    type="button"
                    className="rv-link"
                    onClick={() =>
                      setSug({ text: "", loading: false, error: "" })
                    }
                  >
                    Dismiss
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      {mode === "reply" && !windowOpen ? (
        <>
          <p className="rv-ib-closed">
            The 24-hour reply window has closed, so WhatsApp only allows an
            approved template. Once they reply, you can write freely again.
          </p>
          {picker || (
            <button
              type="button"
              className="rv-ib-btn is-primary"
              onClick={() => setTpl({ open: true, id: "", params: [] })}
            >
              Send a template
            </button>
          )}
        </>
      ) : (
        <>
          {picker}
          <label className="rv-sr-only" htmlFor={"compose-" + conv.id}>
            {mode === "note" ? "Internal note" : "WhatsApp reply"}
          </label>
          <textarea
            ref={area}
            id={"compose-" + conv.id}
            rows={2}
            maxLength={mode === "note" ? 4000 : 4096}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={onKey}
            placeholder={
              mode === "note"
                ? "Write a note for your team. It is not sent on WhatsApp."
                : "Write a reply. Enter sends, Shift+Enter adds a line."
            }
          />
          <div className="rv-ib-compose-row">
            {mode === "reply" ? (
              <div className="rv-ib-tools" aria-label="Reply tools">
                <input
                  ref={file}
                  type="file"
                  hidden
                  accept="image/jpeg,image/png,application/pdf"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    e.target.value = "";
                    if (f)
                      void run(
                        () => sendMedia(conv.id, f),
                        () => {},
                      );
                  }}
                />
                <button
                  type="button"
                  className="rv-ib-icon"
                  disabled={busy}
                  onClick={() => file.current?.click()}
                  title="Attach an image (JPEG or PNG) or PDF, up to 5 MB"
                  aria-label="Attach a file"
                >
                  <Paperclip size={17} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className="rv-ib-tool"
                  disabled={busy || !!sug.loading}
                  onClick={() => void suggest()}
                  title="Ask the AI for a draft. Nothing is sent until you press Send."
                >
                  <Sparkles size={15} aria-hidden="true" /> Suggest
                </button>
                {!!quick.length && (
                  <details className="rv-ib-saved">
                    <summary className="rv-ib-tool">Saved replies</summary>
                    <ul>
                      {quick.map((q) => (
                        <li key={q}>
                          <button
                            type="button"
                            onClick={() =>
                              setText((t) => (t ? t + " " : "") + q)
                            }
                          >
                            {q}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
                <button
                  type="button"
                  className="rv-ib-tool"
                  disabled={busy}
                  onClick={() =>
                    setTpl({ open: !tpl.open, id: "", params: [] })
                  }
                >
                  Template
                </button>
                <label className="rv-ib-translate">
                  <span className="rv-sr-only">Translate your message</span>
                  <select
                    value={lang}
                    disabled={busy || !text.trim()}
                    onChange={(e) =>
                      e.target.value && void translate(e.target.value)
                    }
                    title="Translate what you typed"
                  >
                    <option value="">Translate</option>
                    <option>English</option>
                    <option>Hindi</option>
                    <option>Odia</option>
                  </select>
                </label>
              </div>
            ) : (
              <span className="rv-ib-hint">Only your team sees notes.</span>
            )}
            <button
              type="button"
              className={
                "rv-ib-btn is-primary rv-ib-send" +
                (mode === "note" ? " is-note" : "")
              }
              disabled={busy || !text.trim()}
              onClick={() => void send()}
              title="Enter sends, Shift+Enter adds a new line"
            >
              {busy ? "Sending…" : mode === "note" ? "Add note" : "Send"}
            </button>
          </div>
        </>
      )}
      {error && (
        <p className="rv-error-box" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------

function ContextPane({
  conv,
  contact,
  inbox,
  data,
  linked,
  points,
  plantName,
  plantAssets,
  machines,
  navigate,
  onCreateOrder,
}: {
  conv: Row;
  contact?: Row;
  inbox: Inbox;
  data: Dataset;
  linked?: Row;
  points: Row[];
  plantName: (id?: string) => string | undefined;
  plantAssets: Row[];
  machines: Record<string, string>;
  navigate: (p: string) => void;
  onCreateOrder: (row: Row) => void;
}) {
  const plant = contact ? plantName(contact.site_id) : undefined;
  const h = linked ? humanAlert(linked, data, points) : null;
  const sorted = [...plantAssets].sort(
    (a, b) =>
      (SEV_RANK[machines[b.id]] || 0) - (SEV_RANK[machines[a.id]] || 0) ||
      String(a.name).localeCompare(String(b.name)),
  );
  const ackName = linked?.acknowledged_by_contact
    ? inbox.contacts.find((c) => c.id === linked.acknowledged_by_contact)
        ?.name || "the contact"
    : null;
  const state =
    linked &&
    [
      linked.status === "acknowledged"
        ? "Open"
        : linked.status[0].toUpperCase() + linked.status.slice(1),
      linked.acknowledged_at
        ? `acknowledged by ${first(ackName) || "your team"}${linked.acknowledged_via === "whatsapp" ? " on WhatsApp" : ""} at ${hhmm(linked.acknowledged_at)}`
        : "",
    ]
      .filter(Boolean)
      .join(" · ");

  return (
    <aside className="rv-ib-side" aria-label="Chat details">
      <section className="rv-ib-card rv-ib-side-card">
        {contact ? (
          <>
            <div className="rv-ib-contact-head">
              <span className="rv-ib-avatar is-big" aria-hidden="true">
                {initials(contact.name)}
              </span>
              <span>
                <strong>{contact.name}</strong>
                <small>
                  {contact.role === "plant_head" ? "Plant Head" : "Maintenance"}{" "}
                  · {plant || "Plant"}
                </small>
              </span>
            </div>
            <dl className="rv-ib-facts">
              <dt>Phone</dt>
              <dd>{formatPhone(contact.whatsapp)}</dd>
              <dt>Gets alerts</dt>
              <dd>
                {getsAlerts(contact, data.alert_rules || [], inbox.digestHour)}
              </dd>
              <dt>Opted in</dt>
              <dd>
                {contact.whatsapp_opt_in && contact.whatsapp_opt_in_at
                  ? `${new Date(contact.whatsapp_opt_in_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}, ${contact.whatsapp_opt_in_source === "whatsapp" ? "by replying START" : "from the app"}`
                  : "Not opted in to WhatsApp alerts"}
              </dd>
              <dt>Language</dt>
              <dd>{contact.language || "English"}</dd>
            </dl>
            <button
              type="button"
              className="rv-link"
              onClick={() => navigate("settings/plants")}
            >
              Edit person and alert preferences
            </button>
          </>
        ) : (
          <>
            <h3 className="rv-ib-side-title">
              {conv.contact_name || formatPhone(conv.contact_phone)}
            </h3>
            <p className="rv-ib-muted">
              {formatPhone(conv.contact_phone)} is not saved as a plant contact,
              so the AI does not answer and alerts are not sent to it.
            </p>
            <button
              type="button"
              className="rv-link"
              onClick={() => navigate("settings/plants")}
            >
              Add this person to a plant
            </button>
          </>
        )}
      </section>

      <section className="rv-ib-card rv-ib-side-card">
        <h3 className="rv-ib-side-title">Alert in this chat</h3>
        {linked && h ? (
          <div className={"rv-ib-linked is-" + linked.severity}>
            <p className="rv-ib-linked-title">{h.headline}</p>
            <p className="rv-ib-muted">
              {[h.asset, h.point || h.gateway, plantName(linked.site_id)]
                .filter(Boolean)
                .join(" · ")}
            </p>
            <p className="rv-ib-muted">{state}</p>
            <div className="rv-ib-side-actions">
              {!linked.work_order_id && linked.status !== "resolved" && (
                <button
                  type="button"
                  className="rv-ib-btn is-primary"
                  onClick={() =>
                    onCreateOrder({
                      alert_id: linked.id,
                      asset_id: linked.asset_id,
                      site_id: linked.site_id,
                      title: h.headline,
                      description: h.detail,
                      priority:
                        linked.severity === "critical" ? "high" : "medium",
                    })
                  }
                >
                  Create work order
                </button>
              )}
              <button
                type="button"
                className="rv-ib-btn"
                onClick={() => navigate("alerts/" + linked.id)}
              >
                Open alert
              </button>
            </div>
          </div>
        ) : (
          <p className="rv-ib-muted">No alert linked</p>
        )}
      </section>

      {contact && (
        <section className="rv-ib-card rv-ib-side-card">
          <h3 className="rv-ib-side-title">
            Machines at {plant || "this plant"}
          </h3>
          {sorted.length ? (
            <ul className="rv-ib-machines">
              {sorted.map((a) => {
                const st = machines[a.id] || "offline";
                return (
                  <li key={a.id}>
                    <button
                      type="button"
                      className="rv-link is-plain"
                      onClick={() => openAsset(a.id)}
                    >
                      {a.name}
                    </button>
                    <span className={"rv-ib-mchip is-" + st}>
                      {machines[a.id] ? MACHINE_LABEL[st] : "No sensor"}
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="rv-ib-muted">No machines in this plant yet.</p>
          )}
        </section>
      )}
    </aside>
  );
}

/** "Critical and device alerts, 08:00 daily summary" from the alert rules that notify this contact's role. */
export function getsAlerts(contact: Row, rules: Row[], digestHour = 8) {
  if (!contact.whatsapp_opt_in) return "None (not opted in)";
  const mine = rules.filter(
    (r) =>
      r.is_active !== false &&
      (r.notify?.channels || ["whatsapp"]).includes("whatsapp") &&
      (r.notify?.roles || ["plant_head", "maintenance"]).includes(contact.role),
  );
  if (!mine.length) return "No alert rules send to this role";
  const instant = new Set(
    mine
      .filter((r) => r.notify?.mode !== "digest")
      .map((r) => (r.rule_type === "no_data" ? "device" : r.severity)),
  );
  const order = ["critical", "warning", "device", "info"].filter((s) =>
    instant.has(s),
  );
  const words = order.map((s, i) =>
    i === 0 ? s[0].toUpperCase() + s.slice(1) : s,
  );
  const list =
    words.length > 1
      ? `${words.slice(0, -1).join(", ")} and ${words[words.length - 1]}`
      : words[0];
  const digest = mine.some((r) => r.notify?.mode === "digest")
    ? `${String(digestHour).padStart(2, "0")}:00 daily summary`
    : "";
  return [list ? `${list} alerts` : "", digest].filter(Boolean).join(", ");
}
