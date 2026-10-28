// One Realtime channel per organisation, shared by every page, plus timers that stop while the tab is hidden.
// Pages call subscribeOrg() instead of opening their own channels, so switching pages never adds connections
// and the browser holds a single socket subscription per workspace.
import { authorizedDataClient } from "./data";

export type OrgTable =
  | "alerts"
  | "wa_conversations"
  | "wa_messages"
  | "gateways";
type Handler = (payload: any) => void;

const TABLES: OrgTable[] = [
  "alerts",
  "wa_conversations",
  "wa_messages",
  "gateways",
];
let current: {
  orgId: string;
  client: ReturnType<typeof authorizedDataClient>;
  channel: any;
  handlers: Record<OrgTable, Set<Handler>>;
  closeTimer?: ReturnType<typeof setTimeout>;
} | null = null;

function open(orgId: string) {
  const client = authorizedDataClient();
  const handlers = Object.fromEntries(
    TABLES.map((t) => [t, new Set<Handler>()]),
  ) as Record<OrgTable, Set<Handler>>;
  let channel = client.channel("org:" + orgId);
  for (const table of TABLES) {
    channel = channel.on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table,
        filter: `organization_id=eq.${orgId}`,
      },
      (payload: any) => {
        for (const h of handlers[table]) {
          try {
            h(payload);
          } catch {
            /* one page's handler must not stop the others */
          }
        }
      },
    );
  }
  channel.subscribe();
  return { orgId, client, channel, handlers };
}

function close() {
  if (!current) return;
  void current.client.removeChannel(current.channel);
  current = null;
}

/** Calls handler for every change to `table` in this organisation. Returns the unsubscribe function. */
export function subscribeOrg(orgId: string, table: OrgTable, handler: Handler) {
  if (current && current.orgId !== orgId) close();
  if (!current) current = open(orgId);
  const mine = current;
  if (mine.closeTimer) {
    clearTimeout(mine.closeTimer);
    mine.closeTimer = undefined;
  }
  mine.handlers[table].add(handler);
  return () => {
    mine.handlers[table].delete(handler);
    // Leave the channel up briefly so a route change (one page unmounts, the next mounts) does not reconnect.
    if (TABLES.every((t) => mine.handlers[t].size === 0)) {
      mine.closeTimer = setTimeout(() => {
        if (
          current === mine &&
          TABLES.every((t) => mine.handlers[t].size === 0)
        )
          close();
      }, 5000);
    }
  };
}

/** Runs fn every `ms` while the tab is visible, and once when the tab comes back after being away longer than `ms`. */
export function everyWhileVisible(fn: () => void, ms: number) {
  let last = Date.now();
  const run = () => {
    last = Date.now();
    fn();
  };
  const t = setInterval(() => {
    if (!document.hidden) run();
  }, ms);
  const onVisible = () => {
    if (!document.hidden && Date.now() - last > ms) run();
  };
  document.addEventListener("visibilitychange", onVisible);
  return () => {
    clearInterval(t);
    document.removeEventListener("visibilitychange", onVisible);
  };
}

/** Runs fn when the tab becomes visible again after more than `staleMs`. No timer, so nothing runs while you are away or idle. */
export function onVisibleAfter(fn: () => void, staleMs: number) {
  let last = Date.now();
  const onVisible = () => {
    if (!document.hidden && Date.now() - last > staleMs) {
      last = Date.now();
      fn();
    }
  };
  document.addEventListener("visibilitychange", onVisible);
  return () => document.removeEventListener("visibilitychange", onVisible);
}

/** Collapses a burst of events into one call. */
export function debounce<T extends (...a: any[]) => void>(fn: T, ms: number) {
  let t: ReturnType<typeof setTimeout> | undefined;
  const wrapped = ((...a: any[]) => {
    if (t) clearTimeout(t);
    t = setTimeout(() => fn(...a), ms);
  }) as T & { cancel(): void };
  wrapped.cancel = () => {
    if (t) clearTimeout(t);
  };
  return wrapped;
}
