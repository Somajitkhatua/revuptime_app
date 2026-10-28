// Settings > Team and roles: who is in the workspace, what each person can do, and a drawer to invite more people.
import { useMemo, useState } from "react";
import { X } from "lucide-react";
import type { Dataset, Row } from "../data";
import { authorizedDataClient, currentRequestToken } from "../data";
import { teamRequest } from "../TeamInvitation";
import { ROLE_LABEL } from "./roles";
import { parseEmails } from "./teamEmails";
import {
  Card,
  Dialog,
  PageHeader,
  PrimaryButton,
  SecondaryButton,
  StatusPill,
} from "./ui";

const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e));
const initials = (s: string) =>
  s
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("") || "?";

export const ROLE_RULES: [string, string, string][] = [
  [
    "owner",
    "Owner",
    "Everything, including members, billing and deleting the workspace. There is always at least one.",
  ],
  [
    "admin",
    "Admin",
    "Manage settings, members and every plant. Cannot remove the owner.",
  ],
  [
    "manager",
    "Manager",
    "Manage gateways, data points, alert rules and plants. Cannot manage members.",
  ],
  [
    "technician",
    "Engineer",
    "Acknowledge alerts, edit machines, add readings and work orders.",
  ],
  ["viewer", "Viewer", "Read everything, change nothing."],
];

