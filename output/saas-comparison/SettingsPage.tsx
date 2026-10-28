import { useCallback, useEffect, useState, type ReactNode } from "react";
import type { Dataset, Row } from "../data";
import { authorizedDataClient } from "../data";
import { AlertRules } from "./AlertsPage";
import { DataPointsPage } from "./DataPoints";
import { isE164, normalisePhone } from "./status";
import {
  isPlatformAdmin,
  saveQuickReplies,
  saveWaAccount,
  sendTestAlert,
  setWaAi,
  syncTemplates,
} from "./inboxApi";
import {
  loadOrganization,
  loadProfile,
  saveOrganization,
  saveProfile,
} from "./opsApi";
import { TeamPage } from "./TeamPage";
import {
  AccessLogCard,
  AiOrgCard,
  ContactsCard,
  SharedNumberCard,
} from "./SettingsWhatsApp";
import { NextStepCard, OrganisationForm, PlantsCard } from "./SettingsGeneral";
import { DEFAULT_TZ, TIME_ZONES, setDisplayTimeZone, tzLabel } from "./time";
import {
  Card,
  Dialog,
  Field,
  PageHeader,
  PrimaryButton,
  SecondaryButton,
  StatusPill,
} from "./ui";
import { VibrationStandards } from "./VibrationStandards";

export const SETTINGS_NAV: [string, [string, string][]][] = [
  [
    "Workspace",
    [
      ["general", "General"],
      ["team", "Team and roles"],
      ["plants", "Plants and areas"],
      ["documents", "Document library"],
    ],
  ],
  [
    "Devices and data",
    [
      ["gateways", "Gateways and sensors"],
      ["data-points", "Data points"],
      ["vibration-standards", "Vibration standards"],
    ],
  ],
  [
    "Alerts",
    [
      ["alert-rules", "Alert rules"],
      ["notifications", "WhatsApp and notifications"],
    ],
  ],
  [
    "Account",
    [
      ["profile", "Your profile"],
      ["billing", "Billing and plan"],
      ["security", "Security and API keys"],
    ],
  ],
];
const ALL = SETTINGS_NAV.flatMap(([, items]) => items.map(([k]) => k));
import { ROLE_LABEL } from "./roles";
export { ROLE_LABEL };
const initials = (s: string) =>
  s
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("") || "?";
const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e));
/** "Opted in 24 Oct via WhatsApp" or why alerts are not going out. */
const optInText = (c: Row) =>
  !c.whatsapp
    ? "no number"
    : !c.whatsapp_opt_in
      ? "not opted in, no alerts sent"
      : `opted in${c.whatsapp_opt_in_at ? " " + new Date(c.whatsapp_opt_in_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : ""}${c.whatsapp_opt_in_source ? " via " + (c.whatsapp_opt_in_source === "whatsapp" ? "WhatsApp" : "the app") : ""}`;

export function settingsSection() {
  const s = location.hash.slice(1).split("/")[1] || "general";
  return ALL.includes(s) ? s : "general";
}

type Props = {
  orgId: string;
  userId: string;
  email?: string;
  role?: string;
  data: Dataset;
  demo?: boolean;
  navigate: (page: string) => void;
  notify: (message: string, error?: boolean) => void;
  onChanged: () => void;
  onInvite: () => void;
  onCreateWorkspace: () => void;
  onSignOut: () => void;
  onCreateOrder: (row: Row) => void;
  plants: ReactNode;
  gateways: ReactNode;
  gatewayWizard: ReactNode;
  documents: ReactNode;
};
/** settings/gateways/new opens the gateway wizard inside Settings. */
const settingsSub = () => location.hash.slice(1).split("/")[2] || "";

