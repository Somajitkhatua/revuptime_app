import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { AlertTriangle, Download, Plus, Radio } from "lucide-react";
import type { Dataset, Row } from "../data";
import {
  gatewayState,
  invoke,
  loadExtras,
  timeAgo,
  type Extras,
  type GatewayState,
} from "./api";
import { DatapointPanel } from "./DatapointPanel";
import {
  Card,
  CopyRow,
  Dialog,
  PageHeader,
  PrimaryButton,
  SecondaryButton,
  StatusPill,
  downloadJson,
  type Tone,
} from "./ui";

const STATE: Record<GatewayState, [Tone, string]> = {
  pending: ["info", "Pending"],
  online: ["good", "Online"],
  stale: ["watch", "Stale"],
  revoked: ["offline", "Revoked"],
  offline: ["offline", "Offline"],
};

type Rotated = {
  device_id: string;
  client_id: string;
  username: string;
  password: string;
  topic: string;
};

export function DevicesPage({
  db,
  orgId,
  data,
  siteId,
  demo,
  canManage,
  navigate,
  onAddGateway,
  onChanged,
  notify,
}: {
  db: SupabaseClient | null;
  orgId: string;
  data: Dataset;
  siteId: string;
  demo: boolean;
  canManage: boolean;
  navigate: (view: string) => void;
  onAddGateway: () => void;
  onChanged: () => Promise<void> | void;
  notify: (text: string, error?: boolean) => void;
}) {
  const [extras, setExtras] = useState<Extras>({
    areas: [],
    contacts: [],
    missing: false,
  });
  const [confirm, setConfirm] = useState<{
    kind: "rotate" | "revoke";
    gateway: Row;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [rotated, setRotated] = useState<Rotated | null>(null);
  const [guide, setGuide] = useState<Row | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!orgId || demo) return;
    loadExtras(orgId)
      .then(setExtras)
      .catch(() => {});
  }, [orgId, demo]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const gateways = (data.gateways || [])
    .filter((g) => !siteId || g.site_id === siteId)
    .sort(
      (a, b) =>
        Number(a.status === "revoked") - Number(b.status === "revoked") ||
        String(a.name).localeCompare(String(b.name)),
    );
  const siteName = (id: string) =>
    (data.sites || []).find((s) => s.id === id)?.name || "—";
  const areaName = (id?: string) => extras.areas.find((a) => a.id === id)?.name;

  async function run() {
    if (!confirm) return;
    setBusy(true);
    try {
      if (confirm.kind === "rotate") {
        setRotated(
          await invoke<Rotated>(db, "rotate-device-token", {
            device_id: confirm.gateway.id,
          }),
        );
      } else {
        await invoke(db, "revoke-device", { device_id: confirm.gateway.id });
        notify(
          `${confirm.gateway.name} was revoked. It can no longer connect.`,
        );
      }
      setConfirm(null);
      await onChanged();
    } catch (e) {
      notify(
        e instanceof Error ? e.message : "That did not work. Please try again.",
        true,
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rv-page">
      <PageHeader
        crumb="Devices"
        title="Gateways"
        subtitle="Each gateway has its own secure login and can only send data for your organisation."
        actions={
          <>
            <SecondaryButton onClick={() => navigate("sensors")}>
              Sensors & device health
            </SecondaryButton>
            {canManage && !demo && (
              <PrimaryButton onClick={onAddGateway}>
                <Plus size={16} /> Add gateway
              </PrimaryButton>
            )}
          </>
        }
      />

      {!gateways.length ? (
        <Card className="rv-empty">
          <Radio size={28} aria-hidden="true" />
          <h2>No gateways {siteId ? "in this plant " : ""}yet</h2>
          <p>
            Add a gateway to start receiving vibration and temperature readings.
            It takes about 5 minutes.
          </p>
          {canManage && !demo && (
            <PrimaryButton onClick={onAddGateway}>Add gateway</PrimaryButton>
          )}
        </Card>
      ) : (
        <Card className="rv-table-card">
          <table className="rv-table">
            <thead>
              <tr>
                <th scope="col">Gateway</th>
                <th scope="col">Plant · Area</th>
                <th scope="col">Status</th>
                <th scope="col">Last seen</th>
                <th scope="col">
                  <span className="rv-sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {gateways.map((g) => {
                const state = gatewayState(g, now);
                const [tone, label] = STATE[state];
                const error = g.metadata?.last_ingest_error?.message as
                  | string
                  | undefined;
                const onboarded = !!g.client_id;
                return (
                  <tr key={g.id}>
                    <td data-label="Gateway">
                      <strong>{g.name}</strong>
                      <span className="rv-mono rv-muted rv-block">
                        {g.client_id || g.gateway_code || "—"}
                      </span>
                      {error && state !== "revoked" && (
                        <span className="rv-row-warning">
                          <AlertTriangle size={13} aria-hidden="true" /> {error}
                        </span>
                      )}
                    </td>
                    <td data-label="Plant · Area">
                      {[siteName(g.site_id), areaName(g.area_id)]
                        .filter(Boolean)
                        .join(" · ")}
                    </td>
                    <td data-label="Status">
                      <StatusPill tone={tone}>{label}</StatusPill>
                    </td>
                    <td data-label="Last seen">
                      {timeAgo(g.last_seen_at, now)}
                    </td>
                    <td className="rv-actions-cell">
                      <div className="rv-row-actions">
                        {onboarded && state !== "revoked" && (
                          <SecondaryButton onClick={() => setGuide(g)}>
                            Datapoints
                          </SecondaryButton>
                        )}
                        {canManage && onboarded && state !== "revoked" ? (
                          <>
                            <SecondaryButton
                              onClick={() =>
                                setConfirm({ kind: "rotate", gateway: g })
                              }
                            >
                              Regenerate token
                            </SecondaryButton>
                            <SecondaryButton
                              danger
                              onClick={() =>
                                setConfirm({ kind: "revoke", gateway: g })
                              }
                            >
                              Revoke
                            </SecondaryButton>
                          </>
                        ) : !onboarded ? (
                          <span
                            className="rv-muted"
                            title="Created before self-service onboarding. Its broker login is managed on the server."
                          >
                            Legacy login
                          </span>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}

      <Dialog
        open={!!confirm}
        title={
          confirm?.kind === "rotate"
            ? `Regenerate the password for ${confirm?.gateway.name}?`
            : `Revoke ${confirm?.gateway.name}?`
        }
        onClose={() => !busy && setConfirm(null)}
        footer={
          <>
            <SecondaryButton onClick={() => setConfirm(null)} disabled={busy}>
              Cancel
            </SecondaryButton>
            <PrimaryButton onClick={() => void run()} busy={busy}>
              {busy
                ? "Working…"
                : confirm?.kind === "rotate"
                  ? "Regenerate"
                  : "Revoke gateway"}
            </PrimaryButton>
          </>
        }
      >
        {confirm?.kind === "rotate" ? (
          <p>
            The current password stops working right away. The gateway stays
            offline until you enter the new password on it.
          </p>
        ) : (
          <p>
            The gateway is disconnected now and can never connect with its
            current login again. Past readings are kept. To use it again, add it
            as a new gateway.
          </p>
        )}
      </Dialog>

      <Dialog
        open={!!guide}
        title={guide ? `${guide.name}: datapoints` : "Datapoints"}
        onClose={() => setGuide(null)}
        footer={
          <PrimaryButton onClick={() => setGuide(null)}>Close</PrimaryButton>
        }
      >
        {guide && (
          <DatapointPanel
            model={guide.device_model || "generic-mqtt"}
            topic={guide.topic}
            clientId={guide.client_id}
          />
        )}
      </Dialog>

      <Dialog
        open={!!rotated}
        title="New password"
        onClose={() => setRotated(null)}
        footer={
          <PrimaryButton onClick={() => setRotated(null)}>
            I've saved it
          </PrimaryButton>
        }
      >
        {rotated && (
          <>
            <p className="rv-banner-watch">
              <AlertTriangle size={18} aria-hidden="true" />
              <span>
                <strong>Shown only once.</strong> Enter it on the gateway now.
              </span>
            </p>
            <div className="rv-copy-list">
              <CopyRow label="Username" value={rotated.username} />
              <CopyRow label="Password" value={rotated.password} />
              <CopyRow label="Publish topic" value={rotated.topic} />
            </div>
            <SecondaryButton
              onClick={() =>
                downloadJson(`${rotated.client_id}-new-password.json`, rotated)
              }
            >
              <Download size={16} /> Download (.json)
            </SecondaryButton>
          </>
        )}
      </Dialog>
    </div>
  );
}
