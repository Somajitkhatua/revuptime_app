import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  BarChart3,
  Bell,
  Building2,
  Check,
  ChevronDown,
  ChevronsUpDown,
  Cog,
  LayoutGrid,
  LogOut,
  Menu,
  MessageSquare,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Settings,
  Sparkles,
  User,
  Wrench,
  X,
} from "lucide-react";
import type { Row } from "../data";
import { authorizedDataClient } from "../data";
import { debounce, onVisibleAfter, subscribeOrg } from "../orgLive";
import { ROLE_LABEL } from "./roles";

/** The six daily destinations, in order. Setup pages live under Settings. */
export const MAIN_NAV: [string, string, typeof LayoutGrid][] = [
  ["dashboard", "Overview", LayoutGrid],
  ["assets", "Assets", Cog],
  ["alerts", "Alerts", Bell],
  ["inbox", "Inbox", MessageSquare],
  ["work_orders", "Work orders", Wrench],
  ["reports", "Reports", BarChart3],
];

/** Old setup URLs keep working by landing on their Settings page. */
export const LEGACY_ROUTES: Record<string, string> = {
  plants: "settings/plants",
  sites: "settings/plants",
  devices: "settings/gateways",
  "add-gateway": "settings/gateways/new",
  asset_documents: "settings/documents",
};
export function canonicalRoute(path: string) {
  const [view] = path.split("/");
  const to = LEGACY_ROUTES[view];
  return to || path;
}

const initials = (s: string) =>
  s
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("") || "?";

/** Live badge counts: open alerts and chats that need a person. Realtime plus a 30 s refetch. */
function useBadges(orgId: string, demo: boolean, fallbackAlerts: number) {
  const [counts, setCounts] = useState({ alerts: fallbackAlerts, inbox: 0 });
  useEffect(() => {
    if (demo || !orgId) {
      setCounts({ alerts: fallbackAlerts, inbox: 0 });
      return;
    }
    let alive = true;
    // One request returns both numbers; Realtime says when to ask again. No timer.
    const load = async () => {
      const { data, error } = await authorizedDataClient().rpc("nav_counts", {
        org_id: orgId,
      });
      if (!alive || error || !data) return;
      const d = data as { open_alerts?: number; needs_person?: number };
      setCounts({
        alerts: Number(d.open_alerts) || 0,
        inbox: Number(d.needs_person) || 0,
      });
    };
    void load();
    const refresh = debounce(() => void load(), 400);
    const off = [
      subscribeOrg(orgId, "alerts", refresh),
      subscribeOrg(orgId, "wa_conversations", refresh),
      onVisibleAfter(() => void load(), 120_000),
    ];
    return () => {
      alive = false;
      refresh.cancel();
      off.forEach((f) => f());
    };
  }, [orgId, demo, fallbackAlerts]);
  return counts;
}

function useOutside(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close]);
  return ref;
}

/** Owners, admins, managers and engineers work the Inbox; viewers do not see it. */
export const canSeeInbox = (role?: string, demo?: boolean) =>
  !!demo || ["owner", "admin", "manager", "technician"].includes(role || "");

const COLLAPSE_KEY = "sidebar:collapsed";
const readCollapsed = () => {
  try {
    const v = localStorage.getItem(COLLAPSE_KEY);
    if (v !== null) return v === "1";
  } catch {
    /* private window */
  }
  return window.innerWidth < 1100;
};

/** One shared sidebar. Expanded 232 px, collapsed 72 px (icons only); the choice survives a reload and `[` toggles it. */
function useCollapsed() {
  const [collapsed, setCollapsed] = useState(readCollapsed);
  useEffect(() => {
    document.documentElement.dataset.sidebar = collapsed
      ? "collapsed"
      : "expanded";
  }, [collapsed]);
  const toggle = () =>
    setCollapsed((c) => {
      try {
        localStorage.setItem(COLLAPSE_KEY, c ? "0" : "1");
      } catch {
        /* private window */
      }
      return !c;
    });
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (
        e.key !== "[" ||
        e.metaKey ||
        e.ctrlKey ||
        e.altKey ||
        (el &&
          (/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) ||
            el.isContentEditable))
      )
        return;
      e.preventDefault();
      toggle();
    };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, []);
  // With no saved choice the sidebar follows the window width.
  useEffect(() => {
    const on = () => {
      try {
        if (localStorage.getItem(COLLAPSE_KEY) !== null) return;
      } catch {
        /* ignore */
      }
      setCollapsed(window.innerWidth < 1100);
    };
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);
  return [collapsed, toggle] as const;
}