export function SettingsPage(props: Props) {
  const [section, setSection] = useState(settingsSection);
  const [sub, setSub] = useState(settingsSub);
  useEffect(() => {
    const on = () => {
      setSection(settingsSection());
      setSub(settingsSub());
    };
    window.addEventListener("popstate", on);
    window.addEventListener("hashchange", on);
    return () => {
      window.removeEventListener("popstate", on);
      window.removeEventListener("hashchange", on);
    };
  }, []);
  const go = (key: string) => {
    props.navigate("settings/" + key);
    setSection(key);
    setSub("");
  };
  const canAdmin = props.role === "owner" || props.role === "admin";
  const canManage = canAdmin || props.role === "manager";
  const canWrite = canManage || props.role === "technician";

  return (
    <div className="rv-page rv-settings">
      <PageHeader
        title="Settings"
        subtitle="Organisation, team, devices, data and alerts, all in one place."
      />
      <div className="rv-settings-layout">
        <nav className="rv-settings-nav" aria-label="Settings">
          {SETTINGS_NAV.map(([group, items]) => (
            <div key={group}>
              <p className="rv-settings-group">{group}</p>
              {items.map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  className={section === key ? "is-on" : ""}
                  aria-current={section === key ? "page" : undefined}
                  onClick={() => go(key)}
                >
                  {label}
                </button>
              ))}
            </div>
          ))}
        </nav>
        <div className="rv-settings-body">
          {section === "general" && (
            <General {...props} canAdmin={canAdmin} go={go} />
          )}
          {section === "team" && (
            <TeamPage
              orgId={props.orgId}
              userId={props.userId}
              role={props.role}
              data={props.data}
              demo={props.demo}
              canAdmin={canAdmin}
              notify={props.notify}
              onChanged={props.onChanged}
            />
          )}
          {section === "plants" && props.plants}
          {section === "gateways" &&
            (sub === "new" ? props.gatewayWizard : props.gateways)}
          {section === "documents" && props.documents}
          {section === "data-points" && (
            <DataPointsPage
              orgId={props.orgId}
              userId={props.userId}
              data={props.data}
              canManage={canManage}
              canWrite={canWrite}
              notify={props.notify}
            />
          )}
          {section === "vibration-standards" && (
            <VibrationStandards
              orgId={props.orgId}
              data={props.data}
              canManage={canManage}
              canAdmin={canAdmin}
              notify={props.notify}
              onChanged={props.onChanged}
            />
          )}
          {section === "alert-rules" && (
            <AlertRules
              orgId={props.orgId}
              data={props.data}
              canManage={canManage}
              notify={props.notify}
            />
          )}
          {section === "notifications" && (
            <Notifications {...props} canAdmin={canAdmin} go={go} />
          )}
          {section === "profile" && <ProfileCard {...props} full />}
          {section === "billing" && (
            <Card className="rv-soon">
              <StatusPill tone="info">Coming soon</StatusPill>
              <h2 className="rv-section-title">Billing and plan</h2>
              <p className="rv-muted">
                Plan changes and invoices will live here. Until then, your
                RevUptime account manager handles billing; write to them for
                anything you need.
              </p>
            </Card>
          )}
          {section === "security" && (
            <Card className="rv-soon">
              <StatusPill tone="info">Coming soon</StatusPill>
              <h2 className="rv-section-title">Security and API keys</h2>
              <p className="rv-muted">
                Personal API keys are not available yet. Each gateway already
                has its own login, which you manage under Gateways and sensors.
              </p>
              <SecondaryButton onClick={props.onSignOut}>
                Sign out of this browser
              </SecondaryButton>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function General(p: Props & { canAdmin: boolean; go: (k: string) => void }) {
  return (
    <>
      <NextStepCard
        orgId={p.orgId}
        demo={p.demo}
        go={p.go}
        navigate={p.navigate}
      />
      <OrganisationForm
        orgId={p.orgId}
        demo={p.demo}
        canAdmin={p.canAdmin}
        notify={p.notify}
        onChanged={p.onChanged}
      />
      <PlantsCard data={p.data} go={p.go} />
      <Card className="rv-row-card">
        <div>
          <h2 className="rv-section-title">Workspaces</h2>
          <p className="rv-muted">
            Run a separate workspace for another company or a pilot customer.
          </p>
        </div>
        <SecondaryButton onClick={p.onCreateWorkspace} disabled={p.demo}>
          Create another workspace
        </SecondaryButton>
      </Card>
    </>
  );
}

function ProfileCard(p: Props & { full?: boolean }) {
  const [profile, setProfile] = useState<Row | null>(null);
  const [edit, setEdit] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const load = useCallback(() => {
    if (p.demo || !p.userId) return;
    loadProfile(p.userId)
      .then((r) => setProfile(r || { id: p.userId }))
      .catch((e) => setError(errorText(e)));
  }, [p.userId, p.demo]);
  useEffect(load, [load]);
  const plants = p.data.sites || [];
  if (!profile)
    return (
      <Card>
        <p className="rv-muted">{error || "Loading profile…"}</p>
      </Card>
    );
  const prefs = profile.alert_prefs || {
    severities: ["critical"],
    plants: "all",
  };
  const set = (k: string, v: unknown) => setProfile({ ...profile, [k]: v });
  const setPref = (k: string, v: unknown) =>
    set("alert_prefs", { ...prefs, [k]: v });
  const name = profile.full_name || p.email || "Your account";
  const prefLabel = `${(prefs.severities || []).map((s: string) => s[0].toUpperCase() + s.slice(1)).join(" + ") || "None"} · ${
    prefs.plants === "all"
      ? "all plants"
      : plants
          .filter((s) => (prefs.plants || []).includes(s.id))
          .map((s) => s.name)
          .join(", ") || "no plants"
  }`;

  async function save() {
    const wa = profile!.whatsapp ? normalisePhone(profile!.whatsapp) : null;
    if (wa && !isE164(wa))
      return setError(
        "Enter the WhatsApp number with country code, for example +919876543210.",
      );
    setBusy(true);
    setError("");
    try {
      await saveProfile(p.userId, {
        job_title: profile!.job_title || null,
        timezone: profile!.timezone || null,
        whatsapp: wa,
        alert_prefs: prefs,
      });
      setDisplayTimeZone(profile!.timezone || DEFAULT_TZ);
      setEdit(false);
      p.notify("Profile saved.");
      p.onChanged();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className={p.full ? "" : "rv-profile-card"}>
      <div className="rv-card-head">
        <h2 className="rv-section-title">Your profile</h2>
        {!edit ? (
          <SecondaryButton onClick={() => setEdit(true)}>Edit</SecondaryButton>
        ) : (
          <div className="rv-actions-inline">
            <SecondaryButton
              onClick={() => {
                setEdit(false);
                load();
              }}
            >
              Cancel
            </SecondaryButton>
            <PrimaryButton onClick={() => void save()} busy={busy}>
              Save
            </PrimaryButton>
          </div>
        )}
      </div>
      <div className="rv-person">
        <span className="rv-avatar rv-avatar-lg">{initials(name)}</span>
        <div>
          <strong>{name}</strong>
          <span className="rv-muted rv-block">
            {ROLE_LABEL[p.role || "member"]} · {p.email}
          </span>
        </div>
      </div>
      {!edit ? (
        <dl className="rv-dl">
          <div>
            <dt>Job title</dt>
            <dd>
              {profile.job_title || (
                <button
                  type="button"
                  className="rv-link"
                  onClick={() => setEdit(true)}
                >
                  Add job title
                </button>
              )}
            </dd>
          </div>
          <div>
            <dt>Time zone</dt>
            <dd>
              {profile.timezone
                ? tzLabel(profile.timezone)
                : `Plant time (${tzLabel(DEFAULT_TZ)})`}
            </dd>
          </div>
          <div>
            <dt>WhatsApp for alerts</dt>
            <dd>
              {profile.whatsapp || (
                <button
                  type="button"
                  className="rv-link"
                  onClick={() => setEdit(true)}
                >
                  Add number
                </button>
              )}
            </dd>
          </div>
          <div>
            <dt>Alerts I receive</dt>
            <dd>{prefLabel}</dd>
          </div>
        </dl>
      ) : (
        <div className="rv-form-stack">
          <Field label="Job title">
            {(id) => (
              <input
                id={id}
                value={profile.job_title || ""}
                onChange={(e) => set("job_title", e.target.value)}
              />
            )}
          </Field>
          <Field
            label="Time zone"
            hint="Leave on plant time to see each plant's local time."
          >
            {(id) => (
              <select
                id={id}
                value={profile.timezone || ""}
                onChange={(e) => set("timezone", e.target.value || null)}
              >
                <option value="">Plant time</option>
                {TIME_ZONES.map((t) => (
                  <option key={t} value={t}>
                    {tzLabel(t)}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field
            label="WhatsApp for alerts"
            hint="With country code, for example +919876543210."
          >
            {(id) => (
              <input
                id={id}
                inputMode="tel"
                value={profile.whatsapp || ""}
                onChange={(e) => set("whatsapp", e.target.value)}
              />
            )}
          </Field>
          <fieldset className="rv-checks">
            <legend>Alerts I receive on WhatsApp</legend>
            {["critical", "warning", "device"].map((s) => (
              <label key={s}>
                <input
                  type="checkbox"
                  checked={(prefs.severities || []).includes(s)}
                  onChange={(e) =>
                    setPref(
                      "severities",
                      e.target.checked
                        ? [...(prefs.severities || []), s]
                        : (prefs.severities || []).filter(
                            (x: string) => x !== s,
                          ),
                    )
                  }
                />
                {s[0].toUpperCase() + s.slice(1)}
              </label>
            ))}
          </fieldset>
          <Field label="For plants">
            {(id) => (
              <select
                id={id}
                value={
                  prefs.plants === "all"
                    ? "all"
                    : (prefs.plants || [])[0] || "all"
                }
                onChange={(e) =>
                  setPref(
                    "plants",
                    e.target.value === "all" ? "all" : [e.target.value],
                  )
                }
              >
                <option value="all">All plants</option>
                {plants.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            )}
          </Field>
        </div>
      )}
      {error && (
        <p className="rv-error-box" role="alert">
          {error}
        </p>
      )}
    </Card>
  );
}

function Team(p: Props & { canAdmin: boolean; full?: boolean }) {
  const members = (p.data.organization_members || []).filter(
    (m) => m.status !== "inactive",
  );
  const profiles = p.data.profiles || [];
  return (
    <Card>
      <div className="rv-card-head">
        <h2 className="rv-section-title">Team</h2>
        {p.canAdmin && (
          <PrimaryButton onClick={p.onInvite}>Invite member</PrimaryButton>
        )}
      </div>
      <ul className="rv-people">
        {members.slice(0, p.full ? 200 : 6).map((m) => {
          const pr = profiles.find((x) => x.id === m.user_id);
          const name = pr?.full_name || pr?.email || "Member";
          return (
            <li key={m.id}>
              <span className="rv-avatar">{initials(name)}</span>
              <span>
                <strong>{name}</strong>
                <small className="rv-muted rv-block">
                  {m.status === "invited"
                    ? "Invitation sent"
                    : pr?.job_title || "All plants"}
                </small>
              </span>
              <StatusPill tone="info">
                {ROLE_LABEL[m.role] || m.role}
              </StatusPill>
            </li>
          );
        })}
      </ul>
      <p className="rv-hint">
        Roles: Owner and Admin manage settings · Manager manages devices, data
        points and rules · Engineer acknowledges alerts and edits assets ·
        Viewer reads only.
      </p>
    </Card>
  );
}

function Notifications(
  p: Props & { canAdmin: boolean; go: (k: string) => void },
) {
  const [org, setOrg] = useState<Row | null>(null);
  const [contacts, setContacts] = useState<Row[]>([]);
  const [log, setLog] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (p.demo || !p.orgId) return;
    const c = authorizedDataClient();
    loadOrganization(p.orgId)
      .then(setOrg)
      .catch((e) => setError(errorText(e)));
    c.from("site_contacts")
      .select("*")
      .eq("organization_id", p.orgId)
      .then(({ data }) => setContacts(data || []));
    c.from("notification_log")
      .select(
        "id, created_at, status, recipient_name, recipient_role, kind, error, body",
      )
      .eq("organization_id", p.orgId)
      .order("created_at", { ascending: false })
      .limit(20)
      .then(({ data }) => setLog(data || []));
  }, [p.orgId, p.demo]);
  const hours = Array.from({ length: 24 }, (_, h) => h);
  const [superAdmin, setSuperAdmin] = useState(false);
  useEffect(() => {
    isPlatformAdmin()
      .then(setSuperAdmin)
      .catch(() => setSuperAdmin(false));
  }, []);
  const canWriteHere =
    p.canAdmin || ["manager", "technician"].includes(p.role || "");
  const sent = log.filter((l) =>
    ["sent", "delivered", "read"].includes(l.status),
  ).length;
  const queued = log.filter((l) => l.status === "queued").length;

  async function save() {
    setBusy(true);
    setError("");
    try {
      await saveOrganization(p.orgId, {
        quiet_hours_start: Number(org!.quiet_hours_start),
        quiet_hours_end: Number(org!.quiet_hours_end),
        digest_hour: Number(org!.digest_hour),
        alert_cooldown_minutes: Number(org!.alert_cooldown_minutes || 60),
      });
      p.notify("Notification settings saved.");
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {!p.demo && (
        <SharedNumberCard
          orgId={p.orgId}
          canWrite={canWriteHere}
          notify={p.notify}
        />
      )}
      {!p.demo && (
        <ContactsCard
          orgId={p.orgId}
          data={p.data}
          canWrite={canWriteHere}
          notify={p.notify}
        />
      )}
      {!p.demo && (
        <AiOrgCard orgId={p.orgId} canAdmin={p.canAdmin} notify={p.notify} />
      )}
      <Card>
        <div className="rv-card-head">
          <div>
            <h2 className="rv-section-title">
              Quiet hours and morning summary
            </h2>
            <p className="rv-muted">
              During quiet hours (plant time) only critical alerts send
              WhatsApp. Warnings wait for the morning summary.
            </p>
          </div>
          {p.canAdmin && org && (
            <PrimaryButton onClick={() => void save()} busy={busy}>
              Save
            </PrimaryButton>
          )}
        </div>
        {org && (
          <fieldset disabled={!p.canAdmin} className="rv-grid-3">
            {(
              [
                ["quiet_hours_start", "Quiet from"],
                ["quiet_hours_end", "Quiet until"],
                ["digest_hour", "Morning summary at"],
              ] as const
            ).map(([k, label]) => (
              <Field key={k} label={label}>
                {(id) => (
                  <select
                    id={id}
                    value={org[k]}
                    onChange={(e) => setOrg({ ...org, [k]: e.target.value })}
                  >
                    {hours.map((h) => (
                      <option key={h} value={h}>
                        {String(h).padStart(2, "0")}:00
                      </option>
                    ))}
                  </select>
                )}
              </Field>
            ))}
            <Field
              label="Repeat alerts for the same machine and metric"
              hint="At most one WhatsApp alert per contact in this time. Escalations still go out."
            >
              {(id) => (
                <select
                  id={id}
                  value={org.alert_cooldown_minutes ?? 60}
                  onChange={(e) =>
                    setOrg({
                      ...org,
                      alert_cooldown_minutes: Number(e.target.value),
                    })
                  }
                >
                  {[15, 30, 60, 120, 240, 480].map((m) => (
                    <option key={m} value={m}>
                      {m < 60
                        ? `${m} minutes`
                        : `${m / 60} hour${m === 60 ? "" : "s"}`}
                    </option>
                  ))}
                </select>
              )}
            </Field>
          </fieldset>
        )}
      </Card>
      {!p.demo && superAdmin && (
        <WhatsAppNumbers
          orgId={p.orgId}
          userId={p.userId}
          canAdmin={p.canAdmin}
          canSync={["owner", "admin", "manager"].includes(p.role || "")}
          notify={p.notify}
        />
      )}
      <Card>
        <h2 className="rv-section-title">WhatsApp delivery</h2>
        <p className="rv-muted">
          {log.length === 0
            ? "No WhatsApp messages yet."
            : `${sent} of the last ${log.length} messages sent${queued ? `, ${queued} waiting` : ""}.`}{" "}
          Messages are sent by the RevUptime worker with your WhatsApp Business
          account. If messages stay queued, the WhatsApp connection is not set
          up yet.
        </p>
        {!!log.length && (
          <ul className="rv-mini-log">
            {log.slice(0, 8).map((l) => (
              <li key={l.id}>
                <StatusPill
                  tone={
                    l.status === "failed"
                      ? "act"
                      : ["sent", "delivered", "read"].includes(l.status)
                        ? "good"
                        : "offline"
                  }
                >
                  {l.status}
                </StatusPill>
                <span>
                  {l.recipient_name || "Contact"} · {l.kind}
                </span>
                {l.error && <small className="rv-muted">{l.error}</small>}
              </li>
            ))}
          </ul>
        )}
        {error && (
          <p className="rv-error-box" role="alert">
            {error}
          </p>
        )}
      </Card>
      {!p.demo && p.canAdmin && <AccessLogCard orgId={p.orgId} />}
    </>
  );
}

const WEBHOOK_URL =
  "https://rdmpjlaffzudjcchkxuh.supabase.co/functions/v1/whatsapp-webhook";

/** Business numbers whose WhatsApp messages land in the Inbox. Tokens stay in Supabase secrets, never here. */
function WhatsAppNumbers({
  orgId,
  userId,
  canAdmin,
  canSync,
  notify,
}: {
  orgId: string;
  userId: string;
  canAdmin: boolean;
  canSync: boolean;
  notify: (m: string) => void;
}) {
  const [accounts, setAccounts] = useState<Row[] | null>(null);
  const [templates, setTemplates] = useState<Row[]>([]);
  const [draft, setDraft] = useState<Row | null>(null);
  const [aiConfirm, setAiConfirm] = useState<Row | null>(null);
  const [superAdmin, setSuperAdmin] = useState(false);
  const [optedIn, setOptedIn] = useState<Row[]>([]);
  const [testTo, setTestTo] = useState("");
  const [replies, setReplies] = useState<{ id: string; text: string } | null>(
    null,
  );
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const load = useCallback(() => {
    const c = authorizedDataClient();
    c.from("wa_accounts")
      .select("*")
      .eq("organization_id", orgId)
      .order("created_at")
      .then(({ data, error }) => setAccounts(error ? [] : data || []));
    c.from("wa_templates")
      .select("id, wa_account_id, name, language, status, body_text")
      .eq("organization_id", orgId)
      .then(({ data }) => setTemplates(data || []));
  }, [orgId]);
  useEffect(load, [load]);
  useEffect(() => {
    isPlatformAdmin()
      .then((yes) => {
        setSuperAdmin(yes);
        if (yes)
          authorizedDataClient()
            .from("site_contacts")
            .select("id, name, whatsapp")
            .eq("organization_id", orgId)
            .eq("whatsapp_opt_in", true)
            .order("name")
            .then(({ data }) => setOptedIn(data || []));
      })
      .catch(() => setSuperAdmin(false));
  }, [orgId]);

  async function testAlert() {
    setBusy("test");
    setError("");
    try {
      const r = await sendTestAlert(testTo);
      notify(
        `Test alert sent to ${r.sent_to}. Check WhatsApp, then try the buttons.`,
      );
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy("");
    }
  }

  async function save() {
    setBusy("save");
    setError("");
    try {
      if (
        !/^\d{5,30}$/.test(String(draft!.waba_id || "").trim()) ||
        !/^\d{5,30}$/.test(String(draft!.phone_number_id || "").trim())
      )
        throw new Error(
          "The WhatsApp Business account id and phone number id are digits only (Meta › WhatsApp › API setup).",
        );
      if (!isE164(normalisePhone(draft!.display_phone || "")))
        throw new Error(
          "Enter the number with country code, for example +91 98765 43210.",
        );
      await saveWaAccount(
        orgId,
        { ...draft, display_phone: normalisePhone(draft!.display_phone) },
        userId,
      );
      notify(
        draft!.id ? "WhatsApp number updated." : "WhatsApp number connected.",
      );
      setDraft(null);
      load();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy("");
    }
  }
  async function sync(id: string) {
    setBusy(id);
    setError("");
    try {
      const r = await syncTemplates(id);
      notify(
        `Templates synced: ${r.approved ?? 0} approved of ${r.templates ?? 0}.`,
      );
      load();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy("");
    }
  }

  async function toggleAi(a: Row, on: boolean) {
    setBusy("ai" + a.id);
    setError("");
    try {
      await setWaAi(a.id, on);
      notify(
        on
          ? "AI assistant turned on. New chats from plant contacts start with the AI."
          : "AI assistant turned off. Your team answers all chats.",
      );
      setAiConfirm(null);
      load();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy("");
    }
  }

  return (
    <Card>
      <div className="rv-card-head">
        <div>
          <h2 className="rv-section-title">WhatsApp numbers</h2>
          <p className="rv-muted">
            Customer messages to these numbers appear in the Inbox. Alerts keep
            using the worker's sender number.
          </p>
        </div>
        {canAdmin && !draft && (
          <SecondaryButton onClick={() => setDraft({ status: "active" })}>
            Connect a number
          </SecondaryButton>
        )}
      </div>
      {accounts === null ? (
        <p className="rv-muted">Loading…</p>
      ) : !accounts.length && !draft ? (
        <p className="rv-muted">No WhatsApp number connected yet.</p>
      ) : (
        <ul className="rv-people">
          {accounts.map((a) => {
            const t = templates.filter((x) => x.wa_account_id === a.id);
            return (
              <li key={a.id}>
                <span>
                  <strong>{a.display_name || a.display_phone}</strong>{" "}
                  <StatusPill tone={a.status === "active" ? "good" : "offline"}>
                    {a.status === "active" ? "Active" : "Disabled"}
                  </StatusPill>{" "}
                  {a.ai_enabled && (
                    <StatusPill tone="info">AI assistant on</StatusPill>
                  )}
                  <small className="rv-muted rv-block">
                    {a.display_phone} · phone number id {a.phone_number_id} ·{" "}
                    {t.filter((x) => x.status === "APPROVED").length} approved
                    templates
                  </small>
                </span>
                <span className="rv-row-actions">
                  {canSync && (
                    <SecondaryButton
                      disabled={busy === a.id}
                      onClick={() => void sync(a.id)}
                    >
                      {busy === a.id ? "Syncing…" : "Sync templates"}
                    </SecondaryButton>
                  )}
                  {canAdmin && (
                    <SecondaryButton
                      disabled={busy === "ai" + a.id}
                      onClick={() =>
                        a.ai_enabled ? void toggleAi(a, false) : setAiConfirm(a)
                      }
                    >
                      {a.ai_enabled ? "Turn AI off" : "Turn AI on"}
                    </SecondaryButton>
                  )}
                  {canAdmin && (
                    <SecondaryButton
                      onClick={() =>
                        setReplies({
                          id: a.id,
                          text: (a.quick_replies || []).join("\n"),
                        })
                      }
                    >
                      Quick replies
                    </SecondaryButton>
                  )}
                  {canAdmin && (
                    <SecondaryButton onClick={() => setDraft({ ...a })}>
                      Edit
                    </SecondaryButton>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      )}
      {!!templates.length && (
        <>
          <h3 className="rv-subtitle">Message templates</h3>
          <ul className="rv-people">
            {templates.map((t) => (
              <li key={t.id}>
                <span>
                  <strong>{t.name}</strong>{" "}
                  <small className="rv-muted">{t.language}</small>
                  <small className="rv-muted rv-block rv-mono">
                    {t.body_text || "No body text synced yet"}
                  </small>
                </span>
                <StatusPill
                  tone={
                    t.status === "APPROVED"
                      ? "good"
                      : t.status === "REJECTED"
                        ? "act"
                        : "watch"
                  }
                >
                  {t.status === "APPROVED"
                    ? "Approved"
                    : t.status === "REJECTED"
                      ? "Rejected"
                      : t.status === "PENDING"
                        ? "In review"
                        : t.status}
                </StatusPill>
              </li>
            ))}
          </ul>
        </>
      )}
      {draft && (
        <div className="rv-grid-2">
          <Field label="WhatsApp Business account id">
            {(id) => (
              <input
                id={id}
                inputMode="numeric"
                value={draft.waba_id || ""}
                onChange={(e) =>
                  setDraft({ ...draft, waba_id: e.target.value })
                }
              />
            )}
          </Field>
          <Field label="Phone number id">
            {(id) => (
              <input
                id={id}
                inputMode="numeric"
                value={draft.phone_number_id || ""}
                onChange={(e) =>
                  setDraft({ ...draft, phone_number_id: e.target.value })
                }
              />
            )}
          </Field>
          <Field label="Number" hint="With country code">
            {(id) => (
              <input
                id={id}
                type="tel"
                placeholder="+91 98765 43210"
                value={draft.display_phone || ""}
                onChange={(e) =>
                  setDraft({ ...draft, display_phone: e.target.value })
                }
              />
            )}
          </Field>
          <Field label="Name shown in the inbox">
            {(id) => (
              <input
                id={id}
                value={draft.display_name || ""}
                onChange={(e) =>
                  setDraft({ ...draft, display_name: e.target.value })
                }
              />
            )}
          </Field>
          {draft.id && (
            <Field label="Status">
              {(id) => (
                <select
                  id={id}
                  value={draft.status}
                  onChange={(e) =>
                    setDraft({ ...draft, status: e.target.value })
                  }
                >
                  <option value="active">Active</option>
                  <option value="disabled">
                    Disabled (ignore incoming messages)
                  </option>
                </select>
              )}
            </Field>
          )}
          <div className="rv-form-actions">
            <SecondaryButton
              onClick={() => {
                setDraft(null);
                setError("");
              }}
            >
              Cancel
            </SecondaryButton>
            <PrimaryButton busy={busy === "save"} onClick={() => void save()}>
              {draft.id ? "Save" : "Connect"}
            </PrimaryButton>
          </div>
        </div>
      )}
      {replies && (
        <div className="rv-test-alert">
          <label htmlFor="quick-replies">
            <strong>Quick replies</strong>{" "}
            <span className="rv-muted rv-small">
              One per line, up to 8. They appear as chips above the Inbox reply
              box.
            </span>
          </label>
          <textarea
            id="quick-replies"
            rows={4}
            value={replies.text}
            onChange={(e) => setReplies({ ...replies, text: e.target.value })}
          />
          <div className="rv-form-actions">
            <SecondaryButton onClick={() => setReplies(null)}>
              Cancel
            </SecondaryButton>
            <PrimaryButton
              busy={busy === "replies"}
              onClick={async () => {
                setBusy("replies");
                setError("");
                try {
                  await saveQuickReplies(
                    replies.id,
                    replies.text
                      .split("\n")
                      .map((t) => t.trim())
                      .filter(Boolean)
                      .slice(0, 8),
                  );
                  notify("Quick replies saved.");
                  setReplies(null);
                  load();
                } catch (e) {
                  setError(errorText(e));
                } finally {
                  setBusy("");
                }
              }}
            >
              Save quick replies
            </PrimaryButton>
          </div>
        </div>
      )}
      {superAdmin && !!accounts?.length && (
        <div className="rv-test-alert">
          <strong>Send test alert</strong>{" "}
          <span className="rv-muted rv-small">
            Super admin · sends the machine-alert template with sample values.
            No alert is created.
          </span>
          <div className="rv-wa-compose-row">
            <label className="rv-sr-only" htmlFor="test-alert-to">
              Contact
            </label>
            <select
              id="test-alert-to"
              value={testTo}
              onChange={(e) => setTestTo(e.target.value)}
            >
              <option value="">
                {optedIn.length
                  ? "Choose an opted-in contact"
                  : "No contacts have opted in yet (Plants › contacts)"}
              </option>
              {optedIn.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} · {c.whatsapp}
                </option>
              ))}
            </select>
            <PrimaryButton
              busy={busy === "test"}
              disabled={!testTo}
              onClick={() => void testAlert()}
            >
              Send test
            </PrimaryButton>
          </div>
        </div>
      )}
      {error && (
        <p className="rv-error-box" role="alert">
          {error}
        </p>
      )}
      <Dialog
        open={!!aiConfirm}
        title={`Turn on the AI assistant for ${aiConfirm?.display_name || aiConfirm?.display_phone || "this number"}?`}
        onClose={() => setAiConfirm(null)}
        footer={
          <>
            <SecondaryButton onClick={() => setAiConfirm(null)}>
              Cancel
            </SecondaryButton>
            <PrimaryButton
              busy={busy === "ai" + aiConfirm?.id}
              onClick={() => aiConfirm && void toggleAi(aiConfirm, true)}
            >
              Turn on
            </PrimaryButton>
          </>
        }
      >
        <ul className="rv-ai-consent">
          <li>
            The assistant replies on WhatsApp to your{" "}
            <strong>plant contacts</strong> only, recognised by their verified
            WhatsApp number. Messages from other numbers stay with your team.
          </li>
          <li>
            It reads that contact's plant only: machine health, sensor readings,
            open alerts, maintenance history and matching passages from indexed
            manuals. It cannot change anything.
          </li>
          <li>
            To answer, the question and that data are sent to OpenRouter (model
            openai/gpt-4o-mini).
          </li>
          <li>
            New chats from plant contacts start with the AI. For existing chats,
            choose AI in the Inbox. Choose Human at any time to take over.
          </li>
          <li>
            Safety issues, requests to change things and questions it cannot
            answer are handed to your team.
          </li>
        </ul>
      </Dialog>
      {canAdmin && (
        <details className="rv-details">
          <summary>Webhook setup in Meta</summary>
          <p className="rv-muted rv-small">
            Callback URL <code>{WEBHOOK_URL}</code>. Use the verify token stored
            as the WA_VERIFY_TOKEN secret, and subscribe to messages,
            smb_message_echoes and history. Access token and app secret are set
            only as Supabase secrets.
          </p>
        </details>
      )}
    </Card>
  );
}
