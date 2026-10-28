import { knowledgeRequest } from "./knowledgeRequest";
import { Sidebar, canonicalRoute } from "./onboarding/Sidebar";
import { everyWhileVisible } from "./orgLive";
import { isPlatformAdmin as rvIsPlatformAdmin } from "./onboarding/inboxApi";
import { setDisplayTimeZone } from "./onboarding/time";
import { KnowledgeSources } from "./KnowledgeSources";
import { severityLimits } from "./assetMonitoring";
import { VitalsHistory } from "./VitalsHistory";
import { signInDestination } from "./signInRoute";
import {
  useEffect as e,
  useMemo as t,
  useRef as n,
  useState as r,
  type FormEvent,
  type ReactNode,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { confirmLeave } from "./onboarding/leaveGuard";
import { localAssetDemo as i, withAssetDemo as a } from "./assetDemo";
import {
  accountEmailCredentials as o,
  AccountEmailConfirmation,
  requestAccountEmail as s,
} from "./authEmails";
import {
  Activity,
  ArrowDownToLine,
  ArrowLeft,
  ArrowRight,
  Bell,
  Building2,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Clock3,
  Cpu,
  Database,
  Factory,
  FileText,
  Gauge,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquare,
  MoreHorizontal,
  Plus,
  Radio,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Upload,
  Users,
  Wrench,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";
import c from "./schema.json";
import {
  maintenanceReply as l,
  isMaintenanceQuestion as u,
  conversationMode as d,
} from "./assistantModes";
import { aiRequest as f, indexDocument } from "./aiApi";
import {
  showReplyThenSave as p,
  normalizeChatMessages as m,
  mergePendingChat as h,
  prepareChatSessionForSave as ee,
  isGreeting as g,
  withDeadline as te,
  readBrowserChat as ne,
  saveBrowserChat as re,
} from "./chatDelivery";
import { matchesSite as ie, scopeToSite as ae } from "./siteScope";
import {
  InviteMember,
  RemoveMember,
  teamRequest as oe,
} from "./TeamInvitation";
import {
  invitedEmail as se,
  invitationAccountMatches as ce,
  finishTeamInvitation as le,
  captureInvitationEmailSignIn as ue,
} from "./teamInviteFlow";
import {
  db as _,
  authorizedDataClient as de,
  setRequestSession as fe,
  demoOrg as v,
  demoUser as pe,
  display as y,
  human as b,
  initialize as me,
  label as x,
  loadData as he,
  makeDemo as ge,
  relationTables as _e,
  resources as ve,
  type Config,
  type Dataset,
  type Row,
} from "./data";
import { lazy, Suspense } from "react";
const SettingsPage = lazy(() =>
  import("./onboarding/SettingsPage").then((m) => ({
    default: m.SettingsPage,
  })),
);
const AlertsPage = lazy(() =>
  import("./onboarding/AlertsPage").then((m) => ({ default: m.AlertsPage })),
);
const InboxPage = lazy(() =>
  import("./onboarding/InboxPage").then((m) => ({ default: m.InboxPage })),
);
const DocumentsPage = lazy(() =>
  import("./onboarding/DocumentsPage").then((m) => ({
    default: m.DocumentsPage,
  })),
);
const PlantCommand = lazy(() =>
  import("./onboarding/PlantCommand").then((m) => ({
    default: m.PlantCommand,
  })),
);
const AssetWorkspace = lazy(() =>
  import("./AssetWorkspace").then((m) => ({ default: m.AssetWorkspace })),
);
const PlantsPage = lazy(() =>
  import("./onboarding/PlantsPage").then((m) => ({ default: m.PlantsPage })),
);
const DevicesPage = lazy(() =>
  import("./onboarding/GatewaysPage").then((m) => ({
    default: m.GatewaysPage,
  })),
);
const GatewayWizard = lazy(() =>
  import("./onboarding/GatewayWizard").then((m) => ({
    default: m.GatewayWizard,
  })),
);
const AIWorkspace = lazy(() =>
  import("./AIWorkspace").then((m) => ({ default: m.AIWorkspace })),
);
const PlatformWhatsApp = lazy(() =>
  import("./onboarding/PlatformWhatsApp").then((m) => ({
    default: m.PlatformWhatsApp,
  })),
);
const NotFoundPanel = lazy(() =>
  import("./onboarding/PlatformWhatsApp").then((m) => ({
    default: m.NotFoundPanel,
  })),
);
const PlantOverview = lazy(() =>
  import("./onboarding/PlantOverview").then((m) => ({
    default: m.PlantOverview,
  })),
);
const PageLoading = () => (
  <div className="rv-page-loading" role="status" aria-live="polite">
    <span />
    <span />
    <span />
    <p className="rv-sr">Loading…</p>
  </div>
);
const ye: [string, string, LucideIcon, string][] = [
  [`dashboard`, `Overview`, LayoutDashboard, `WORKSPACE`],
  [`plants`, `Plants`, Factory, ``],
  [`assets`, `Assets`, Cpu, ``],
  [`sites`, `Sites`, Building2, ``],
  [`devices`, `Devices`, Radio, ``],
  [`sensors`, `Sensors`, Radio, ``],
  [`sensor_readings`, `Telemetry`, Activity, ``],
  [`alerts`, `Alerts`, Bell, `INTELLIGENCE`],
  [`inbox`, `Inbox`, MessageSquare, ``],
  [`ai_predictions`, `AI predictions`, Sparkles, ``],
  [`work_orders`, `Work orders`, Wrench, ``],
  [`maintenance_events`, `Maintenance`, CalendarDays, ``],
  [`ai`, `RevUpTime AI`, Sparkles, `INTELLIGENCE`],
  [`reports`, `Reports`, FileText, ``],
  [`asset_documents`, `Documents`, FileText, `KNOWLEDGE`],
  [`organization_members`, `Team`, Users, `MANAGE`],
];
const be = [
  `dashboard`,
  `plants`,
  `assets`,
  `alerts`,
  `inbox`,
  `work_orders`,
  `devices`,
  `asset_documents`,
  `ai`,
  `reports`,
];
const xe = be.map((e) => ye.find((t) => t[0] === e)!);
const Se = ye.filter((e) => !be.includes(e[0]));
const Ce: Record<string, [string, string][]> = {
  sensors: [
    [`gateways`, `Gateways`],
    [`sensors`, `Sensors`],
    [`device_status`, `Device health`],
  ],
  sensor_readings: [
    [`sensor_readings`, `Readings`],
    [`sensor_feature_windows`, `Feature windows`],
  ],
  alerts: [
    [`alerts`, `All alerts`],
    [`alert_rules`, `Alert rules`],
  ],
  work_orders: [
    [`work_orders`, `Work orders`],
    [`work_order_tasks`, `Tasks`],
    [`work_order_updates`, `Updates`],
  ],
  asset_documents: [
    [`asset_documents`, `Documents`],
    [`document_chunks`, `Indexed chunks`],
  ],
};
const we = c as Record<
  string,
  {
    columns: {
      name: string;
      type: string;
      not_null: boolean;
      default: string | null;
    }[];
    checks: {
      definition: string;
    }[];
  }
>;
const Te = (e: string) =>
  e
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, `-`)
    .replace(/^-|-$/g, ``);
const S = (e: unknown) =>
  e instanceof Error ? e.message : String((e as Row)?.message || e);
const Ee = (e: string) => {
  const t = new Date(e);
  return new Date(t.getTime() - t.getTimezoneOffset() * 6e4)
    .toISOString()
    .slice(0, 16);
};
const C = (e: string) =>
  [`active`, `online`, `good`, `completed`, `resolved`, `healthy`].includes(e)
    ? `green`
    : [`critical`, `error`, `bad`, `offline`, `urgent`].includes(e)
      ? `red`
      : [
            `warning`,
            `high`,
            `maintenance`,
            `in_progress`,
            `acknowledged`,
            `degraded`,
          ].includes(e)
        ? `amber`
        : `blue`;
function Badge({ value: e }: { value: any }) {
  return (
    <span className={`badge ` + C(String(e))}>
      <span className="badge-dot" />
      {b(String(e || `unknown`))}
    </span>
  );
}
function Logo({ small: e = false }: { small?: boolean }) {
  return (
    <div className="brand">
      <span className="brand-mark">
        <Activity size={e ? 19 : 24} />
      </span>
      {!e && (
        <span>
          rev<span className="brand-light">uptime</span>
          <span className="brand-period">.</span>
        </span>
      )}
    </div>
  );
}
function Button({
  children: e,
  onClick: t,
  secondary: n = false,
  disabled: r = false,
  type: i = `button`,
  className: a = ``,
}: {
  children: ReactNode;
  onClick?: () => void;
  secondary?: boolean;
  disabled?: boolean;
  type?: `button` | `submit`;
  className?: string;
}) {
  return (
    <button
      type={i}
      className={(n ? `button secondary` : `button`) + ` ` + a}
      onClick={t}
      disabled={r}
    >
      {e}
    </button>
  );
}
function Empty({
  icon: Icon = Database,
  title: e,
  body: t,
  action: n,
}: {
  icon?: LucideIcon;
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <span className="empty-icon">
        <Icon size={25} />
      </span>
      <h3>{e}</h3>
      <p>{t}</p>
      {n}
    </div>
  );
}
function Sparkline({
  values: e,
  color: t = `#0d6efd`,
  large: n = false,
}: {
  values: number[];
  color?: string;
  large?: boolean;
}) {
  if (e.length < 2) return <span className="muted">No trend yet</span>;
  const r = Math.min(...e),
    i = Math.max(...e),
    a = i - r || 1,
    o = e
      .map(
        (t, n) =>
          ((n / (e.length - 1)) * 300).toFixed(2) +
          `,` +
          (70 - ((t - r) / a) * 58).toFixed(2),
      )
      .join(` `);
  return (
    <svg
      viewBox="0 0 300 80"
      preserveAspectRatio="none"
      className={n ? `trend-chart` : `sparkline`}
      aria-label="Measurement trend"
      role="img"
    >
      <polyline
        points={o}
        fill="none"
        stroke={t}
        strokeWidth={n ? 1.7 : 3}
        vectorEffect="non-scaling-stroke"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
function RecordPage({
  title: t,
  children: r,
  onClose: i,
  wide: a = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const o = n<HTMLHeadingElement>(null);
  e(() => {
    window.scrollTo({ top: 0 });
    o.current?.focus();
  }, [t]);
  return (
    <section className={`record-page ` + (a ? `wide` : ``)} aria-label={t}>
      <header className="record-page-header">
        <button className="button secondary" onClick={i}>
          <ArrowLeft size={16} /> Back to workspace
        </button>
        <h1 ref={o} tabIndex={-1}>
          {t}
        </h1>
      </header>
      <div className="record-page-body">{r}</div>
    </section>
  );
}
function RelationshipSelect({
  name: e,
  value: t,
  rows: n,
  required: i,
  onChange: a,
}: {
  name: string;
  value: string;
  rows: Row[];
  required: boolean;
  onChange: (e: string) => void;
}) {
  const [o, s] = r(false),
    [c, l] = r(``);
  const u = n.find((e) => e.id === t);
  const d = n.filter((e) => x(e).toLowerCase().includes(c.toLowerCase()));
  return (
    <div className="relationship-select">
      <button
        type="button"
        aria-label={`Choose ` + b(e)}
        aria-expanded={o}
        className="relationship-trigger"
        onClick={() => {
          s(!o);
          l(``);
        }}
      >
        {u
          ? x(u)
          : t
            ? `Current selection unavailable`
            : `Choose ` + b(e) + `…`}
        <ChevronDown size={16} />
      </button>
      {o && (
        <div className="relationship-menu">
          <input
            autoFocus
            aria-label={`Search ` + b(e)}
            placeholder={`Search ` + b(e).toLowerCase() + `…`}
            value={c}
            onChange={(e) => l(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === `Escape`) {
                e.stopPropagation();
                s(false);
              }
            }}
          />
          <div role="listbox" aria-label={b(e)}>
            <button
              type="button"
              role="option"
              aria-selected={!t}
              onClick={() => {
                a(``);
                s(false);
              }}
            >
              {i ? `Choose ` + b(e) + `…` : `None`}
            </button>
            {d.map((e) => (
              <button
                type="button"
                role="option"
                aria-selected={e.id === t}
                key={e.id}
                onClick={() => {
                  a(e.id);
                  s(false);
                }}
              >
                {x(e)}
              </button>
            ))}
            {!d.length && (
              <p className="muted">
                No matching records. Add a {b(e).toLowerCase()} first.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
function RecordEditor({
  table: e,
  initial: t,
  data: n,
  userId: i,
  onSave: a,
  onClose: o,
}: {
  table: string;
  initial: Row;
  data: Dataset;
  userId: string;
  onSave: (e: Row) => Promise<void>;
  onClose: () => void;
}) {
  const s = we[e]?.columns || [];
  const c = [
    `id`,
    `organization_id`,
    `created_at`,
    `updated_at`,
    `uploaded_at`,
    `joined_at`,
    `embedding`,
    `storage_bucket`,
    `storage_path`,
    `file_size_bytes`,
    `mime_type`,
  ];
  const l = [`created_by`, `uploaded_by`, `user_id`];
  const u = s.filter((e) => !c.includes(e.name) && !l.includes(e.name));
  const d: Row = { ...t };
  for (const e of s)
    if (d[e.name] === undefined && e.default) {
      const t = e.default.match(/^'([^']*)'::/);
      if (t)
        d[e.name] =
          e.type === `jsonb` ? JSON.stringify(JSON.parse(t[1])) : t[1];
      else if (e.default === `true` || e.default === `false`)
        d[e.name] = e.default === `true`;
    }
  if (e === `work_orders` && !d.work_order_number)
    d.work_order_number =
      `WO-` +
      new Date().getFullYear() +
      `-` +
      crypto.randomUUID().slice(0, 6).toUpperCase();
  if (e === `chat_sessions`) d.user_id = i;
  const [f, p] = r<Row>(d),
    [m, h] = r(false),
    [ee, g] = r(``),
    [te, ne] = r(false);
  function re(e: string, t: string) {
    p((r) => {
      const i = { ...r, [e]: t };
      const a = (n[_e[e]] || []).find((e) => e.id === t);
      if (
        a &&
        [
          `asset_id`,
          `parent_asset_id`,
          `gateway_id`,
          `sensor_id`,
          `alert_id`,
          `work_order_id`,
        ].includes(e)
      ) {
        for (const t of [`site_id`, `asset_id`, `gateway_id`])
          if (t !== e && a[t] && s.some((e) => e.name === t)) i[t] = a[t];
      }
      if (e === `site_id`)
        for (const e of [
          `asset_id`,
          `parent_asset_id`,
          `gateway_id`,
          `sensor_id`,
        ]) {
          const r = (n[_e[e]] || []).find((t) => t.id === i[e]);
          if (r && t && r.site_id !== t) i[e] = ``;
        }
      if (e === `asset_id`) {
        const e = (n.sensors || []).find((e) => e.id === i.sensor_id);
        if (e && e.asset_id !== t) i.sensor_id = ``;
      }
      return i;
    });
  }
  const ie = [
    `asset_type`,
    `manufacturer`,
    `model`,
    `serial_number`,
    `first_name`,
    `last_name`,
    `full_name`,
    `email`,
    `phone`,
    `job_title`,
    `timezone`,
    `name`,
    `title`,
    `description`,
    `site_id`,
    `asset_id`,
    `sensor_id`,
    `gateway_id`,
    `parent_asset_id`,
    `sensor_type`,
    `measurement_type`,
    `unit`,
    `asset_code`,
    `code`,
    `gateway_code`,
    `sensor_code`,
    `status`,
    `criticality`,
    `role`,
    `priority`,
    `severity`,
    `work_order_number`,
    `work_order_id`,
    `task_number`,
    `update_type`,
    `message`,
    `user_id`,
    `assigned_to`,
    `rule_type`,
    `condition`,
    `is_active`,
    `cooldown_minutes`,
    `document_type`,
    `source_url`,
    `version`,
    `maintenance_type`,
    `event_type`,
    `performed_by`,
    `started_at`,
    `completed_at`,
  ];
  async function ae(e: FormEvent) {
    e.preventDefault();
    g(``);
    h(true);
    try {
      const e: Row = {};
      for (const n of u) {
        let r = f[n.name];
        if (r === undefined || r === ``) {
          if (n.not_null && !n.default)
            throw new Error(b(n.name) + ` is required.`);
          if (t.id) e[n.name] = null;
          continue;
        }
        if (n.type === `jsonb`) r = typeof r === `string` ? JSON.parse(r) : r;
        else if (
          [`integer`, `bigint`, `double precision`].includes(n.type) ||
          n.type.startsWith(`numeric`)
        ) {
          r = Number(r);
          if (!Number.isFinite(r))
            throw new Error(b(n.name) + ` must be a number.`);
        } else if (n.type === `timestamp with time zone`)
          r = new Date(r).toISOString();
        e[n.name] = r;
      }
      for (const n of l) if (s.some((e) => e.name === n) && !t.id) e[n] = i;
      await a(e);
      o();
    } catch (e) {
      g(S(e));
    } finally {
      h(false);
    }
  }
  function oe(t: string) {
    const n = we[e].checks.find((e) =>
      e.definition.startsWith(`CHECK ((` + t + ` = ANY`),
    );
    return n
      ? [...n.definition.matchAll(/'([^']+)'::text/g)].map((e) => e[1])
      : [];
  }
  return (
    <RecordPage
      title={
        (t.id ? `Edit ` : `Add `) +
        (ve.find((t) => t.key === e)?.singular ||
          (e === `profiles` ? `profile` : b(e)))
      }
      onClose={o}
      wide
    >
      <form onSubmit={ae}>
        <div className="form-grid">
          {u
            .filter(
              (e) => te || ie.includes(e.name) || (e.not_null && !e.default),
            )
            .map((r) => {
              const i = oe(r.name),
                a = _e[r.name],
                o = f[r.name] ?? ``,
                s = r.not_null && !r.default;
              let c;
              if (r.type === `boolean`)
                c = (
                  <RelationshipSelect
                    name={r.name}
                    required={r.not_null}
                    value={String(o)}
                    rows={[
                      { id: `true`, name: `Active` },
                      { id: `false`, name: `Paused` },
                    ]}
                    onChange={(e) =>
                      p({ ...f, [r.name]: e === `` ? `` : e === `true` })
                    }
                  />
                );
              else if (i.length)
                c = (
                  <RelationshipSelect
                    name={r.name}
                    required={r.not_null}
                    value={o}
                    rows={i.map((e) => ({ id: e, name: b(e) }))}
                    onChange={(e) => p({ ...f, [r.name]: e })}
                  />
                );
              else if (a && r.name !== `user_id`)
                c = (
                  <RelationshipSelect
                    name={r.name}
                    required={s}
                    value={o}
                    onChange={(e) => re(r.name, e)}
                    rows={(n[a] || []).filter(
                      (n) =>
                        (n.id !== t.id || a !== e) &&
                        (!f.site_id ||
                          ![`assets`, `gateways`, `sensors`].includes(a) ||
                          n.site_id === f.site_id) &&
                        (!f.asset_id ||
                          a !== `sensors` ||
                          n.asset_id === f.asset_id),
                    )}
                  />
                );
              else if (
                r.type === `jsonb` ||
                [
                  `description`,
                  `message`,
                  `completion_notes`,
                  `action_taken`,
                  `root_cause`,
                ].includes(r.name)
              )
                c = (
                  <textarea
                    required={s}
                    rows={r.type === `jsonb` ? 4 : 3}
                    value={
                      typeof o === `object` ? JSON.stringify(o, null, 2) : o
                    }
                    onChange={(e) => p({ ...f, [r.name]: e.target.value })}
                  />
                );
              else {
                const e =
                  [`integer`, `bigint`, `double precision`].includes(r.type) ||
                  r.type.startsWith(`numeric`);
                const t = r.type === `timestamp with time zone`;
                c = (
                  <input
                    required={s}
                    type={
                      e
                        ? `number`
                        : t
                          ? `datetime-local`
                          : r.type === `date`
                            ? `date`
                            : r.name === `email`
                              ? `email`
                              : `text`
                    }
                    step={e ? `any` : undefined}
                    value={t && o ? Ee(o) : o}
                    placeholder={
                      r.name === `user_id`
                        ? `Existing Supabase profile UUID`
                        : undefined
                    }
                    onChange={(e) => p({ ...f, [r.name]: e.target.value })}
                  />
                );
              }
              const l =
                r.type === `boolean` ||
                i.length > 0 ||
                (a && r.name !== `user_id`);
              return (
                <div
                  key={r.name}
                  className={
                    `form-field ` +
                    (r.type === `jsonb` ||
                    [`description`, `message`].includes(r.name)
                      ? `span-2`
                      : ``)
                  }
                >
                  <label>
                    {b(r.name)}
                    {s && <span className="required"> *</span>}
                    {l ? null : c}
                  </label>
                  {l && c}
                  {r.name === `user_id` && (
                    <small>
                      Use the profile ID of an existing signed-up user.
                    </small>
                  )}
                </div>
              );
            })}
        </div>

        {e === `maintenance_events` && (
          <div className="form-grid">
            <label>
              Before repair
              <textarea
                value={f.outcome?.before_note || ``}
                onChange={(e) =>
                  p({
                    ...f,
                    outcome: {
                      ...(typeof f.outcome === `object` ? f.outcome : {}),
                      before_note: e.target.value,
                    },
                  })
                }
              />
            </label>
            <label>
              After repair
              <textarea
                value={f.outcome?.after_note || ``}
                onChange={(e) =>
                  p({
                    ...f,
                    outcome: {
                      ...(typeof f.outcome === `object` ? f.outcome : {}),
                      after_note: e.target.value,
                    },
                  })
                }
              />
            </label>
          </div>
        )}
        <button
          className="text-button advanced-toggle"
          type="button"
          onClick={() => ne(!te)}
        >
          {te ? `Hide` : `Show`} advanced fields <ChevronDown size={14} />
        </button>

        {ee && (
          <p className="form-error" role="alert">
            {ee}
          </p>
        )}
        <footer className="modal-footer">
          <Button secondary onClick={o}>
            Cancel
          </Button>
          <Button type="submit" disabled={m}>
            {m
              ? `Saving…`
              : `Save ` + (ve.find((t) => t.key === e)?.singular || `profile`)}
          </Button>
        </footer>
      </form>
    </RecordPage>
  );
}
function Auth({
  config: t,
  onDemo: n,
  onSession: i,
  recovery: a,
  onRecovered: o,
  invitationEmail: c = ``,
  onInvitationLink: l,
}: {
  config: Config | null;
  onDemo: () => void;
  onSession: (e: Session) => void;
  recovery: boolean;
  onRecovered: () => void;
  invitationEmail?: string;
  onInvitationLink?: () => Promise<string>;
}) {
  const [u, d] = r<`login` | `signup` | `forgot` | `recover`>(
      a ? `recover` : `login`,
    ),
    [f, p] = r(false),
    [m, h] = r(``),
    [ee, g] = r(``);
  e(() => {
    if (a) d(`recover`);
  }, [a]);
  async function te(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!_) {
      h(`The live workspace is not configured yet. You can explore the demo.`);
      return;
    }
    p(true);
    h(``);
    g(``);
    const n = new FormData(e.currentTarget),
      r = String(n.get(`email`) || ``),
      a = String(n.get(`password`) || ``);
    try {
      if (u === `signup`) {
        if (t?.authEmailProvider === `resend`)
          g(
            await s(`signup`, {
              email: r,
              password: a,
              full_name: String(n.get(`full_name`) || ``),
            }),
          );
        else {
          const { data: e, error: t } = await _.auth.signUp({
            email: r,
            password: a,
            options: {
              data: { full_name: n.get(`full_name`) },
              emailRedirectTo: location.origin + `/auth/callback`,
            },
          });
          if (t) throw t;
          if (e.session) i(e.session);
          else g(`Check your email to confirm your account, then sign in.`);
        }
      } else if (u === `forgot`) {
        if (t?.authEmailProvider === `resend`)
          g(await s(`recovery`, { email: r }));
        else {
          const { error: e } = await _.auth.resetPasswordForEmail(r, {
            redirectTo: location.origin + `/auth/callback`,
          });
          if (e) throw e;
          g(`If this account exists, you’ll receive a password reset link.`);
        }
      } else if (u === `recover`) {
        const { error: e } = await _.auth.updateUser({ password: a });
        if (e) throw e;
        o();
        g(`Your password has been updated.`);
      } else {
        const { data: e, error: t } = await _.auth.signInWithPassword({
          email: r,
          password: a,
        });
        if (t) throw t;
        if (e.session) i(e.session);
      }
    } catch (e) {
      h(S(e));
    } finally {
      p(false);
    }
  }
  const ne =
    u === `signup`
      ? `Your next chapter in uptime.`
      : u === `forgot`
        ? `Reset your password.`
        : u === `recover`
          ? `Choose a new password.`
          : `Welcome back.`;
  return (
    <div className="auth-page">
      <a href="https://revuptime.com/" className="back-link">
        <ArrowLeft size={15} /> Back to home
      </a>
      <section className="auth-story">
        <div className="brand official-auth-logo">
          <span className="official-logo-crop">
            <img
              src="/images/revuptime-brand-transparent.png"
              alt="RevUpTime"
              width="1448"
              height="1086"
            />
          </span>
        </div>
        <div className="auth-story-content">
          <span className="eyebrow">
            <span className="live-dot" /> BUILT FOR RELIABILITY
          </span>
          <h1>
            Less downtime.
            <br />
            More possibility.
          </h1>
          <p>
            Bring your assets, signals, and maintenance teams into one connected
            workspace.
          </p>
          <div className="auth-illustration">
            <div className="illustration-grid" />
            <div className="illustration-card">
              <span>
                <Activity size={18} /> ASSET HEALTH
              </span>
              <div className="illustration-metric">
                In focus
                <span className="illustration-pill">Connected operations</span>
              </div>
              <Sparkline
                values={[2, 3, 2.7, 4, 3.8, 5, 4.6, 6, 5.8, 7, 6.7, 8]}
                color="#45beff"
                large
              />
              <div className="illustration-bottom">
                <span>
                  <ShieldCheck size={15} /> Organization-scoped access
                </span>
                <span>
                  <CheckCircle2 size={15} /> Clear priorities
                </span>
              </div>
            </div>
            <div className="float-chip">
              <Zap size={18} /> Insight to action
            </div>
          </div>
          <div className="auth-benefits">
            <span>
              <Radio size={18} /> Monitor signals
            </span>
            <span>
              <Wrench size={18} /> Plan maintenance
            </span>
            <span>
              <Users size={18} /> Work together
            </span>
          </div>
        </div>
        <div className="auth-story-footer">
          RELIABILITY, REIMAGINED.<span>revuptime.com</span>
        </div>
      </section>

      <section className="auth-form-panel">
        <div className="auth-mobile-logo">
          <div className="brand official-auth-logo">
            <span className="official-logo-crop">
              <img
                src="/images/revuptime-brand-transparent.png"
                alt="RevUpTime"
                width="1448"
                height="1086"
              />
            </span>
          </div>
        </div>
        <div className="auth-form-wrap">
          <span className="eyebrow light">YOUR OPERATIONS WORKSPACE</span>
          <h2>{ne}</h2>
          <p>
            {u === `login`
              ? `Sign in to keep your operations moving.`
              : u === `signup`
                ? `Create your account. Connect your organization.`
                : u === `forgot`
                  ? `We’ll send a reset link to your email.`
                  : `Use at least eight characters.`}
          </p>

          {c && (
            <div className="workspace-note">
              Your team invitation is for {c}. Sign in with this address. If you
              do not have a password, use the email link below.
            </div>
          )}

          {c && l && (
            <Button
              secondary
              disabled={f}
              onClick={async () => {
                p(true);
                h(``);
                g(``);
                try {
                  g(await l());
                } catch (e) {
                  h(S(e));
                } finally {
                  p(false);
                }
              }}
            >
              {f ? `Please wait…` : `Email me an invitation sign-in link`}
            </Button>
          )}

          <form onSubmit={te}>
            {u === `signup` && (
              <label>
                Full name
                <input
                  name="full_name"
                  autoComplete="name"
                  required
                  placeholder="Your name"
                />
              </label>
            )}
            {u !== `recover` && (
              <label>
                Work email
                <input
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  defaultValue={c}
                  placeholder="you@company.com"
                />
              </label>
            )}
            {u !== `forgot` && (
              <label>
                <span className="label-line">
                  Password
                  {u === `login` && (
                    <button
                      type="button"
                      className="text-button"
                      onClick={() => {
                        d(`forgot`);
                        h(``);
                        g(``);
                      }}
                    >
                      Forgot password?
                    </button>
                  )}
                </span>
                <input
                  name="password"
                  type="password"
                  minLength={u === `login` ? undefined : 8}
                  autoComplete={
                    u === `login` ? `current-password` : `new-password`
                  }
                  required
                  placeholder={
                    u === `signup`
                      ? `At least 8 characters`
                      : `Enter your password`
                  }
                />
              </label>
            )}

            {m && (
              <p className="form-error" role="alert">
                {m}
              </p>
            )}
            {ee && (
              <p className="form-success" role="status">
                {ee}
              </p>
            )}
            <Button type="submit" disabled={f}>
              {f
                ? `Please wait…`
                : u === `signup`
                  ? `Create account`
                  : u === `forgot`
                    ? `Send reset link`
                    : u === `recover`
                      ? `Update password`
                      : `Sign in`}{" "}
              <ArrowRight size={16} />
            </Button>
          </form>

          <p className="auth-switch">
            {u === `login` ? (
              <>
                New to Revuptime?{" "}
                <button
                  className="text-button"
                  onClick={() => {
                    d(`signup`);
                    h(``);
                    g(``);
                  }}
                >
                  Create an account
                </button>
              </>
            ) : (
              <button
                className="text-button"
                onClick={() => {
                  d(`login`);
                  h(``);
                  g(``);
                }}
              >
                Back to sign in
              </button>
            )}
          </p>

          {false && !c && (
            <>
              <div className="auth-divider">
                <span>Take a look around</span>
              </div>
              <Button secondary className="demo-button" onClick={n}>
                <Gauge size={17} /> Explore demo workspace{" "}
                <ArrowRight size={16} />
              </Button>
              <p className="demo-explainer">
                Sample equipment and signals. No account needed.
              </p>
            </>
          )}

          {!t?.supabaseKey && (
            <p className="muted">
              Live authentication will be available when the deployment is
              configured.
            </p>
          )}
        </div>
        <footer>
          © {new Date().getFullYear()} Revuptime{" "}
          <a href="https://revuptime.com/privacy">Privacy</a>
        </footer>
      </section>
    </div>
  );
}
function Onboarding({
  onCreate: e,
  onSignOut: t,
}: {
  onCreate: (e: string, t: string, n: string) => Promise<void>;
  onSignOut: () => void;
}) {
  const [n, i] = r(``),
    [a, o] = r(``),
    [s, c] = r(false),
    [l, u] = r(``);
  return (
    <div className="onboarding">
      <Logo />
      <section className="onboarding-card">
        <span className="empty-icon">
          <Building2 size={28} />
        </span>
        <span className="eyebrow light">
          ONE WORKSPACE. YOUR WHOLE OPERATION.
        </span>
        <h1>Make yourself at home.</h1>
        <p>
          Create an organization to start connecting your sites, assets, and
          team.
        </p>
        <form
          onSubmit={async (t) => {
            t.preventDefault();
            c(true);
            try {
              await e(
                n,
                a,
                String(new FormData(t.currentTarget).get(`industry`) || ``),
              );
            } catch (e) {
              u(S(e));
            } finally {
              c(false);
            }
          }}
        >
          <label>
            Organization name
            <input
              required
              minLength={2}
              maxLength={120}
              value={n}
              onChange={(e) => {
                i(e.target.value);
                o(Te(e.target.value));
              }}
              placeholder="Your company name"
            />
          </label>
          <label>
            Workspace slug
            <input
              required
              pattern="[a-z0-9]+(-[a-z0-9]+)*"
              maxLength={80}
              value={a}
              onChange={(e) => o(e.target.value)}
              placeholder="your-company"
            />
          </label>
          <label>
            Industry
            <select name="industry">
              <option value="">Select an industry</option>
              {[
                `Manufacturing`,
                `Energy`,
                `Food & beverage`,
                `Pharmaceuticals`,
                `Mining`,
                `Chemicals`,
                `Other`,
              ].map((e) => (
                <option key={e}>{e}</option>
              ))}
            </select>
          </label>
          {l && <p className="form-error">{l}</p>}
          <Button type="submit" disabled={s}>
            {s ? `Creating workspace…` : `Create workspace`}
            <ArrowRight size={16} />
          </Button>
        </form>
        <button className="text-button" onClick={t}>
          Sign out
        </button>
      </section>
    </div>
  );
}
function Overview({
  data,
  site,
  navigate,
  onInspect,
  onCreateOrder,
}: {
  data: Dataset;
  site: string;
  navigate: (page: string) => void;
  onInspect: (table: string, row: Row) => void;
  onCreateOrder: (asset?: Row) => void;
}) {
  const [sensorId, setSensorId] = r("");
  const [days, setDays] = r(30);
  const sensors = (data.sensors || []).filter((sensor) =>
    ie("sensors", sensor, site, data),
  );
  const sensor = sensors.find((sensor) => sensor.id === sensorId) || sensors[0];
  const asset = (data.assets || []).find(
    (asset) => asset.id === sensor?.asset_id,
  );
  const readings = (data.sensor_readings || []).filter(
    (row) => row.sensor_id === sensor?.id,
  );
  const alerts = (data.alerts || []).filter(
    (row) =>
      (asset && row.asset_id === asset.id) ||
      (sensor && row.sensor_id === sensor.id),
  );
  return (
    <>
      <PlantOverview
        data={data}
        site={site}
        onOpenAsset={(id) => {
          history.pushState(
            null,
            ``,
            `/assets/` + encodeURIComponent(id) + `/overview`,
          );
          window.dispatchEvent(new PopStateEvent(`popstate`));
        }}
      />
      <div className="pm-sensor-picker">
        <label>
          Machine sensor{" "}
          <select
            value={sensor?.id || ""}
            onChange={(event) => setSensorId(event.target.value)}
          >
            {!sensors.length && <option value="">No registered sensors</option>}
            {sensors.map((sensor) => (
              <option key={sensor.id} value={sensor.id}>
                {x(sensor)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <VitalsHistory
        sensor={sensor}
        gateway={(data.gateways || []).find(
          (row) => row.id === sensor?.gateway_id,
        )}
        baselines={data.sensor_baselines || []}
        baselineError={data.baseline_errors?.[0]?.message}
        velocityLimit={
          asset
            ? severityLimits(asset, data.vibration_severity_limits || [])
                ?.zone_b_max
            : undefined
        }
        velocityLimitCD={
          asset
            ? severityLimits(asset, data.vibration_severity_limits || [])
                ?.zone_c_max
            : undefined
        }
        key={sensor?.id || "none"}
        readings={readings}
        asset={asset}
        alerts={alerts}
        from={new Date(Date.now() - days * 86400000).toISOString()}
        to={new Date().toISOString()}
        onDays={setDays}
        onAsk={() => navigate("ai")}
        onWorkOrder={() => onCreateOrder(asset)}
      />
    </>
  );
}
export default function App() {
  e(() => {
    for (const key of ["revuptime-demo", "revuptime-demo-data"]) {
      localStorage.removeItem(key);
      sessionStorage.removeItem(key);
    }
  }, []);
  const [i, a] = r(() => o(location.href));
  const [s, c] = r(() => {
    const e = new URL(location.href);
    const t = e.searchParams.get(`team_invite`);
    if (t) {
      if (t !== sessionStorage.getItem(`revuptime-team-invite`))
        sessionStorage.removeItem(`revuptime-invite-email`);
      sessionStorage.setItem(`revuptime-team-invite`, t);
      sessionStorage.removeItem(`revuptime-demo`);
      e.searchParams.delete(`team_invite`);
      history.replaceState(null, ``, e.pathname + e.search + e.hash);
    }
    return t || sessionStorage.getItem(`revuptime-team-invite`) || ``;
  });
  const [v, _e] = r(() => {
    const e = ue(location.href, sessionStorage);
    history.replaceState(null, ``, e.cleanURL);
    return e.credentials;
  });
  const [be, Te] = r(false),
    [Ee, C] = r(``),
    [De, Oe] = r(``);
  const [ke, Ae] = r<Row | null>(null);
  const [je, Me] = r<Config | null>(null),
    [Ne, Pe] = r(true),
    [w, T] = r<Session | null>(null),
    [E, Fe] = r(false),
    [Ie, Le] = r(false);
  const Re = se(s),
    ze = ce(w?.user.email || ``, Re);
  const [Be, Ve] = r(``),
    [He, Ue] = r(``);
  const [Ge, Ke] = r<Row[]>([]),
    [D, O] = r(``),
    [k, j] = r<Dataset>({}),
    [qe, Je] = r(false),
    [M, Ye] = r(() => {
      const raw = location.hash.slice(1);
      const canon = canonicalRoute(raw);
      if (!location.pathname.startsWith(`/assets`) && canon !== raw)
        history.replaceState(null, ``, `#` + canon);
      const e = location.pathname.startsWith(`/assets`)
        ? `assets`
        : canon.split(`/`)[0] || `dashboard`;
      return [`insights`, `knowledge`].includes(e) ? `dashboard` : e;
    }),
    [Xe, Ze] = r(``),
    [N, Qe] = r(``),
    [P, $e] = r(``),
    [et, tt] = r(`all`),
    [nt, rt] = r(false),
    [F, it] = r<{
      text: string;
      error?: boolean;
    } | null>(null),
    [L, z] = r<{
      table: string;
      row: Row;
      edit: boolean;
    } | null>(null),
    [at, ot] = r(false),
    [st, ct] = r(false);
  const [B, V] = r(``),
    [lt, H] = r(``),
    [ut, dt] = r(false);
  e(() => Ae(null), [D, E, w?.user.id, M]);
  const [U, ft] = r(``);
  e(() => {
    if ([`ai`, `chat`].includes(M)) {
      V(`new`);
      ft(``);
      H(``);
      q(``);
      wt(``);
    }
  }, [M]);
  const [chatMode, setChatMode] = r(`workspace`);
  const [aiDrawer, setAiDrawer] = r(false);
  e(() => {
    const onKey = (ev: KeyboardEvent) => {
      if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === `k`) {
        ev.preventDefault();
        setAiDrawer((v) => !v);
      } else if (ev.key === `Escape`) setAiDrawer(false);
    };
    window.addEventListener(`keydown`, onKey);
    return () => window.removeEventListener(`keydown`, onKey);
  }, []);
  const [W, pt] = r<Row | null>(null),
    [mt, ht] = r(false);
  e(() => {
    pt(null);
    ht(false);
    if (!E && D)
      f(`status`, { organization_id: D })
        .then((e) => {
          pt(e);
          ht(e.configured && e.live_data_allowed);
        })
        .catch(() => {});
  }, [D, E]);
  const G = t(() => ae(k, P), [k, P]);
  const K = M === `ai` || aiDrawer || (!E && !(G.assets || []).length);
  const gt = (k.sites || []).find((e) => e.id === P);
  const _t =
    B === `new`
      ? undefined
      : (G.chat_sessions || []).find(
          (e) => e.id === (B || (G.chat_sessions || [])[0]?.id),
        );
  function vt(e: string) {
    $e(e);
    Qe(``);
    tt(`all`);
    z(null);
    ot(false);
    V(`new`);
    ft(``);
    H(``);
    q(``);
  }
  const [yt, bt] = r(false);
  const xt = n<HTMLDivElement>(null);
  e(() => {
    if (!yt) return;
    xt.current?.querySelector<HTMLElement>(`[role="menuitem"]`)?.focus();
    const e = (e: PointerEvent) => {
      if (!xt.current?.contains(e.target as Node)) bt(false);
    };
    const t = (e: KeyboardEvent) => {
      if (e.key === `Escape`) {
        bt(false);
        xt.current
          ?.querySelector<HTMLButtonElement>(`.navbar-settings`)
          ?.focus();
      }
    };
    document.addEventListener(`pointerdown`, e);
    document.addEventListener(`keydown`, t);
    return () => {
      document.removeEventListener(`pointerdown`, e);
      document.removeEventListener(`keydown`, t);
    };
  }, [yt]);
  const [St, q] = r(``),
    [Ct, wt] = r(``),
    [Tt, Et] = r(``),
    [Dt, Ot] = r(0);
  const kt = n<AbortController | null>(null);
  e(() => {
    if (!Tt) return;
    Ot(0);
    const e = Date.now(),
      t = setInterval(() => Ot(Math.floor((Date.now() - e) / 1e3)), 1e3);
    return () => clearInterval(t);
  }, [Tt]);
  const jt = n(new Map<string, Row>()),
    Mt = n(new Map<string, Row[]>());
  const Nt = (e: Dataset) => {
    const t = ne(localStorage, D, J);
    return h(
      e,
      [...t.sessions, ...jt.current.values()],
      [...t.messages, ...[...Mt.current.values()].flat()],
    );
  };
  const Pt = n<HTMLDivElement>(null);
  e(() => {
    if (Pt.current) Pt.current.scrollTop = Pt.current.scrollHeight;
  }, [k.chat_messages, B, M, Tt]);
  e(() => {
    V(``);
    H(``);
    ft(``);
    q(``);
    jt.current.clear();
    Mt.current.clear();
  }, [D]);
  e(() => {
    ft(_t?.asset_id || ``);
  }, [B, _t?.id, _t?.asset_id, P]);
  const rvFull = n(false);
  const [rvStaff, setRvStaff] = r(false);
  e(() => {
    if (E || !D) {
      setRvStaff(false);
      return;
    }
    let on = true;
    rvIsPlatformAdmin()
      .then((v) => on && setRvStaff(v))
      .catch(() => on && setRvStaff(false));
    return () => {
      on = false;
    };
  }, [D, E, w?.user.id]);
  e(() => {
    rvFull.current = false;
  }, [D, E]);
  e(() => {
    if (!E && D && ![`dashboard`, `assets`].includes(M) && !rvFull.current)
      void Zload(false);
  }, [M]);
  const Ft = n(0),
    It = n(0),
    J = E ? pe : w?.user.id || ``;
  const Lt = n(``);
  Lt.current = D + `:` + J;
  e(() => {
    if (!E && D && J && Ge.some((e) => e.organization_id === D))
      localStorage.setItem(`revuptime-selected-org:` + J, D);
  }, [D, J, E, Ge]);
  const Y = (e: string, t = false) => it({ text: e, error: t });
  e(() => {
    if (!F) return;
    const e = setTimeout(() => it(null), 6500);
    return () => clearTimeout(e);
  }, [F]);
  e(() => {
    let e = true;
    let t: (() => void) | undefined;
    me()
      .then(async (n) => {
        if (!e) return;
        Me(n);
        if (_) {
          const { data: n, error: r } = await _.auth.getSession();
          if (r) throw r;
          if (!e) return;
          fe(n.session);
          T(n.session);
          const { data: i } = _.auth.onAuthStateChange((e, t) => {
            fe(t);
            if (!t) {
              ++Ft.current;
              ++It.current;
              j({});
              Ke([]);
              O(``);
            }
            T(t);
            if (e === `PASSWORD_RECOVERY`) Le(true);
          });
          t = () => i.subscription.unsubscribe();
        }
        Pe(false);
      })
      .catch((t) => {
        if (e) {
          Y(S(t), true);
          Pe(false);
        }
      });
    return () => {
      e = false;
      t?.();
    };
  }, []);
  e(() => {
    if (!s || !w || v || !_) return;
    let e = true;
    _.auth.getUser().then(({ data: t, error: n }) => {
      if (!e) return;
      if (n) {
        C(
          `Could not check your current sign-in. Retry acceptance or request a fresh invitation email.`,
        );
        return;
      }
      if (t.user)
        T((e) => (e?.user.id === t.user.id ? { ...e, user: t.user } : e));
    });
    return () => {
      e = false;
    };
  }, [s, w?.user.id, v?.token_hash]);
  async function Rt(e?: string, t: Session | null = w) {
    if (!_ || !t) throw new Error(`Please sign in again.`);
    const n = ++It.current;
    const { data: r, error: i } = await _.from(`organization_members`)
      .select(`*,organization:organizations(*)`)
      .eq(`user_id`, t.user.id)
      .eq(`status`, `active`)
      .abortSignal(AbortSignal.timeout(12e3));
    if (n !== It.current) {
      if (e)
        throw new Error(
          `Your sign-in session changed while joining. Please retry acceptance.`,
        );
      return;
    }
    if (i) throw i;
    if (e && !r?.some((t) => t.organization_id === e && t.organization))
      throw new Error(
        `Your invitation was accepted, but the team could not be loaded. Please retry; your invitation is still available.`,
      );
    Ke(r || []);
    if (r?.length)
      O(
        (n) =>
          e ||
          (r.some((e) => e.organization_id === n)
            ? n
            : r.find(
                (e) =>
                  e.organization_id ===
                  localStorage.getItem(`revuptime-selected-org:` + t.user.id),
              )?.organization_id || r[0].organization_id),
      );
    else O(``);
  }
  e(() => {
    if (E) {
      return;
    }
    ++Ft.current;
    ++It.current;
    j({});
    Ke([]);
    O(``);
    Ve(``);
    if (w && _) {
      Je(true);
      Rt()
        .catch((e) => {
          Ve(S(e));
          Y(S(e), true);
        })
        .finally(() => Je(false));
    }
  }, [E, w?.user.id]);
  function Z() {
    return Zload(true);
  }
  async function Zload(force: boolean) {
    if (E || !D) return;
    const e = ++Ft.current;
    Je(true);
    Ue(``);
    try {
      const full = rvFull.current || ![`dashboard`, `assets`].includes(M);
      if (full) rvFull.current = true;
      const t = await te(
        he(D, J, full ? { force } : { force, shell: true }),
        25e3,
        `Workspace loading timed out. General guidance is available; use Refresh workspace to retry loading your records.`,
      );
      if (e === Ft.current) j(Nt(t));
    } catch (e) {
      Ue(S(e));
      Y(S(e), true);
    } finally {
      if (e === Ft.current) Je(false);
    }
  }
  e(() => {
    $e(``);
    Qe(``);
    tt(`all`);
    if (!E) {
      const e = ne(localStorage, D, J);
      j({ chat_sessions: e.sessions, chat_messages: e.messages });
      void Zload(false);
    }
  }, [D, E]);
  e(() => {
    // Only the pages that read live data from the shared dataset need it kept fresh. Every other page loads its own data
    // and listens to the shared Realtime channel, so nothing is polled for them.
    if (E || !D || !_ || ![`reports`, `ai`, `chat`].includes(M)) return;
    let alive = true,
      busy = false;
    const key = D + `:` + J;
    const run = async () => {
      if (!alive || busy) return;
      busy = true;
      try {
        const t = await te(
          he(D, J, {
            only: [`alerts`, `device_status`, `sensor_readings`],
            force: true,
          }),
          25e3,
          `Live data timed out.`,
        );
        if (alive && Lt.current === key) j((e) => ({ ...e, ...t }));
      } catch {
      } finally {
        busy = false;
      }
    };
    const off = everyWhileVisible(() => void run(), 6e4);
    return () => {
      alive = false;
      off();
    };
  }, [D, E, M]);
  e(() => {
    if (E && Object.keys(k).length)
      localStorage.setItem(`revuptime-demo-data`, JSON.stringify(k));
  }, [k, E]);
  const zt = Ge.find((e) => e.organization_id === D),
    Bt = zt?.organization,
    Vt = [`owner`, `admin`].includes(zt?.role),
    Ht = (k.profiles || []).find((e) => e.id === J);
  e(() => {
    setDisplayTimeZone(
      Ht?.timezone ||
        (k.sites || []).find((x) => x.id === P)?.timezone ||
        Bt?.timezone ||
        `Asia/Kolkata`,
    );
  }, [Ht?.timezone, P, k.sites, Bt?.timezone]);
  e(() => {
    if (
      !E &&
      D &&
      M === `inbox` &&
      zt?.role &&
      ![`owner`, `admin`, `manager`, `technician`].includes(zt.role)
    )
      Ut(`dashboard`);
  }, [M, D, E, zt?.role]);
  e(() => {
    if (
      !E &&
      D &&
      !qe &&
      Array.isArray(k.sites) &&
      !k.sites.length &&
      M === `dashboard`
    )
      Ut(`plants`);
  }, [E, D, qe, k.sites, M]);
  const rvCanWrite = [`owner`, `admin`, `manager`, `technician`].includes(
      zt?.role,
    ),
    rvCanManage = [`owner`, `admin`, `manager`].includes(zt?.role),
    rvGatewaySite = (id: string) => {
      try {
        sessionStorage.setItem(`revuptime-add-gateway-site`, id);
      } catch {}
      Ut(`settings/gateways/new`);
    };
  const Q = Xe || Ce[M]?.[0]?.[0] || M,
    $ = ve.find((e) => e.key === Q);
  function Ut(e: string) {
    if (!confirmLeave()) return;
    e = canonicalRoute(e);
    if (e === `ai`) {
      setAiDrawer(true);
      return;
    }
    bt(false);
    Ae(null);
    history.pushState(
      null,
      ``,
      location.pathname.startsWith(`/assets`) ? `/mvp#` + e : `#` + e,
    );
    Ye(e.split(`/`)[0]);
    Ze(``);
    z(null);
    ot(false);
    Qe(``);
    tt(`all`);
    rt(false);
    window.scrollTo({ top: 0 });
  }
  e(() => {
    const e = () => {
      const raw = location.hash.slice(1);
      const canon = canonicalRoute(raw);
      if (!location.pathname.startsWith(`/assets`) && canon !== raw)
        history.replaceState(null, ``, `#` + canon);
      const e = location.pathname.startsWith(`/assets`)
        ? `assets`
        : canon.split(`/`)[0] || `dashboard`;
      Ye(
        ye.some((t) => t[0] === e) ||
          [`chat`, `settings`, `add-gateway`].includes(e)
          ? e
          : `dashboard`,
      );
      Ze(``);
      z(null);
      ot(false);
      rt(false);
    };
    window.addEventListener(`popstate`, e);
    window.addEventListener(`hashchange`, e);
    return () => {
      window.removeEventListener(`popstate`, e);
      window.removeEventListener(`hashchange`, e);
    };
  }, []);
  async function Wt() {
    fe(null);
    ++Ft.current;
    ++It.current;
    sessionStorage.removeItem(`revuptime-demo`);
    Fe(false);
    T(null);
    j({});
    Ke([]);
    O(``);
    if (_) await _.auth.signOut();
  }
  async function Gt(e: string, t: string, n: string) {
    if (!_) throw new Error(`Supabase is not configured.`);
    const { data: r, error: i } = await _.rpc(`revuptime_create_workspace`, {
      p_name: e,
      p_slug: t,
      p_industry: n,
    });
    if (i) throw i;
    await Rt();
    O(r);
    ot(false);
    Y(`Your organization is ready. Add your first site.`);
  }
  function Kt() {
    return;
  }
  async function qt(e: string, t: Row, n?: Row) {
    if (e === `alerts` && t.status === `resolved`) t = { ...t, resolved_by: J };
    if (E) {
      const r = {
        ...n,
        ...t,
        id: n?.id || crypto.randomUUID(),
        organization_id: D,
        created_at: n?.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      j((t) => ({
        ...t,
        [e]: n
          ? (t[e] || []).map((e) => (e.id === n.id ? r : e))
          : [r, ...(t[e] || [])],
      }));
      Y(`Saved in your demo workspace.`);
      return r;
    }
    if (!_) throw new Error(`Supabase is not configured.`);
    const r = { ...t };
    if (we[e]?.columns.some((e) => e.name === `organization_id`))
      r.organization_id = D;
    const i = n
      ? await _.from(e).update(r).eq(`id`, n.id).select(`id`)
      : await _.from(e).insert(r).select(`id`);
    if (i.error) throw i.error;
    if (!i.data?.length)
      throw new Error(
        `This change was not permitted by your organization’s access rules.`,
      );
    await Z();
    Y(`Saved successfully.`);
    return { ...n, ...r, id: i.data[0].id };
  }
  async function Jt(e: string, t: string) {
    if (E)
      throw new Error(
        `Preview only: sign in to a connected workspace to send email invitations.`,
      );
    if (!_) throw new Error(`Supabase is not configured.`);
    const { data: n } = await _.auth.getSession();
    if (!n.session) throw new Error(`Please sign in again.`);
    const r = await oe(
      `invite`,
      { email: e, role: t, organization_id: D },
      n.session.access_token,
    );
    void Z();
    return r.message;
  }
  function Yt(e: Row) {
    return (
      Vt &&
      e.organization_id === D &&
      e.user_id !== J &&
      e.role !== `owner` &&
      e.status !== `inactive` &&
      (e.role !== `admin` || zt?.role === `owner`)
    );
  }
  async function Xt(e: Row) {
    if (!Yt(e)) throw new Error(`You cannot remove this membership.`);
    if (E) {
      await qt(`organization_members`, { status: `inactive` }, e);
      Y(`Member removed from this demo team. Their records are preserved.`);
    } else {
      if (!_) throw new Error(`Supabase is not configured.`);
      const { data: t } = await _.auth.getSession();
      if (!t.session) throw new Error(`Please sign in again.`);
      const n = await oe(
        `remove`,
        { organization_id: D, member_id: e.id },
        t.session.access_token,
      );
      await Z();
      Y(n.message);
    }
    Ae(null);
    z(null);
  }
  async function Zt() {
    Te(true);
    C(``);
    Oe(``);
    try {
      if (!_) throw new Error(`Supabase is not configured.`);
      let e: Session | null;
      if (v) {
        const { data: t, error: n } = await _.auth.verifyOtp(v);
        if (n)
          throw new Error(
            `This email sign-in link has expired or was already used. Request a fresh invitation email below.`,
          );
        if (!t.session)
          throw new Error(
            `Email verification did not create a sign-in session. Request a fresh invitation email.`,
          );
        e = t.session;
        sessionStorage.removeItem(`revuptime-invite-email`);
        _e(null);
        T(e);
      } else {
        const { data: t, error: n } = await _.auth.getSession();
        if (n) throw n;
        e = t.session;
      }
      if (!e) throw new Error(`Please sign in again.`);
      const t = e;
      await le(
        () => oe(`accept`, { token: s }, t.access_token),
        (e) => Rt(e, t),
        (e) => {
          sessionStorage.removeItem(`revuptime-team-invite`);
          c(``);
          O(e.organization_id);
          Ut(`dashboard`);
          Y(e.message);
        },
      );
    } catch (e) {
      C(S(e));
    } finally {
      Te(false);
    }
  }
  async function Qt() {
    const e = await oe(`sign-in`, { token: s });
    return e.message;
  }
  async function $t() {
    Te(true);
    C(``);
    Oe(``);
    try {
      Oe(await Qt());
    } catch (e) {
      C(S(e));
    } finally {
      Te(false);
    }
  }
  async function en() {
    Te(true);
    C(``);
    try {
      if (_) {
        const { error: e } = await _.auth.signOut({ scope: `local` });
        if (e) throw e;
      }
      sessionStorage.removeItem(`revuptime-demo`);
      Fe(false);
      T(null);
      j({});
      Ke([]);
      O(``);
    } catch (e) {
      C(S(e));
    } finally {
      Te(false);
    }
  }
  async function tn(e: Row) {
    try {
      await qt(
        `alerts`,
        {
          status: `acknowledged`,
          acknowledged_at: new Date().toISOString(),
          acknowledged_by: J,
        },
        e,
      );
      z(null);
    } catch (e) {
      Y(S(e), true);
    }
  }
  const nn = t(
    () =>
      (k[Q] || []).filter(
        (e) =>
          ie(Q, e, P, k) &&
          (et === `all` || e.status === et || e.severity === et) &&
          (!N ||
            Object.entries(e).some(([e, t]) =>
              y(t, e, k).toLowerCase().includes(N.toLowerCase()),
            )),
      ),
    [k, Q, P, et, N],
  );
  function rn() {
    if (!$) return;
    const e = [...$.columns];
    const t = (e: string) => `"` + e.replaceAll(`"`, `""`) + `"`;
    const n = [
      e.map(b).map(t).join(`,`),
      ...nn.map((n) =>
        e
          .map((e) => {
            const r = y(n[e], e, k);
            return t(/^[=+\-@\t\r]/.test(r) ? `'` + r : r);
          })
          .join(`,`),
      ),
    ].join(`\r
`);
    const r = URL.createObjectURL(
      new Blob([n], { type: `text/csv;charset=utf-8;` }),
    );
    const i = document.createElement(`a`);
    i.href = r;
    i.download = `revuptime-` + Q + `.csv`;
    i.click();
    URL.revokeObjectURL(r);
  }
  async function an(e: File, t?: Row, previous?: Row) {
    if (!je || !e) return;
    ct(true);
    try {
      if (e.size > 15 * 1024 * 1024)
        throw new Error(`Choose a document smaller than 15 MB.`);
      if (E) {
        await qt(`asset_documents`, {
          ...(t ? { asset_id: t.id, site_id: t.site_id } : {}),
          name: e.name,
          mime_type: e.type,
          file_size_bytes: e.size,
          document_type: `manual`,
          version: `1`,
          uploaded_at: new Date().toISOString(),
          uploaded_by: J,
        });
        Y(`Demo document metadata saved. The file was not uploaded.`);
        return;
      }
      const n =
        D +
        `/` +
        crypto.randomUUID() +
        `/` +
        e.name.replace(/[^a-zA-Z0-9._-]/g, `_`);
      const { error: r } = await _!.storage
        .from(je.documentBucket)
        .upload(n, e, { upsert: false });
      if (r) throw r;
      let saved: Row;
      try {
        saved = await qt(
          `asset_documents`,
          {
            ...(t ? { asset_id: t.id, site_id: t.site_id } : {}),
            name: e.name,
            mime_type:
              e.type ||
              (e.name.toLowerCase().endsWith(`.txt`)
                ? `text/plain`
                : e.name.toLowerCase().endsWith(`.pdf`)
                  ? `application/pdf`
                  : `application/octet-stream`),
            file_size_bytes: e.size,
            storage_bucket: je.documentBucket,
            storage_path: n,
            uploaded_by: J,
            uploaded_at: new Date().toISOString(),
            version: previous
              ? String((Number(previous.version) || 1) + 1)
              : `1`,
            document_type: previous?.document_type || `manual`,
            metadata: {
              ...previous?.metadata,
              archived: false,
              index_status: `pending`,
              chunks: 0,
            },
          },
          previous,
        );
      } catch (e) {
        await _!.storage.from(je.documentBucket).remove([n]);
        throw e;
      }
      if (
        e.type === `application/pdf` ||
        /\.(pdf|txt|md|csv|tsv|json|log|docx)$/i.test(e.name)
      ) {
        try {
          const result = await indexDocument(D, saved.id);
          Y(result.message);
        } catch (error) {
          Y(
            `File saved, but indexing failed: ` +
              S(error) +
              `. Retry Index document.`,
            true,
          );
        }
        await Z();
      } else
        Y(`File saved. AI indexing supports PDF, DOCX and text data files.`);
    } catch (e) {
      Y(S(e), true);
    } finally {
      ct(false);
    }
  }
  async function on(e: Row) {
    if (E) {
      Y(`This sample document has no uploaded file.`);
      return;
    }
    if (e.storage_path) {
      const { data: t, error: n } = await _!.storage
        .from(e.storage_bucket)
        .createSignedUrl(e.storage_path, 60);
      if (n) {
        Y(n.message, true);
        return;
      }
      window.open(t.signedUrl, `_blank`, `noopener,noreferrer`);
    } else if (e.source_url) {
      try {
        const t = new URL(e.source_url);
        if (t.protocol !== `https:`)
          throw new Error(`Only HTTPS document links can be opened.`);
        window.open(t.toString(), `_blank`, `noopener,noreferrer`);
      } catch (e) {
        Y(S(e), true);
      }
    } else Y(`No file or source URL is attached to this document.`);
  }
  async function sn(e: string) {
    if (!_) throw new Error(`The database connection is not configured.`);
    const t = de();
    const n = jt.current.get(e);
    if (n) {
      const r = ee(
        n,
        k.assets || [],
        U,
        D,
        J,
        W?.asset_context_required !== false,
      );
      jt.current.set(e, r);
      j((e) => h(e, [r], []));
      const { error: i } = await te(
        t
          .from(`chat_sessions`)
          .upsert(r, {
            onConflict: `id`,
            ignoreDuplicates: true,
            defaultToNull: false,
          })
          .abortSignal(AbortSignal.timeout(15e3)),
        18e3,
        `Saving timed out. Your reply is kept; retry saving.`,
      );
      if (i) throw i;
      jt.current.delete(e);
    }
    const r = Mt.current.get(e) || [];
    if (r.length) {
      const { error: n } = await te(
        t
          .from(`chat_messages`)
          .upsert(m(r), {
            onConflict: `id`,
            ignoreDuplicates: true,
            defaultToNull: false,
          })
          .abortSignal(AbortSignal.timeout(15e3)),
        18e3,
        `Saving timed out. Your reply is kept; retry saving.`,
      );
      if (n) throw n;
      Mt.current.delete(e);
    }
  }
  async function cn() {
    const e = B || (k.chat_sessions || [])[0]?.id;
    if (!e || ut) return;
    dt(true);
    try {
      const t = (k.chat_sessions || []).find((t) => t.id === e);
      if (t?.context?.browser_only)
        re(
          localStorage,
          D,
          J,
          [t],
          (k.chat_messages || []).filter((t) => t.session_id === e),
        );
      else await sn(e);
      q(``);
      Y(
        t?.context?.browser_only
          ? `Conversation saved in this browser.`
          : `Conversation saved.`,
      );
    } catch (e) {
      q(`Conversation could not be saved: ` + S(e));
    } finally {
      Et(``);
      kt.current = null;
      dt(false);
    }
  }
  async function ln(mode = chatMode) {
    if (!lt.trim() || ut) return;
    dt(true);
    q(``);
    wt(``);
    const question = lt.trim(),
      scope = Lt.current;
    try {
      if (E)
        throw new Error(
          `Sign in to ask about private documents and machine data.`,
        );
      const existing =
        B === `new`
          ? undefined
          : (k.chat_sessions || []).find(
              (session) =>
                session.id === B &&
                d(session) === mode &&
                session.context?.browser_only &&
                (session.asset_id || null) ===
                  (mode === `maintenance` ? U || null : null) &&
                (session.site_id || null) ===
                  (mode === `general` ? null : P || null),
            );
      const history = existing
        ? (k.chat_messages || [])
            .filter(
              (message) =>
                message.session_id === existing.id &&
                [`user`, `assistant`].includes(message.role),
            )
            .sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at))
            .slice(-8)
            .map((message) => ({
              role: message.role,
              content: message.content.slice(0, 4000),
            }))
        : [];
      let reply: Row;
      if (g(question))
        reply = {
          content:
            mode !== `general`
              ? `Hello! Ask about uploaded documents or machine records. I’ll retrieve relevant evidence and show its source.`
              : `Hello! Ask me a general question.`,
          citations: [],
          engine: `local-general`,
        };
      else {
        Et(question);
        const controller = new AbortController();
        kt.current = controller;
        const request = knowledgeRequest(mode, question, history, {
          organizationId: D,
          siteId: P,
          assetId: U,
          useAI: mt,
        });
        reply = await f(request.endpoint, request.body, controller.signal);
      }
      if (scope !== Lt.current) return;
      const now = Date.now();
      const session: Row = existing || {
        id: crypto.randomUUID(),
        organization_id: D,
        user_id: J,
        title: question.slice(0, 60),
        status: `active`,
        asset_id: mode === `maintenance` ? U || null : null,
        site_id: mode === `general` ? null : P || null,
        created_at: new Date(now).toISOString(),
        context: { browser_only: true, assistant_mode: mode },
      };
      const messages = m([
        {
          id: crypto.randomUUID(),
          session_id: session.id,
          user_id: J,
          role: `user`,
          content: question,
          metadata: { assistant_mode: mode },
          created_at: new Date(now).toISOString(),
        },
        {
          id: crypto.randomUUID(),
          session_id: session.id,
          user_id: J,
          role: `assistant`,
          content: reply.content,
          model: reply.model || null,
          tokens_used: reply.tokens_used || 0,
          citations: reply.citations || [],
          metadata: {
            engine: reply.engine,
            assistant_mode: mode,
            retrieval: reply.retrieval,
            retrieved_at: reply.evidence?.retrieved_at,
          },
          created_at: new Date(now + 1).toISOString(),
        },
      ]);
      const saved = await p(
        () => {
          j((data) => h(data, [session], messages));
          V(session.id);
          H(``);
        },
        async () => {
          re(localStorage, D, J, [session], messages);
        },
      );
      if (!saved.saved)
        q(
          `Reply shown, but browser history could not be saved: ` + saved.error,
        );
    } catch (error) {
      wt(S(error));
    } finally {
      Et(``);
      kt.current = null;
      dt(false);
    }
  }
  async function un(e: FormEvent) {
    e.preventDefault();
    if (M === `ai` || aiDrawer) {
      void ln();
      return;
    }
    if (!E) {
      void ln(`maintenance`);
      return;
    }
    if (!lt.trim() || ut) return;
    dt(true);
    q(``);
    wt(``);
    try {
      const e = lt.trim();
      const t = l(e, G, U);
      const n = (k.assets || []).find((e) => e.id === U)?.site_id || P || null;
      const r =
        B === `new`
          ? undefined
          : (G.chat_sessions || []).find(
              (e) => e.id === (B || (G.chat_sessions || [])[0]?.id),
            );
      let i =
        (!K || r?.context?.browser_only === true) &&
        r?.user_id === J &&
        (r.asset_id || null) === (U || null) &&
        (r.site_id || null) === n
          ? r.id
          : undefined;
      let a: Row | undefined;
      if (!i) {
        const t = {
          id: crypto.randomUUID(),
          organization_id: D,
          user_id: J,
          asset_id: U || null,
          site_id:
            (k.assets || []).find((e) => e.id === U)?.site_id || P || null,
          title: e.slice(0, 60),
          status: `active`,
          context: K
            ? { browser_only: true, assistant_mode: `maintenance` }
            : { assistant_mode: `maintenance` },
          created_at: new Date().toISOString(),
        };
        i = t.id;
        a = t;
        V(i);
        if (!E && !K) jt.current.set(i, t);
      }
      const o = Date.now();
      const s = [
        {
          id: crypto.randomUUID(),
          session_id: i,
          user_id: J,
          role: `user`,
          content: e,
          created_at: new Date(o).toISOString(),
        },
        {
          id: crypto.randomUUID(),
          session_id: i,
          user_id: J,
          role: `assistant`,
          content: t.content,
          citations: t.citations,
          metadata: { engine: t.engine, asset_id: U || null },
          created_at: new Date(o + 1).toISOString(),
        },
      ];
      if (!E && !K) Mt.current.set(i, [...(Mt.current.get(i) || []), ...s]);
      const c = await p(
        () => {
          j((e) => ({
            ...e,
            chat_sessions: a
              ? [a, ...(e.chat_sessions || [])]
              : e.chat_sessions || [],
            chat_messages: [...s, ...(e.chat_messages || [])],
          }));
          H(``);
        },
        async () => {
          if (K) re(localStorage, D, J, a ? [a] : [], s);
          else if (!E) await sn(i!);
        },
      );
      if (!c.saved)
        q(`Reply shown, but the conversation could not be saved: ` + c.error);
    } catch (e) {
      wt(S(e));
    } finally {
      Et(``);
      kt.current = null;
      dt(false);
    }
  }
  const dn =
    Ht?.full_name ||
    w?.user.user_metadata?.full_name ||
    w?.user.email ||
    `Your account`;
  if (Ne)
    return (
      <div className="loading-screen">
        <Logo />
        <div className="loader" />
        <p>Opening your workspace…</p>
      </div>
    );
  if (i)
    return (
      <AccountEmailConfirmation
        credentials={i}
        onComplete={(e, t) => {
          Fe(false);
          T(e);
          fe(e);
          Le(t);
          a(null);
        }}
        onCancel={() => {
          a(null);
          Fe(false);
        }}
      />
    );
  if (s && !Ie && (w || v))
    return (
      <div className="loading-screen">
        <Logo />
        <section className="panel modal-content">
          <h1>Join your Revuptime team</h1>
          <p>
            This invitation is for{" "}
            <strong>{Re || `the email address in your invitation`}</strong>.
          </p>
          {v ? (
            <p>
              Select Accept invitation to verify this email address, sign in,
              and open your team workspace.
            </p>
          ) : (
            <p>
              Currently signed in as <strong>{w?.user.email}</strong>.
            </p>
          )}
          {!v && !ze && (
            <p className="form-error" role="alert">
              This browser is signed in with a different email. Request a fresh
              invitation email below to continue as the invited member.
            </p>
          )}
          {Ee && (
            <p className="form-error" role="alert">
              {Ee}
            </p>
          )}
          {De && (
            <p className="form-success" role="status">
              {De}
            </p>
          )}
          {(v || ze) && (
            <Button disabled={be} onClick={() => void Zt()}>
              {be ? `Joining…` : `Accept invitation`}
            </Button>
          )}
          <Button secondary disabled={be} onClick={() => void $t()}>
            Request a fresh invitation email
          </Button>
          {!v && w && (
            <Button secondary disabled={be} onClick={() => void en()}>
              Sign in as the invited member
            </Button>
          )}
          <button
            className="text-button"
            disabled={be}
            onClick={() => {
              sessionStorage.removeItem(`revuptime-team-invite`);
              sessionStorage.removeItem(`revuptime-invite-email`);
              _e(null);
              c(``);
            }}
          >
            Cancel invitation
          </button>
        </section>
      </div>
    );
  if ((!w && !E) || Ie)
    return (
      <>
        <Auth
          config={je}
          onDemo={Kt}
          onSession={(e) => {
            const destination = signInDestination(
              location.pathname,
              location.hash,
            );
            history.replaceState(null, ``, destination);
            Ye(
              location.pathname.startsWith(`/assets`)
                ? `assets`
                : location.hash.slice(1).split(`/`)[0] || `dashboard`,
            );
            fe(e);
            T(e);
          }}
          recovery={Ie}
          onRecovered={() => Le(false)}
          invitationEmail={Re}
          onInvitationLink={s ? Qt : undefined}
        />
        {F && (
          <div className={`toast ` + (F.error ? `error` : ``)} role="status">
            {F.text}
            <button onClick={() => it(null)} aria-label="Dismiss notification">
              <X size={16} />
            </button>
          </div>
        )}
      </>
    );
  if (!E && qe && !D)
    return (
      <div className="loading-screen">
        <Logo />
        <div className="loader" />
        <p>Loading your organization…</p>
      </div>
    );
  if (!D && Be)
    return (
      <div className="loading-screen">
        <Logo />
        <section className="panel modal-content">
          <h1>Could not load your workspace</h1>
          <p role="alert">{Be}</p>
          <Button
            onClick={() => {
              Je(true);
              Ve(``);
              void Rt()
                .catch((e) => Ve(S(e)))
                .finally(() => Je(false));
            }}
          >
            Retry loading workspace
          </Button>
          <Button secondary onClick={() => void Wt()}>
            Sign out
          </Button>
        </section>
      </div>
    );
  if (!D)
    return (
      <>
        <Onboarding onCreate={Gt} onSignOut={() => void Wt()} />
        {F && (
          <div className="toast error" role="alert">
            {F.text}
          </div>
        )}
      </>
    );
  const aiView = M === `ai` || aiDrawer;
  const fn = aiView ? k : G;
  const pn = (fn.chat_sessions || []).filter(
      (e) => e.user_id === J && d(e) === (aiView ? chatMode : `maintenance`),
    ),
    mn = B || pn[0]?.id,
    hn = (fn.chat_messages || [])
      .filter((e) => e.session_id === mn)
      .sort(
        (e, t) =>
          new Date(e.created_at).valueOf() - new Date(t.created_at).valueOf(),
      );
  const gn =
    !!$ &&
    !(`readOnly` in $ && $.readOnly) &&
    (Q !== `organization_members` || Vt);
  const _n =
      M === `settings`
        ? ([`settings`, `Settings`, Settings, `MANAGE`] as const)
        : ye.find((e) => e[0] === M),
    vn = $?.title || _n?.[1] || `Workspace`;
  const aiChatPanel = (
    <div className="copilot-layout">
      <aside className="conversation-list">
        <h3>Conversations</h3>
        {pn.map((e) => (
          <button
            key={e.id}
            className={mn === e.id ? `selected` : ``}
            onClick={() => {
              V(e.id);
              ft(e.asset_id || ``);
              H(``);
            }}
          >
            <MessageSquare size={16} />
            {e.title || `Untitled conversation`}
          </button>
        ))}
        {!pn.length && <p className="muted">No conversations yet</p>}
      </aside>
      <section className="panel chat-panel">
        <div className="chat-status">
          <span className="copilot-icon">
            <Sparkles size={21} />
          </span>
          <div>
            <strong>
              {aiView
                ? chatMode === `workspace`
                  ? `Workspace knowledge`
                  : `General AI assistant`
                : `Device and asset copilot`}
            </strong>
            <span>
              {aiView
                ? chatMode === `workspace`
                  ? W?.knowledge_ai_enabled
                    ? `AI · documents and current machine records`
                    : `Local search · documents and machine records`
                  : `General questions`
                : mt && !E
                  ? `AI · documents and machine records`
                  : `Local search · documents and machine records`}
            </span>
          </div>
        </div>
        {aiView ? (
          <>
            <label className="copilot-asset">
              Answer from
              <select
                aria-label="AI knowledge mode"
                disabled={ut}
                value={chatMode}
                onChange={(event) => {
                  setChatMode(event.target.value);
                  V(`new`);
                  H(``);
                  wt(``);
                  q(``);
                }}
              >
                <option value="workspace">
                  Workspace documents and machine data
                </option>
                <option value="general" disabled={!W?.configured}>
                  {W?.configured
                    ? `General knowledge`
                    : `General knowledge · provider setup required`}
                </option>
              </select>
            </label>
            <p className="workspace-note">
              {chatMode === `workspace`
                ? `Answers use accessible documents and machine records in the selected site. Expand Sources to see the file, page, recorded time and excerpt.`
                : `General mode uses your question and conversation history.`}
            </p>
            {chatMode === `workspace` && W && !W.knowledge_ai_enabled && (
              <p className="workspace-note" role="status">
                Local document search is ready and returns cited excerpts.
                AI-written summaries become available when your administrator
                connects an AI provider.
              </p>
            )}
          </>
        ) : (
          <>
            <label className="copilot-asset">
              Response engine
              <select
                aria-label="Response engine"
                value={mt && !E ? `ai` : `local`}
                onChange={(e) => ht(e.target.value === `ai`)}
              >
                <option value="local">
                  Document and machine source excerpts
                </option>
                <option
                  value="ai"
                  disabled={E || !W?.configured || !W?.live_data_allowed}
                >
                  AI answers from documents and machine records
                </option>
              </select>
            </label>
            <label className="copilot-asset">
              Asset context
              <select
                aria-label="Copilot asset"
                disabled={E && K}
                value={U}
                onChange={(e) => ft(e.target.value)}
              >
                <option value="">All workspace documents and assets</option>
                {(G.assets || []).map((e) => (
                  <option value={e.id} key={e.id}>
                    {e.name}
                  </option>
                ))}
              </select>
            </label>
            {!U && (
              <p className="workspace-note">
                {K
                  ? `Upload and index documents to ask questions, even before adding devices or assets.`
                  : `Ask about uploaded documents without selecting an asset, or choose one to narrow the search.`}
              </p>
            )}
            {K && (
              <div className="copilot-prompts">
                {Ge.filter((e) => e.organization_id !== D).map((e) => (
                  <button
                    key={e.organization_id}
                    onClick={() => O(e.organization_id)}
                  >
                    Switch to {e.organization?.name || `existing workspace`}
                  </button>
                ))}
              </div>
            )}
          </>
        )}
        <div className="copilot-prompts">
          {(aiView
            ? chatMode === `workspace`
              ? [
                  `What is the latest machine reading?`,
                  `What do our manuals say about lubrication?`,
                  `Which machines need maintenance?`,
                ]
              : [
                  `Explain a concept`,
                  `Help me write an email`,
                  `Help me plan my day`,
                ]
            : [
                `What do our uploaded documents say?`,
                `What is the rated current?`,
                `What is the latest sensor reading?`,
              ]
          ).map((e) => (
            <button key={e} onClick={() => H(e)}>
              {e}
            </button>
          ))}
        </div>
        <div className="chat-messages" ref={Pt} aria-live="polite">
          {hn.length ? (
            hn.map((e) => (
              <article className={`chat-message ` + e.role} key={e.id}>
                <span className="message-avatar">
                  {e.role === `user`
                    ? dn.slice(0, 1)
                    : e.metadata?.engine === `local-workspace`
                      ? `R`
                      : `AI`}
                </span>
                <div>
                  <strong>
                    {e.role === `user`
                      ? `You`
                      : aiView
                        ? e.metadata?.engine === `local-retrieval`
                          ? `Document results · local search`
                          : `RevUpTime AI`
                        : e.metadata?.engine === `local-workspace`
                          ? `Copilot · device and asset guidance`
                          : b(e.role)}
                  </strong>
                  <p>{e.content}</p>
                  {Array.isArray(e.citations) && (
                    <KnowledgeSources
                      organizationId={D}
                      sources={e.citations}
                      onInspect={(source) => {
                        const row = (k[source.table] || []).find(
                          (record) => record.id === source.id,
                        );
                        if (row) z({ table: source.table, row, edit: false });
                        else
                          Y(
                            `This source is outside the currently loaded records. Its captured excerpt is shown here; open the relevant workspace section to find the latest record.`,
                          );
                      }}
                    />
                  )}
                  <small>{y(e.created_at, `created_at`, k)}</small>
                </div>
              </article>
            ))
          ) : (
            <Empty
              icon={MessageSquare}
              title={
                aiView ? `Ask RevUpTime AI` : `Ask about devices and assets`
              }
              body={
                aiView
                  ? `Ask about uploaded documents or machine records. Choose General knowledge for other topics.`
                  : `Ask about uploaded documents, specifications, readings or equipment status. Sources show the file and page used.`
              }
            />
          )}
          {Tt && (
            <>
              <article className="chat-message user">
                <span className="message-avatar">{dn.slice(0, 1)}</span>
                <div>
                  <strong>You</strong>
                  <p>{Tt}</p>
                </div>
              </article>
              <article className="chat-message assistant" role="status">
                <span className="message-avatar">AI</span>
                <div>
                  <strong>Nemotron is responding…</strong>
                  <p>{Dt} seconds elapsed. You can cancel and retry.</p>
                  <button
                    type="button"
                    className="button secondary compact"
                    onClick={() => kt.current?.abort()}
                  >
                    Cancel request
                  </button>
                </div>
              </article>
            </>
          )}
        </div>
        <form className="chat-composer" onSubmit={un}>
          <input
            aria-label="Message"
            placeholder={
              aiView
                ? chatMode === `workspace`
                  ? `Ask about your documents or machine data…`
                  : `Ask a general question…`
                : `Ask about uploaded documents or machine data…`
            }
            value={lt}
            onChange={(e) => H(e.target.value)}
            maxLength={4e3}
          />
          <Button type="submit" disabled={(!K && qe) || ut || !lt.trim()}>
            <ArrowRight size={19} />
            <span className="sr-only">
              {ut ? `Saving conversation` : `Send message`}
            </span>
          </Button>
        </form>
        {ut && (
          <p className="workspace-note" role="status">
            {Tt ? `Preparing your AI response…` : `Saving your conversation…`}
          </p>
        )}
        {Ct && (
          <p className="copilot-save-error" role="alert">
            {Ct} Your question is kept above; retry when ready.
          </p>
        )}
        {St && (
          <div className="copilot-save-error" role="alert">
            <span>
              {St} Unsaved messages stay on this page until you leave or
              refresh.
            </span>
            <button
              className="button secondary compact"
              disabled={ut}
              onClick={() => void cn()}
            >
              Retry saving
            </button>
          </div>
        )}
        <p className="chat-disclaimer">
          {aiView
            ? `Check the cited sources before acting. Conversation history is stored only in this browser.`
            : K
              ? `Copilot searches authorized documents and machine records. This conversation is stored in this browser.`
              : mt && !E
                ? `AI answers use authorized documents and machine records. Check sources before acting. Conversation history is stored in this browser.`
                : `Copilot searches authorized documents and machine records. Check cited sources before acting. Conversation history is stored in this browser.`}
        </p>
      </section>
    </div>
  );
  return (
    <div
      className={
        `app-shell rv-new-shell` + (M === `assets` ? ` asset-shell` : ``)
      }
    >
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      {nt && <div className="sidebar-scrim" onClick={() => rt(false)} />}
      <Sidebar
        view={M}
        orgId={D}
        orgs={Ge}
        onOrg={(e) => O(e)}
        sites={k.sites || []}
        siteId={P}
        onSite={(e) => vt(e)}
        navigate={Ut}
        userName={dn.includes(`@`) ? dn.split(`@`)[0] : dn}
        email={w?.user.email}
        role={zt?.role}
        demo={E}
        alertFallback={
          (k.alerts || []).filter((e) => e.status === `open`).length
        }
        onAskAI={() => setAiDrawer(true)}
        onSignOut={() => void Wt()}
        onCreateWorkspace={() => ot(true)}
        open={nt}
        onOpen={() => rt(true)}
        onClose={() => rt(false)}
        logo={
          <span className="workspace-logo-crop">
            <img
              src="/images/revuptime-brand-transparent.png"
              alt="RevUpTime"
              width="1448"
              height="1086"
            />
          </span>
        }
      />
      {aiDrawer && M !== `ai` && (
        <>
          <div
            className="rv-ai-scrim"
            onClick={() => setAiDrawer(false)}
            aria-hidden="true"
          />
          <aside
            className="rv-ai-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Ask RevUptime AI"
          >
            <header className="rv-ai-drawer-head">
              <span>
                <Sparkles size={17} aria-hidden="true" />
                <strong>Ask RevUptime AI</strong>
              </span>
              <button
                type="button"
                className="icon-button"
                aria-label="Close RevUptime AI"
                onClick={() => setAiDrawer(false)}
              >
                <X size={18} />
              </button>
            </header>
            {aiChatPanel}
          </aside>
        </>
      )}

      <div className="main-shell">
        {E && (
          <div className="demo-banner">
            <span>
              <Sparkles size={15} />
              <strong>Demo workspace</strong>
              <span>All equipment and measurements are sample data.</span>
            </span>
            <button onClick={() => void Wt()}>
              Connect your workspace <ArrowRight size={14} />
            </button>
          </div>
        )}

        <main id="main">
          <Suspense fallback={<PageLoading />}>
            {He && (
              <p className="copilot-save-error" role="alert">
                {He}
              </p>
            )}
            {!L && !at && (
              <>
                {M === `assets` ? (
                  <AssetWorkspace
                    key={D + `:` + P}
                    data={G}
                    demo={E}
                    canWrite={rvCanWrite}
                    orgId={D}
                    siteId={P}
                    notify={Y}
                    onAddSensor={rvGatewaySite}
                    onSave={qt}
                    onAcknowledge={tn}
                    onDemoReadings={(e) => {
                      if (!E) return;
                      j((t) => ({
                        ...t,
                        sensor_readings: [...e, ...(t.sensor_readings || [])],
                      }));
                      Y(`Sample telemetry loaded in this browser only.`);
                    }}
                    loading={qe}
                    uploading={st}
                    onRefresh={() => (E ? Y(`Demo data is ready.`) : void Z())}
                    onInspect={(e, t) => z({ table: e, row: t, edit: false })}
                    onEdit={(e, t) =>
                      z({
                        table: e,
                        row: !Object.keys(t).length && P ? { site_id: P } : t,
                        edit: true,
                      })
                    }
                    onUpload={(e, t) => void an(e, t)}
                    onOpenDocument={(e) => void on(e)}
                  />
                ) : M === `reports` ? (
                  <AIWorkspace
                    key={D + `:` + P + `:` + M}
                    data={G}
                    org={D}
                    site={P}
                    demo={E}
                    mode={M}
                    onRefresh={Z}
                    onDraft={(e) =>
                      z({ table: `work_orders`, row: e, edit: true })
                    }
                  />
                ) : M === `alerts` ? (
                  <AlertsPage
                    key={D}
                    orgId={D}
                    data={k}
                    site={P}
                    canWrite={rvCanWrite}
                    canManage={rvCanManage}
                    navigate={Ut}
                    notify={Y}
                    onCreateOrder={(row) =>
                      z({ table: `work_orders`, row, edit: true })
                    }
                  />
                ) : M === `asset_documents` ? (
                  <DocumentsPage
                    key={D}
                    data={k}
                    siteId={P}
                    canWrite={rvCanWrite}
                    demo={E}
                    uploading={st}
                    onUpload={(file) => void an(file)}
                    onOpen={(row) => void on(row)}
                    onDetails={(row) =>
                      z({ table: `asset_documents`, row, edit: false })
                    }
                    onAdd={() =>
                      z({
                        table: `asset_documents`,
                        row: P ? { site_id: P } : {},
                        edit: true,
                      })
                    }
                  />
                ) : M === `inbox` ? (
                  <InboxPage
                    key={D}
                    orgId={D}
                    userId={J}
                    data={k}
                    canWrite={rvCanWrite}
                    navigate={Ut}
                    notify={Y}
                    onCreateOrder={(row) =>
                      z({ table: `work_orders`, row, edit: true })
                    }
                  />
                ) : M === `plants` ? (
                  <PlantsPage
                    key={D}
                    orgId={D}
                    data={k}
                    demo={E}
                    canWrite={rvCanWrite}
                    onOpenPlant={(id) => {
                      vt(id);
                      Ut(`dashboard`);
                    }}
                    onAddGateway={rvGatewaySite}
                    onChanged={Z}
                    notify={Y}
                  />
                ) : M === `devices` ? (
                  <DevicesPage
                    key={D}
                    db={_}
                    orgId={D}
                    data={k}
                    siteId={P}
                    demo={E}
                    canManage={rvCanManage}
                    navigate={Ut}
                    onAddGateway={() => rvGatewaySite(P)}
                    onChanged={Z}
                    notify={Y}
                  />
                ) : M === `add-gateway` ? (
                  <GatewayWizard
                    key={D}
                    db={_}
                    orgId={D}
                    data={k}
                    demo={E}
                    canManage={rvCanManage}
                    initialSiteId={(() => {
                      try {
                        return (
                          sessionStorage.getItem(
                            `revuptime-add-gateway-site`,
                          ) || P
                        );
                      } catch {
                        return P;
                      }
                    })()}
                    navigate={Ut}
                    onChanged={Z}
                    notify={Y}
                  />
                ) : M === `dashboard` ? (
                  <PlantCommand
                    key={D}
                    orgId={D}
                    data={k}
                    site={P}
                    navigate={Ut}
                    onAddGateway={() => rvGatewaySite(P)}
                    onOpenAsset={(id) => {
                      history.pushState(
                        null,
                        ``,
                        `/assets/` + encodeURIComponent(id) + `/overview`,
                      );
                      window.dispatchEvent(new PopStateEvent(`popstate`));
                    }}
                  />
                ) : M === `__legacy_dashboard` ? (
                  <Overview
                    data={k}
                    site={P}
                    navigate={Ut}
                    onCreateOrder={(asset) =>
                      z({
                        table: `work_orders`,
                        row: asset
                          ? { asset_id: asset.id, site_id: asset.site_id }
                          : {},
                        edit: true,
                      })
                    }
                    onInspect={(e, t) => z({ table: e, row: t, edit: false })}
                  />
                ) : M === `platform` ? (
                  rvStaff ? (
                    <PlatformWhatsApp notify={Y} />
                  ) : (
                    <NotFoundPanel />
                  )
                ) : [`chat`, `ai`].includes(M) ? (
                  <>
                    <div className="page-heading">
                      <div>
                        <span className="eyebrow light">
                          {M === `ai`
                            ? `WORKSPACE KNOWLEDGE & AI`
                            : `DEVICES & ASSETS`}
                        </span>
                        <h1>
                          {M === `ai` ? `RevUpTime AI` : `Maintenance copilot`}
                          <span className="beta-title">BETA</span>
                        </h1>
                        <p>
                          {M === `ai`
                            ? `Ask about your documents and machine data, with sources for each answer.`
                            : `Ask about uploaded documents, specifications and current machine records.`}
                        </p>
                      </div>
                      <Button
                        secondary
                        onClick={() => {
                          V(`new`);
                          H(``);
                          ft(``);
                        }}
                      >
                        <Plus size={16} /> New conversation
                      </Button>
                    </div>

                    {aiChatPanel}
                  </>
                ) : M === `settings` ? (
                  <SettingsPage
                    key={D}
                    orgId={D}
                    userId={J}
                    email={w?.user.email}
                    role={zt?.role}
                    data={k}
                    demo={E}
                    navigate={Ut}
                    notify={Y}
                    onChanged={Z}
                    onInvite={() =>
                      z({ table: `organization_members`, row: {}, edit: true })
                    }
                    onCreateWorkspace={() => ot(true)}
                    onSignOut={() => void Wt()}
                    onCreateOrder={(row) =>
                      z({ table: `work_orders`, row, edit: true })
                    }
                    plants={
                      <PlantsPage
                        key={D + `-s`}
                        orgId={D}
                        data={k}
                        demo={E}
                        canWrite={rvCanWrite}
                        onOpenPlant={(id) => {
                          vt(id);
                          Ut(`dashboard`);
                        }}
                        onAddGateway={rvGatewaySite}
                        onChanged={Z}
                        notify={Y}
                      />
                    }
                    gateways={
                      <DevicesPage
                        key={D + `-s`}
                        db={_}
                        orgId={D}
                        data={k}
                        siteId={P}
                        demo={E}
                        canManage={rvCanManage}
                        navigate={Ut}
                        onAddGateway={() => rvGatewaySite(P)}
                        onChanged={Z}
                        notify={Y}
                      />
                    }
                    gatewayWizard={
                      <GatewayWizard
                        key={D + `-w`}
                        db={_}
                        orgId={D}
                        data={k}
                        demo={E}
                        canManage={rvCanManage}
                        initialSiteId={(() => {
                          try {
                            return (
                              sessionStorage.getItem(
                                `revuptime-add-gateway-site`,
                              ) || P
                            );
                          } catch {
                            return P;
                          }
                        })()}
                        navigate={Ut}
                        onChanged={Z}
                        notify={Y}
                      />
                    }
                    documents={
                      <DocumentsPage
                        key={D + `-d`}
                        data={k}
                        siteId={P}
                        canWrite={rvCanWrite}
                        demo={E}
                        uploading={st}
                        onUpload={(file) => void an(file)}
                        onOpen={(row) => void on(row)}
                        onDetails={(row) =>
                          z({ table: `asset_documents`, row, edit: false })
                        }
                        onAdd={() =>
                          z({
                            table: `asset_documents`,
                            row: P ? { site_id: P } : {},
                            edit: true,
                          })
                        }
                      />
                    }
                  />
                ) : M === `__legacy_settings` ? (
                  <>
                    <div className="page-heading">
                      <div>
                        <span className="eyebrow light">MAKE IT YOURS</span>
                        <h1>Workspace settings</h1>
                        <p>
                          Your profile, organization, and connected services.
                        </p>
                      </div>
                    </div>
                    <section className="panel settings-tools">
                      <h2>Workspace tools</h2>
                      <p>Additional operational tools and team management.</p>
                      <div>
                        {Se.map(([e, t, Icon]) => (
                          <button key={e} onClick={() => Ut(e)}>
                            <span className="settings-tool-icon">
                              <Icon size={21} />
                            </span>
                            <span>
                              <strong>{t}</strong>
                              <small>
                                {ve.find((t) => t.key === e)?.subtitle ||
                                  `Manage this workspace section.`}
                              </small>
                            </span>
                            <ArrowRight size={17} />
                          </button>
                        ))}
                      </div>
                      <a
                        href="https://revuptime.com/contact"
                        target="_blank"
                        rel="noreferrer"
                        className="support-link"
                      >
                        <CircleHelp size={17} /> Help & support{" "}
                        <ArrowRight size={15} />
                      </a>
                    </section>
                    <div className="settings-grid">
                      <section className="panel settings-card">
                        <h2>Your profile</h2>
                        <div className="profile-setting">
                          <span className="avatar">
                            {dn.slice(0, 1).toUpperCase()}
                          </span>
                          <div>
                            <strong>{dn}</strong>
                            <p>{E ? `Sample account` : w?.user.email}</p>
                          </div>
                        </div>
                        <dl>
                          <div>
                            <dt>Job title</dt>
                            <dd>{Ht?.job_title || `Not set`}</dd>
                          </div>
                          <div>
                            <dt>Timezone</dt>
                            <dd>{Ht?.timezone || `UTC`}</dd>
                          </div>
                          <div>
                            <dt>Organization role</dt>
                            <dd>{b(zt?.role || `member`)}</dd>
                          </div>
                        </dl>
                        <Button
                          secondary
                          onClick={() =>
                            z({
                              table: `profiles`,
                              row: Ht || { id: J },
                              edit: true,
                            })
                          }
                        >
                          Edit profile
                        </Button>
                      </section>

                      <section className="panel settings-card">
                        <h2>Organization</h2>
                        <dl>
                          <div>
                            <dt>Name</dt>
                            <dd>{Bt?.name}</dd>
                          </div>
                          <div>
                            <dt>Workspace slug</dt>
                            <dd>{Bt?.slug}</dd>
                          </div>
                          <div>
                            <dt>Access</dt>
                            <dd>Active members only</dd>
                          </div>
                        </dl>
                        {!E && (
                          <Button secondary onClick={() => ot(true)}>
                            <Plus size={16} /> Create another organization
                          </Button>
                        )}
                        <Button
                          secondary
                          onClick={() => Ut(`organization_members`)}
                        >
                          <Users size={16} /> Manage team
                        </Button>
                      </section>

                      <section className="panel settings-card">
                        <h2>Connected services</h2>
                        <div className="service-row">
                          <Database size={20} />
                          <div>
                            <strong>Supabase</strong>
                            <p>
                              {E
                                ? `Live connection available at sign-in`
                                : `Database and authentication`}
                            </p>
                          </div>
                          <Badge value={E ? `demo` : `active`} />
                        </div>
                        <div className="service-row">
                          <FileText size={20} />
                          <div>
                            <strong>Document storage</strong>
                            <p>Private organization folders · 15 MB per file</p>
                          </div>
                        </div>
                        <div className="service-row">
                          <Sparkles size={20} />
                          <div>
                            <strong>AI inference</strong>
                            <p>
                              Not configured. Predictions display pipeline
                              records.
                            </p>
                          </div>
                        </div>
                      </section>
                      <section className="panel settings-card">
                        <h2>Account</h2>
                        <p className="muted">
                          Sign out of this browser session.
                        </p>
                        <Button secondary onClick={() => void Wt()}>
                          <LogOut size={16} /> Sign out
                        </Button>
                        {E && (
                          <button
                            className="text-button"
                            onClick={() => {
                              localStorage.removeItem(`revuptime-demo-data`);
                              j(ge());
                              Y(`Demo data reset.`);
                            }}
                          >
                            Reset demo data
                          </button>
                        )}
                      </section>
                    </div>
                  </>
                ) : $ ? (
                  <>
                    <div className="page-heading">
                      <div>
                        <span className="eyebrow light">
                          {ye.find((e) => e[0] === M)?.[3] || `YOUR OPERATIONS`}
                        </span>
                        <h1>{vn}</h1>
                        <p>{$.subtitle}</p>
                      </div>
                      <div className="heading-buttons">
                        {Q === `asset_documents` && (
                          <label className="button upload-button">
                            {st ? (
                              `Uploading and indexing…`
                            ) : (
                              <>
                                <Upload size={16} /> Upload document
                              </>
                            )}
                            <input
                              type="file"
                              accept=".pdf,.docx,.txt,.md,.csv,.tsv,.json,.log,.png,.jpg,.jpeg"
                              disabled={st}
                              onChange={(e) => {
                                if (e.target.files?.[0])
                                  void an(e.target.files[0]);
                                e.target.value = ``;
                              }}
                            />
                          </label>
                        )}
                        {gn && (
                          <Button
                            onClick={() =>
                              z({
                                table: Q,
                                row:
                                  P &&
                                  we[Q]?.columns.some(
                                    (e) => e.name === `site_id`,
                                  )
                                    ? { site_id: P }
                                    : {},
                                edit: true,
                              })
                            }
                          >
                            <Plus size={17} />{" "}
                            {Q === `organization_members`
                              ? `Invite member`
                              : `Add ` + $.singular}
                          </Button>
                        )}
                      </div>
                    </div>

                    {Ce[M] && (
                      <div className="page-tabs" role="tablist">
                        {Ce[M].map(([e, t]) => (
                          <button
                            role="tab"
                            aria-selected={Q === e}
                            className={Q === e ? `active` : ``}
                            key={e}
                            onClick={() => {
                              Ze(e);
                              Qe(``);
                              tt(`all`);
                            }}
                          >
                            {t}
                            <span>{(G[e] || []).length}</span>
                          </button>
                        ))}
                      </div>
                    )}

                    <section className="panel table-panel">
                      <div className="table-toolbar">
                        <label className="search-field">
                          <Search size={17} />
                          <input
                            aria-label={`Search ` + $.title}
                            placeholder={
                              `Search ` + $.title.toLowerCase() + `…`
                            }
                            value={N}
                            onChange={(e) => Qe(e.target.value)}
                          />
                        </label>
                        <div className="table-toolbar-right">
                          {(G[Q] || []).some((e) => e.status || e.severity) && (
                            <select
                              aria-label="Filter status"
                              value={et}
                              onChange={(e) => tt(e.target.value)}
                            >
                              <option value="all">All statuses</option>
                              {Array.from(
                                new Set(
                                  (G[Q] || [])
                                    .map((e) => e.status || e.severity)
                                    .filter(Boolean),
                                ),
                              ).map((e) => (
                                <option key={e} value={e}>
                                  {b(e)}
                                </option>
                              ))}
                            </select>
                          )}
                          <button
                            className="button secondary compact"
                            onClick={rn}
                          >
                            <ArrowDownToLine size={15} /> Export
                          </button>
                        </div>
                      </div>

                      {qe ? (
                        <div className="empty">
                          <div className="loader" />
                          <p>Loading records…</p>
                        </div>
                      ) : nn.length ? (
                        <div className="table-scroll">
                          <table>
                            <thead>
                              <tr>
                                {$.columns.map((e) => (
                                  <th key={e}>{b(e)}</th>
                                ))}
                                <th>
                                  <span className="sr-only">Actions</span>
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {nn.map((e) => (
                                <tr key={e.id}>
                                  {$.columns.map((t, n) => (
                                    <td key={t}>
                                      {[
                                        `status`,
                                        `severity`,
                                        `priority`,
                                        `criticality`,
                                        `quality`,
                                        `role`,
                                      ].includes(t) ? (
                                        <Badge value={e[t]} />
                                      ) : n === 0 ? (
                                        <button
                                          className="row-title"
                                          onClick={() =>
                                            z({ table: Q, row: e, edit: false })
                                          }
                                        >
                                          {Q === `assets` && (
                                            <span className="asset-icon">
                                              <Cpu size={18} />
                                            </span>
                                          )}
                                          <span>
                                            {y(e[t], t, k)}
                                            {Q === `assets` && (
                                              <small>
                                                {e.manufacturer || `Asset`}
                                              </small>
                                            )}
                                            {Q === `asset_documents` && (
                                              <small>
                                                {e.metadata?.index_status ===
                                                `ready`
                                                  ? e.metadata
                                                      ?.embedding_status ===
                                                    `ready`
                                                    ? `AI ready · vector search`
                                                    : `AI ready · text search`
                                                  : e.metadata?.index_status ===
                                                        `pending` ||
                                                      e.metadata
                                                        ?.index_status ===
                                                        `indexing`
                                                    ? `Indexing for AI…`
                                                    : e.metadata?.archived
                                                      ? `Archived`
                                                      : `Not indexed for AI`}
                                              </small>
                                            )}
                                          </span>
                                        </button>
                                      ) : (
                                        <span
                                          className={
                                            t.endsWith(`_code`) ||
                                            t === `work_order_number`
                                              ? `mono`
                                              : ``
                                          }
                                        >
                                          {y(e[t], t, k)}
                                        </span>
                                      )}
                                    </td>
                                  ))}
                                  <td>
                                    <button
                                      className="icon-button"
                                      aria-label={`View ` + x(e)}
                                      onClick={() =>
                                        z({ table: Q, row: e, edit: false })
                                      }
                                    >
                                      <ChevronRight size={17} />
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <Empty
                          icon={N ? Search : _n?.[2] || Database}
                          title={
                            N
                              ? `No matching records`
                              : `No ` + $.title.toLowerCase() + ` yet`
                          }
                          body={
                            N
                              ? `Try another search or change your filters.`
                              : `readOnly` in $ && $.readOnly
                                ? `Records will appear when your connected pipeline supplies them.`
                                : `Add your first ` +
                                  $.singular +
                                  ` to get started.`
                          }
                          action={
                            gn && !N ? (
                              <Button
                                secondary
                                onClick={() =>
                                  z({
                                    table: Q,
                                    row:
                                      P &&
                                      we[Q]?.columns.some(
                                        (e) => e.name === `site_id`,
                                      )
                                        ? { site_id: P }
                                        : {},
                                    edit: true,
                                  })
                                }
                              >
                                <Plus size={16} />{" "}
                                {Q === `organization_members`
                                  ? `Invite member`
                                  : `Add ` + $.singular}
                              </Button>
                            ) : undefined
                          }
                        />
                      )}

                      <footer className="table-footer">
                        <span>
                          {nn.length} {nn.length === 1 ? `record` : `records`}{" "}
                          in this view
                        </span>
                        <span>
                          Organization-scoped records · latest{" "}
                          {Q === `sensor_readings` ? `500` : `200`} maximum
                        </span>
                      </footer>
                    </section>

                    {Q === `organization_members` && !Vt && (
                      <p className="workspace-note">
                        <ShieldCheck size={15} /> Only owners and administrators
                        can change membership.
                      </p>
                    )}

                    {Q === `ai_predictions` && (
                      <p className="workspace-note">
                        <Sparkles size={15} /> Predictions shown here must be
                        supplied by your AI pipeline. No model is running in
                        this frontend.
                      </p>
                    )}
                  </>
                ) : null}
              </>
            )}
            {at && (
              <RecordPage
                title="Create another organization"
                onClose={() => ot(false)}
              >
                <div className="modal-content">
                  <Onboarding onCreate={Gt} onSignOut={() => ot(false)} />
                </div>
              </RecordPage>
            )}

            {ke ? (
              <RecordPage
                title="Remove team member"
                onClose={() => Ae(null)}
                wide
              >
                <RemoveMember
                  name={x((k.profiles || []).find((e) => e.id === ke.user_id))}
                  email={
                    (k.profiles || []).find((e) => e.id === ke.user_id)
                      ?.email || ``
                  }
                  demo={E}
                  onRemove={() => Xt(ke!)}
                  onCancel={() => Ae(null)}
                />
              </RecordPage>
            ) : (
              L &&
              (L.edit ? (
                L.table === `organization_members` && !L.row.id ? (
                  <RecordPage
                    title="Invite team member"
                    onClose={() => z(null)}
                    wide
                  >
                    <InviteMember
                      owner={zt?.role === `owner`}
                      demo={E}
                      onInvite={Jt}
                      onClose={() => z(null)}
                    />
                  </RecordPage>
                ) : (
                  <RecordEditor
                    table={L.table}
                    initial={L.row}
                    data={k}
                    userId={J}
                    onClose={() => z(null)}
                    onSave={async (e) => {
                      await qt(L.table, e, L.row.id ? L.row : undefined);
                    }}
                  />
                )
              ) : (
                <RecordPage
                  title={
                    L.table === `organization_members`
                      ? x(
                          (k.profiles || []).find(
                            (e) => e.id === L.row.user_id,
                          ),
                        )
                      : x(L.row)
                  }
                  onClose={() => z(null)}
                  wide
                >
                  <div className="modal-content">
                    <div className="detail-heading">
                      <span className="eyebrow light">{b(L.table)}</span>
                      {L.row.status && <Badge value={L.row.status} />}
                    </div>
                    <dl className="record-details">
                      {Object.entries(L.row)
                        .filter(
                          ([e, t]) =>
                            ![`id`, `organization_id`, `embedding`].includes(
                              e,
                            ) &&
                            t !== null &&
                            t !== undefined,
                        )
                        .map(([e, t]) => (
                          <div
                            key={e}
                            className={
                              typeof t === `object` ||
                              [
                                `description`,
                                `recommendation`,
                                `content`,
                                `message`,
                              ].includes(e)
                                ? `span-2`
                                : ``
                            }
                          >
                            <dt>{b(e)}</dt>
                            <dd>
                              {typeof t === `object` ? (
                                <pre>{JSON.stringify(t, null, 2)}</pre>
                              ) : (
                                y(t, e, k)
                              )}
                            </dd>
                          </div>
                        ))}
                    </dl>
                    {L.table === `work_orders` && (
                      <div className="related-tasks">
                        <h3>Tasks</h3>
                        {(k.work_order_tasks || [])
                          .filter((e) => e.work_order_id === L.row.id)
                          .map((e) => (
                            <div key={e.id}>
                              <span>
                                {e.task_number}. {e.title}
                              </span>
                              <Badge value={e.status} />
                            </div>
                          ))}
                        <Button
                          secondary
                          onClick={() =>
                            z({
                              table: `work_order_tasks`,
                              row: {
                                work_order_id: L.row.id,
                                task_number:
                                  (k.work_order_tasks || [])
                                    .filter((e) => e.work_order_id === L.row.id)
                                    .reduce(
                                      (e, t) => Math.max(e, t.task_number),
                                      0,
                                    ) + 1,
                              },
                              edit: true,
                            })
                          }
                        >
                          <Plus size={15} /> Add task
                        </Button>
                      </div>
                    )}
                  </div>
                  <footer className="modal-footer">
                    <Button secondary onClick={() => z(null)}>
                      Close
                    </Button>
                    {L.table === `asset_documents` && !E && (
                      <>
                        <span className="workspace-note">
                          Text: {L.row.metadata?.index_status || `not indexed`}{" "}
                          · Vectors:{" "}
                          {L.row.metadata?.embedding_status ||
                            (L.row.metadata?.retrieval === `hybrid`
                              ? `ready`
                              : `not configured`)}
                        </span>
                        <Button
                          secondary
                          disabled={st}
                          onClick={async () => {
                            ct(true);
                            try {
                              const result = await indexDocument(
                                D,
                                L.row.id,
                                true,
                              );
                              Y(result.message);
                              await Z();
                              z(null);
                            } catch (error) {
                              Y(S(error), true);
                            } finally {
                              ct(false);
                            }
                          }}
                        >
                          Resume vectors
                        </Button>
                        <label className="button secondary upload-button">
                          {st ? `Updating…` : `Replace document`}
                          <input
                            type="file"
                            accept=".pdf,.docx,.txt,.md,.csv,.tsv,.json,.log"
                            disabled={st}
                            onChange={(event) => {
                              const file = event.target.files?.[0];
                              if (file) {
                                void an(
                                  file,
                                  (k.assets || []).find(
                                    (asset) => asset.id === L.row.asset_id,
                                  ),
                                  L.row,
                                );
                                z(null);
                              }
                              event.target.value = ``;
                            }}
                          />
                        </label>
                        <Button
                          secondary
                          disabled={st}
                          onClick={async () => {
                            ct(true);
                            try {
                              const result = await indexDocument(D, L.row.id);
                              Y(result.message);
                              await Z();
                              z(null);
                            } catch (error) {
                              Y(S(error), true);
                            } finally {
                              ct(false);
                            }
                          }}
                        >
                          Index document
                        </Button>
                      </>
                    )}
                    {L.table === `asset_documents` && (
                      <Button secondary onClick={() => void on(L.row)}>
                        <FileText size={15} /> Open document
                      </Button>
                    )}
                    {L.table === `alerts` && L.row.status === `open` && (
                      <Button secondary onClick={() => void tn(L.row)}>
                        <Check size={15} /> Acknowledge
                      </Button>
                    )}
                    {L.table === `alerts` && (
                      <Button
                        secondary
                        onClick={() =>
                          z({
                            table: `work_orders`,
                            row: {
                              title: L.row.title,
                              description: L.row.description,
                              asset_id: L.row.asset_id,
                              site_id: L.row.site_id,
                              alert_id: L.row.id,
                              priority:
                                L.row.severity === `critical`
                                  ? `critical`
                                  : `medium`,
                            },
                            edit: true,
                          })
                        }
                      >
                        <Wrench size={15} /> Create work order
                      </Button>
                    )}
                    {L.table === `organization_members` && Yt(L.row) && (
                      <Button className="danger" onClick={() => Ae(L.row)}>
                        Remove member
                      </Button>
                    )}
                    {!(ve.find((e) => e.key === L.table) as Row)?.readOnly &&
                      (L.table !== `organization_members` || Vt) && (
                        <Button onClick={() => z({ ...L, edit: true })}>
                          Edit record
                        </Button>
                      )}
                  </footer>
                </RecordPage>
              ))
            )}
          </Suspense>
        </main>
        <footer className="app-footer">
          <span>
            Revuptime <span className="footer-dot">·</span> Reliability,
            reimagined.
          </span>
          <span>
            <ShieldCheck size={13} /> Organization-scoped workspace
          </span>
        </footer>
      </div>

      {F && (
        <div className={`toast ` + (F.error ? `error` : ``)} role="status">
          {F.error ? <Bell size={18} /> : <CheckCircle2 size={18} />}
          <span>{F.text}</span>
          <button onClick={() => it(null)} aria-label="Dismiss notification">
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