export function Sidebar(p: {
  view: string;
  orgId: string;
  orgs: Row[];
  onOrg: (id: string) => void;
  sites: Row[];
  siteId: string;
  onSite: (id: string) => void;
  navigate: (path: string) => void;
  userName: string;
  email?: string;
  role?: string;
  demo: boolean;
  alertFallback: number;
  onAskAI: () => void;
  onSignOut: () => void;
  onCreateWorkspace: () => void;
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  logo: ReactNode;
}) {
  const badges = useBadges(p.orgId, p.demo, p.alertFallback);
  const [collapsed, toggleCollapsed] = useCollapsed();
  const [plantMenu, setPlantMenu] = useState(false);
  const [userMenu, setUserMenu] = useState(false);
  const plantRef = useOutside(plantMenu, () => setPlantMenu(false));
  const userRef = useOutside(userMenu, () => setUserMenu(false));
  const plant = p.sites.find((s) => s.id === p.siteId);
  const go = (path: string) => {
    p.navigate(path);
    p.onClose();
    setPlantMenu(false);
    setUserMenu(false);
  };
  const settingsActive = p.view === "settings";
  const nav = MAIN_NAV.filter(
    ([key]) => key !== "inbox" || canSeeInbox(p.role, p.demo),
  );
  const badgeFor = (key: string) =>
    key === "alerts" && badges.alerts > 0 ? (
      <span
        className="rv-side-badge is-red"
        aria-label={`${badges.alerts} open alerts`}
      >
        {badges.alerts}
      </span>
    ) : key === "inbox" && badges.inbox > 0 ? (
      <span
        className="rv-side-badge is-amber"
        aria-label={`${badges.inbox} chats need a person`}
      >
        {badges.inbox}
      </span>
    ) : null;

  return (
    <>
      {p.open && (
        <div className="rv-side-scrim" onClick={p.onClose} aria-hidden="true" />
      )}
      <aside
        className={"rv-side" + (p.open ? " is-open" : "")}
        aria-label="Sidebar"
      >
        <div className="rv-side-head">
          <div className="rv-side-logo">{p.logo}</div>
          <button
            type="button"
            className="rv-side-toggle"
            onClick={toggleCollapsed}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-expanded={!collapsed}
            aria-keyshortcuts="["
            title={collapsed ? "Expand sidebar ([)" : "Collapse sidebar ([)"}
          >
            {collapsed ? (
              <PanelLeftOpen size={18} aria-hidden="true" />
            ) : (
              <PanelLeftClose size={18} aria-hidden="true" />
            )}
          </button>
        </div>
        <button
          type="button"
          className="rv-side-close rv-only-drawer"
          onClick={p.onClose}
          aria-label="Close menu"
        >
          <X size={18} />
        </button>

        {!!p.sites.length && (
          <div className="rv-side-menu-wrap" ref={plantRef}>
            <button
              type="button"
              className="rv-side-plant"
              aria-haspopup="menu"
              aria-expanded={plantMenu}
              onClick={() => setPlantMenu((v) => !v)}
              title={`Plant: ${plant?.name || "All plants"}`}
            >
              <Building2
                size={18}
                className="rv-side-plant-icon"
                aria-hidden="true"
              />
              <span className="rv-side-plant-text">
                <small>Plant</small>
                <strong>{plant?.name || "All plants"}</strong>
              </span>
              <ChevronsUpDown size={15} aria-hidden="true" />
            </button>
            {plantMenu && (
              <div
                className="rv-side-menu"
                role="menu"
                aria-label="Choose a plant"
              >
                <button
                  type="button"
                  role="menuitemradio"
                  aria-checked={!p.siteId}
                  onClick={() => {
                    p.onSite("");
                    setPlantMenu(false);
                  }}
                >
                  All plants{!p.siteId && <Check size={14} />}
                </button>
                {p.sites.map((s) => (
                  <button
                    type="button"
                    role="menuitemradio"
                    aria-checked={p.siteId === s.id}
                    key={s.id}
                    onClick={() => {
                      p.onSite(s.id);
                      setPlantMenu(false);
                    }}
                  >
                    {s.name}
                    {p.siteId === s.id && <Check size={14} />}
                  </button>
                ))}
                <hr />
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => go("settings/plants")}
                >
                  Manage plants…
                </button>
              </div>
            )}
          </div>
        )}

        <button
          type="button"
          className="rv-side-ai"
          onClick={() => {
            p.onAskAI();
            p.onClose();
          }}
          title="Ask RevUptime AI (Ctrl K)"
          aria-keyshortcuts="Control+K"
        >
          <Sparkles size={17} aria-hidden="true" />
          <span>Ask RevUptime AI</span>
          <kbd>Ctrl K</kbd>
        </button>

        <nav className="rv-side-nav" aria-label="Main navigation">
          {nav.map(([key, label, Icon]) => (
            <button
              type="button"
              key={key}
              className={"rv-side-item" + (p.view === key ? " is-active" : "")}
              aria-current={p.view === key ? "page" : undefined}
              onClick={() => go(key)}
              title={label}
            >
              <Icon size={18} aria-hidden="true" />
              <span className="rv-side-label">{label}</span>
              {badgeFor(key)}
            </button>
          ))}
        </nav>

        <div className="rv-side-bottom">
          <button
            type="button"
            className={"rv-side-item" + (settingsActive ? " is-active" : "")}
            aria-current={settingsActive ? "page" : undefined}
            onClick={() => go("settings/general")}
            title="Settings"
          >
            <Settings size={18} aria-hidden="true" />
            <span className="rv-side-label">Settings</span>
          </button>
          <div className="rv-side-menu-wrap" ref={userRef}>
            <button
              type="button"
              className="rv-side-user"
              aria-haspopup="menu"
              aria-expanded={userMenu}
              onClick={() => setUserMenu((v) => !v)}
              title={p.userName}
            >
              <span className="rv-side-avatar" aria-hidden="true">
                {initials(p.userName)}
              </span>
              <span className="rv-side-user-text">
                <strong>{p.userName}</strong>
                <small>
                  {p.demo
                    ? "Demo account"
                    : ROLE_LABEL[p.role || "member"] || p.role}
                </small>
              </span>
              <ChevronDown
                size={14}
                aria-hidden="true"
                className="rv-side-label"
              />
            </button>
            {userMenu && (
              <div
                className="rv-side-menu is-up"
                role="menu"
                aria-label="Account"
              >
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => go("settings/profile")}
                >
                  <User size={15} /> Profile
                </button>
                <p className="rv-side-menu-label">Switch workspace</p>
                {p.orgs.map((o) => (
                  <button
                    type="button"
                    role="menuitemradio"
                    aria-checked={o.organization_id === p.orgId}
                    key={o.organization_id}
                    onClick={() => {
                      p.onOrg(o.organization_id);
                      setUserMenu(false);
                    }}
                  >
                    {o.organization?.name || "Workspace"}
                    {o.organization_id === p.orgId && <Check size={14} />}
                  </button>
                ))}
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    p.onCreateWorkspace();
                    setUserMenu(false);
                  }}
                >
                  <Plus size={15} /> Create workspace
                </button>
                <hr />
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setUserMenu(false);
                    p.onSignOut();
                  }}
                >
                  <LogOut size={15} /> Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>

      <nav className="rv-tabbar" aria-label="Main navigation">
        {nav.slice(0, 4).map(([key, label, Icon]) => (
          <button
            type="button"
            key={key}
            className={p.view === key ? "is-active" : ""}
            aria-current={p.view === key ? "page" : undefined}
            onClick={() => go(key)}
          >
            <span className="rv-tabbar-icon">
              <Icon size={20} aria-hidden="true" />
              {badgeFor(key)}
            </span>
            <span>{label}</span>
          </button>
        ))}
        <button
          type="button"
          onClick={p.onOpen}
          aria-label="More: work orders, reports, settings and account"
          className={
            ["work_orders", "reports", "settings"].includes(p.view)
              ? "is-active"
              : ""
          }
        >
          <span className="rv-tabbar-icon">
            <Menu size={20} aria-hidden="true" />
          </span>
          <span>More</span>
        </button>
      </nav>
    </>
  );
}