export function TeamPage(p: {
  orgId: string;
  userId: string;
  role?: string;
  data: Dataset;
  demo?: boolean;
  canAdmin: boolean;
  notify: (m: string, error?: boolean) => void;
  onChanged: () => void;
}) {
  const [drawer, setDrawer] = useState(false);
  const [emails, setEmails] = useState("");
  const [role, setRole] = useState("technician");
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<
    { email: string; ok: boolean; message: string }[]
  >([]);
  const [removing, setRemoving] = useState<Row | null>(null);
  const [savingRole, setSavingRole] = useState("");

  const members = useMemo(
    () =>
      (p.data.organization_members || []).filter(
        (m) => m.status !== "inactive",
      ),
    [p.data.organization_members],
  );
  const profiles = p.data.profiles || [];
  const isOwner = p.role === "owner";
  const who = (m: Row) => profiles.find((x) => x.id === m.user_id);
  const parsed = parseEmails(emails);
  const grantable = isOwner
    ? ["admin", "manager", "technician", "viewer"]
    : ["manager", "technician", "viewer"];

  async function token() {
    const t = currentRequestToken();
    if (!t) throw new Error("Please sign in again.");
    return t;
  }
  async function invite(list: string[], r: string) {
    const t = await token();
    const out: { email: string; ok: boolean; message: string }[] = [];
    for (const email of list) {
      try {
        const res = await teamRequest(
          "invite",
          { email, role: r, organization_id: p.orgId },
          t,
        );
        out.push({
          email,
          ok: true,
          message: String(res?.message || "Invitation sent."),
        });
      } catch (e) {
        out.push({ email, ok: false, message: errorText(e) });
      }
    }
    return out;
  }
  async function send() {
    if (!parsed.valid.length || parsed.invalid.length) return;
    setBusy(true);
    setResults([]);
    const out = await invite(parsed.valid, role);
    setResults(out);
    setBusy(false);
    const ok = out.filter((x) => x.ok).length;
    if (ok) {
      p.notify(
        ok === out.length
          ? "Saved"
          : `${ok} of ${out.length} invitations sent.`,
      );
      p.onChanged();
    }
    if (ok === out.length) setEmails("");
    else
      setEmails(
        out
          .filter((x) => !x.ok)
          .map((x) => x.email)
          .join("\n"),
      );
  }
  async function resend(m: Row) {
    const email = who(m)?.email;
    if (!email)
      return p.notify("This invitation has no email address to send to.", true);
    const [r] = await invite([email], m.role);
    p.notify(r.ok ? "Invitation sent again." : r.message, !r.ok);
  }
  async function changeRole(m: Row, next: string) {
    setSavingRole(m.id);
    try {
      const { error } = await authorizedDataClient()
        .from("organization_members")
        .update({ role: next })
        .eq("id", m.id);
      if (error) throw new Error(error.message);
      p.notify("Saved");
      p.onChanged();
    } catch (e) {
      p.notify(errorText(e), true);
    } finally {
      setSavingRole("");
    }
  }
  async function remove() {
    if (!removing) return;
    setBusy(true);
    try {
      await teamRequest(
        "remove",
        { organization_id: p.orgId, member_id: removing.id },
        await token(),
      );
      p.notify(
        `${who(removing)?.full_name || who(removing)?.email || "The member"} was removed from this workspace.`,
      );
      setRemoving(null);
      p.onChanged();
    } catch (e) {
      p.notify(errorText(e), true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rv-page">
      <PageHeader
        crumb="Settings"
        title="Team and roles"
        subtitle="Who can sign in to this workspace and what they can do."
        actions={
          p.canAdmin && !p.demo ? (
            <PrimaryButton
              onClick={() => {
                setDrawer(true);
                setResults([]);
              }}
            >
              Invite people
            </PrimaryButton>
          ) : undefined
        }
      />
      <Card className="rv-table-card">
        <table className="rv-table">
          <thead>
            <tr>
              <th scope="col">Person</th>
              <th scope="col">Role</th>
              <th scope="col">Alerts for</th>
              <th scope="col">WhatsApp</th>
              <th scope="col">
                <span className="rv-sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => {
              const pr = who(m);
              const name = pr?.full_name || pr?.email || "Member";
              const self = m.user_id === p.userId;
              const locked =
                m.role === "owner" ||
                self ||
                !p.canAdmin ||
                (!isOwner && m.role === "admin");
              const prefs = pr?.alert_prefs;
              const plantsText =
                !prefs || prefs.plants === "all"
                  ? "All plants"
                  : (p.data.sites || [])
                      .filter((s) => (prefs.plants || []).includes(s.id))
                      .map((s) => s.name)
                      .join(", ") || "No plants";
              return (
                <tr key={m.id}>
                  <td data-label="Person">
                    <span className="rv-person-cell">
                      <span className="rv-avatar">{initials(name)}</span>
                      <span>
                        <strong>
                          {name}
                          {self ? " (you)" : ""}
                        </strong>
                        <small className="rv-muted rv-block">{pr?.email}</small>
                      </span>
                    </span>
                  </td>
                  <td data-label="Role">
                    {m.role === "owner" ? (
                      <StatusPill tone="info">Owner</StatusPill>
                    ) : locked ? (
                      <StatusPill tone="offline">
                        {ROLE_LABEL[m.role] || m.role}
                      </StatusPill>
                    ) : (
                      <select
                        aria-label={`Role for ${name}`}
                        value={m.role === "member" ? "viewer" : m.role}
                        disabled={savingRole === m.id}
                        onChange={(e) => void changeRole(m, e.target.value)}
                      >
                        {[
                          ...new Set([
                            m.role === "member" ? "viewer" : m.role,
                            ...grantable,
                          ]),
                        ].map((r) => (
                          <option key={r} value={r}>
                            {ROLE_LABEL[r] || r}
                          </option>
                        ))}
                      </select>
                    )}
                    {m.status === "invited" && (
                      <span className="rv-muted rv-block">Invitation sent</span>
                    )}
                  </td>
                  <td data-label="Alerts for">{plantsText}</td>
                  <td data-label="WhatsApp">
                    {pr?.whatsapp ? (
                      <span className="rv-mono">{pr.whatsapp}</span>
                    ) : (
                      <span className="rv-muted">
                        {self ? "Add it in Your profile" : "None"}
                      </span>
                    )}
                  </td>
                  <td className="rv-actions-cell">
                    <div className="rv-row-actions">
                      {p.canAdmin && !p.demo && m.status === "invited" && (
                        <SecondaryButton onClick={() => void resend(m)}>
                          Resend invite
                        </SecondaryButton>
                      )}
                      {p.canAdmin &&
                        !p.demo &&
                        !self &&
                        m.role !== "owner" &&
                        (isOwner || m.role !== "admin") && (
                          <SecondaryButton
                            danger
                            onClick={() => setRemoving(m)}
                          >
                            Remove
                          </SecondaryButton>
                        )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      <Card>
        <h2 className="rv-section-title">What each role can do</h2>
        <dl className="rv-roles">
          {ROLE_RULES.map(([key, label, text]) => (
            <div key={key}>
              <dt>{label}</dt>
              <dd>{text}</dd>
            </div>
          ))}
        </dl>
        <p className="rv-hint">
          These are enforced by the database, not just hidden in the screens.
        </p>
      </Card>

      {drawer && (
        <div
          className="rv-drawer-wrap"
          onMouseDown={(e) =>
            e.target === e.currentTarget && !busy && setDrawer(false)
          }
        >
          <aside
            className="rv-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Invite people"
          >
            <header>
              <h2>Invite people</h2>
              <button
                type="button"
                className="rv-icon-btn"
                aria-label="Close"
                onClick={() => setDrawer(false)}
              >
                <X size={18} />
              </button>
            </header>
            <label className="rv-field">
              <span>Email addresses</span>
              <textarea
                rows={6}
                value={emails}
                onChange={(e) => {
                  setEmails(e.target.value);
                  setResults([]);
                }}
                placeholder={"one@company.com\ntwo@company.com"}
              />
              <small className="rv-hint">
                One per line. Each person gets a secure sign-in link by email.
              </small>
            </label>
            {!!parsed.invalid.length && (
              <p className="rv-error" role="alert">
                Not an email address: {parsed.invalid.join(", ")}
              </p>
            )}
            <label className="rv-field">
              <span>Role</span>
              <select value={role} onChange={(e) => setRole(e.target.value)}>
                {grantable.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABEL[r] || r}
                  </option>
                ))}
              </select>
              <small className="rv-hint">
                {ROLE_RULES.find(([k]) => k === role)?.[2]}
              </small>
            </label>
            {!!results.length && (
              <ul className="rv-results" role="status">
                {results.map((r) => (
                  <li key={r.email} className={r.ok ? "is-ok" : "is-bad"}>
                    <strong>{r.email}</strong> {r.message}
                  </li>
                ))}
              </ul>
            )}
            <footer>
              <SecondaryButton onClick={() => setDrawer(false)} disabled={busy}>
                Close
              </SecondaryButton>
              <PrimaryButton
                onClick={() => void send()}
                busy={busy}
                disabled={!parsed.valid.length || !!parsed.invalid.length}
              >
                {busy
                  ? "Sending…"
                  : `Send ${parsed.valid.length > 1 ? `${parsed.valid.length} invitations` : "invitation"}`}
              </PrimaryButton>
            </footer>
          </aside>
        </div>
      )}

      <Dialog
        open={!!removing}
        title={
          removing
            ? `Remove ${who(removing)?.full_name || who(removing)?.email || "this member"}?`
            : "Remove member"
        }
        onClose={() => !busy && setRemoving(null)}
        footer={
          <>
            <SecondaryButton onClick={() => setRemoving(null)} disabled={busy}>
              Keep member
            </SecondaryButton>
            <PrimaryButton onClick={() => void remove()} busy={busy}>
              {busy ? "Removing…" : "Remove member"}
            </PrimaryButton>
          </>
        }
      >
        <p>
          They lose access to this workspace straight away. Their profile, work
          orders and history are kept.
        </p>
      </Dialog>
    </div>
  );
}
