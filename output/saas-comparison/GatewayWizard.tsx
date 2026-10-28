import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { AlertTriangle, CheckCircle2, Download } from "lucide-react";
import { authorizedDataClient, type Dataset, type Row } from "../data";
import {
  MODELS,
  invoke,
  loadExtras,
  setupSteps,
  type Credentials,
  type DeviceModel,
  type Extras,
} from "./api";
import { setLeaveGuard } from "./leaveGuard";
import { AddressMapping } from "./AddressMapping";
import { DatapointPanel } from "./DatapointPanel";
import { PlantDrawer } from "./PlantDrawer";
import {
  Card,
  CopyRow,
  Field,
  PageHeader,
  PrimaryButton,
  SecondaryButton,
  Stepper,
  downloadJson,
} from "./ui";

const STEPS = [
  { title: "Gateway details", detail: "Model and location" },
  { title: "Configure gateway", detail: "Paste the settings" },
  { title: "First data", detail: "Confirm it's live" },
];
const LEAVE_MESSAGE =
  "The gateway password is shown only once. If you leave now you will need to regenerate it. Leave anyway?";

export function GatewayWizard({
  db,
  orgId,
  data,
  demo,
  canManage,
  initialSiteId,
  navigate,
  onChanged,
  notify,
}: {
  db: SupabaseClient | null;
  orgId: string;
  data: Dataset;
  demo: boolean;
  canManage: boolean;
  initialSiteId?: string;
  navigate: (view: string) => void;
  onChanged: () => Promise<void> | void;
  notify: (text: string, error?: boolean) => void;
}) {
  const sites = data.sites || [];
  const [step, setStep] = useState(1);
  const [model, setModel] = useState<DeviceModel>("usr-n720");
  const [name, setName] = useState("");
  const [siteId, setSiteId] = useState(initialSiteId || sites[0]?.id || "");
  const [areaId, setAreaId] = useState("");
  const [assetIds, setAssetIds] = useState<string[]>([]);
  const [extras, setExtras] = useState<Extras>({
    areas: [],
    contacts: [],
    missing: false,
  });
  const [plantDrawer, setPlantDrawer] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState("");
  // Held in component memory only: never written to storage, logs or analytics.
  const [creds, setCreds] = useState<Credentials | null>(null);
  const [gateway, setGateway] = useState<Row | null>(null);

  useEffect(() => {
    if (!siteId && sites[0]) setSiteId(initialSiteId || sites[0].id);
  }, [sites.length]);

  useEffect(() => {
    if (!orgId || demo) return;
    loadExtras(orgId)
      .then(setExtras)
      .catch(() => {});
  }, [orgId, demo]);

  // Warn before losing the one-time password (in-app navigation and tab close).
  useEffect(() => {
    if (step !== 2 || !creds) return;
    setLeaveGuard(() => LEAVE_MESSAGE);
    const onUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = LEAVE_MESSAGE;
    };
    window.addEventListener("beforeunload", onUnload);
    return () => {
      setLeaveGuard(null);
      window.removeEventListener("beforeunload", onUnload);
    };
  }, [step, creds]);

  // Drop the password from memory once the user has moved on.
  useEffect(() => () => setLeaveGuard(null), []);

  const plantAreas = extras.areas.filter((a) => a.site_id === siteId);
  const plantAssets = (data.assets || []).filter(
    (a) =>
      a.site_id === siteId && (!areaId || !a.area_id || a.area_id === areaId),
  );

  async function create(e: FormEvent) {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (!name.trim())
      next.name = "Give the gateway a name your team will recognise.";
    if (!siteId) next.site = "Choose a plant.";
    setErrors(next);
    if (Object.keys(next).length) return;
    setBusy(true);
    setFailure("");
    try {
      const result = await invoke<Credentials>(db, "create-device", {
        org_id: orgId,
        site_id: siteId,
        area_id: areaId || null,
        name: name.trim(),
        model,
        asset_ids: assetIds,
      });
      setCreds(result);
      setGateway({
        id: result.device_id,
        name: name.trim(),
        status: "pending",
      });
      setStep(2);
      void onChanged();
    } catch (err) {
      setFailure(
        err instanceof Error
          ? err.message
          : "The gateway could not be created.",
      );
    } finally {
      setBusy(false);
    }
  }

  function goToFirstData() {
    setLeaveGuard(null);
    setCreds((c) => (c ? { ...c, password: "" } : c));
    setStep(3);
  }

  function reset() {
    setLeaveGuard(null);
    setCreds(null);
    setGateway(null);
    setName("");
    setAssetIds([]);
    setFailure("");
    setStep(1);
  }

  if (!canManage)
    return (
      <div className="rv-page">
        <PageHeader crumb="Devices / Add gateway" title="Add a gateway" />
        <p className="rv-callout">
          Only owners, admins and managers can add gateways. Ask one of them to
          add it for you.
        </p>
      </div>
    );

  if (demo)
    return (
      <div className="rv-page">
        <PageHeader crumb="Devices / Add gateway" title="Add a gateway" />
        <p className="rv-callout">
          Connect your workspace to add a real gateway. The demo workspace
          cannot create broker logins.
        </p>
      </div>
    );

  const title =
    step === 1
      ? "Add a gateway"
      : step === 2
        ? `Configure ${gateway?.name || "gateway"}`
        : gateway?.name || "Gateway";
  const subtitle =
    step === 1
      ? "Takes about 5 minutes. You'll get the settings to paste into the gateway, then watch its first reading arrive."
      : step === 2
        ? model === "usr-n720"
          ? "Open the USR-N720 setup page and enter these settings under MQTT1."
          : "Open the gateway's MQTT settings and enter these values."
        : undefined;

  return (
    <div className="rv-page">
      <PageHeader
        crumb="Devices / Add gateway"
        title={title}
        subtitle={subtitle}
      />
      <Stepper steps={STEPS} current={step} />

      {step === 1 && (
        <div className="rv-split">
          <Card>
            <form onSubmit={create} noValidate className="rv-form">
              <fieldset className="rv-model-group">
                <legend>Gateway model</legend>
                <div className="rv-model-grid">
                  {MODELS.map((m) => (
                    <label
                      key={m.id}
                      className={
                        "rv-model" + (model === m.id ? " is-selected" : "")
                      }
                    >
                      <input
                        type="radio"
                        name="model"
                        value={m.id}
                        checked={model === m.id}
                        onChange={() => setModel(m.id)}
                      />
                      <span>
                        <strong>{m.title}</strong>
                        <small>{m.detail}</small>
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <Field
                label="Gateway name"
                hint="A name your team will recognise, e.g. where it's mounted."
                error={errors.name}
              >
                {(id) => (
                  <input
                    id={id}
                    value={name}
                    placeholder="Pump House gateway"
                    maxLength={120}
                    onChange={(e) => setName(e.target.value)}
                  />
                )}
              </Field>

              <div className="rv-grid-2">
                <Field label="Site" error={errors.site}>
                  {(id) => (
                    <select
                      id={id}
                      value={siteId}
                      onChange={(e) => {
                        setSiteId(e.target.value);
                        setAreaId("");
                        setAssetIds([]);
                      }}
                    >
                      {!sites.length && <option value="">No plants yet</option>}
                      {sites.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  )}
                </Field>
                <Field
                  label="Area"
                  hint={
                    !plantAreas.length && siteId
                      ? "No areas yet. Add them on the Plants page."
                      : undefined
                  }
                >
                  {(id) => (
                    <select
                      id={id}
                      value={areaId}
                      onChange={(e) => setAreaId(e.target.value)}
                      disabled={!plantAreas.length}
                    >
                      <option value="">
                        {plantAreas.length ? "Whole plant" : "No areas"}
                      </option>
                      {plantAreas.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                    </select>
                  )}
                </Field>
              </div>
              {!extras.missing && (
                <button
                  type="button"
                  className="rv-link-btn"
                  onClick={() => setPlantDrawer(true)}
                >
                  + Add a new plant
                </button>
              )}

              <fieldset className="rv-asset-group">
                <legend>
                  Assets this gateway will monitor{" "}
                  <span className="rv-muted">
                    (optional, you can map later)
                  </span>
                </legend>
                {!plantAssets.length ? (
                  <p className="rv-muted">No assets in this plant yet.</p>
                ) : (
                  <ul className="rv-checklist">
                    {plantAssets.map((a) => (
                      <li key={a.id}>
                        <label>
                          <input
                            type="checkbox"
                            checked={assetIds.includes(a.id)}
                            onChange={(e) =>
                              setAssetIds((ids) =>
                                e.target.checked
                                  ? [...ids, a.id]
                                  : ids.filter((x) => x !== a.id),
                              )
                            }
                          />
                          <span>
                            {[a.asset_code, a.name].filter(Boolean).join(" · ")}
                          </span>
                        </label>
                      </li>
                    ))}
                  </ul>
                )}
                {assetIds.length > 1 && (
                  <small className="rv-hint">
                    With more than one asset, each message must say which sensor
                    it is from ("sensor": "…-s2").
                  </small>
                )}
              </fieldset>

              {failure && (
                <p className="rv-error-box" role="alert">
                  {failure}
                </p>
              )}
              <div className="rv-form-actions">
                <SecondaryButton onClick={() => navigate("devices")}>
                  Cancel
                </SecondaryButton>
                <PrimaryButton type="submit" busy={busy}>
                  {busy ? "Creating…" : "Create gateway"}
                </PrimaryButton>
              </div>
            </form>
          </Card>
          <aside className="rv-side">
            <Card>
              <h2 className="rv-card-title">What happens next</h2>
              <p>
                We create a private, encrypted connection for this gateway. It
                can only send data to your plant, never anyone else's.
              </p>
              <p>
                The password is shown once on the next screen, so keep the
                gateway's settings page open.
              </p>
            </Card>
            <Card>
              <h2 className="rv-card-title">You'll need</h2>
              <ul className="rv-bullets">
                <li>Gateway powered on, with SIM data or Ethernet</li>
                <li>A laptop on the gateway's setup page</li>
                <li>Sensors wired to RS485</li>
              </ul>
            </Card>
          </aside>
        </div>
      )}

      {step === 2 && creds && (
        <ConfigureStep
          creds={creds}
          model={model}
          gatewayName={gateway?.name || name}
          onBack={reset}
          onNext={goToFirstData}
        />
      )}

      {step === 3 && gateway && (
        <FirstDataStep
          db={db}
          orgId={orgId}
          siteId={siteId}
          data={data}
          gatewayId={gateway.id}
          initial={gateway}
          onAnother={reset}
          onAsset={() => navigate("assets")}
          onMapping={() => navigate("sensors")}
          onChanged={onChanged}
        />
      )}

      <PlantDrawer
        open={plantDrawer}
        orgId={orgId}
        areas={extras.areas}
        contacts={extras.contacts}
        onClose={() => setPlantDrawer(false)}
        onSaved={async (id) => {
          setPlantDrawer(false);
          notify("Plant added.");
          await Promise.all([
            onChanged(),
            loadExtras(orgId)
              .then(setExtras)
              .catch(() => {}),
          ]);
          setSiteId(id);
          setAreaId("");
          setAssetIds([]);
        }}
      />
    </div>
  );
}

function ConfigureStep({
  creds,
  model,
  gatewayName,
  onBack,
  onNext,
}: {
  creds: Credentials;
  model: DeviceModel;
  gatewayName: string;
  onBack: () => void;
  onNext: () => void;
}) {
  const steps = setupSteps(model);
  const settings = {
    server: creds.server,
    port: creds.port,
    tls: creds.tls,
    client_id: creds.client_id,
    username: creds.username,
    password: creds.password,
    topic: creds.topic,
    mqtt_version: creds.mqtt_version,
  };
  const whatsapp = useMemo(() => {
    const text = [
      `RevUptime gateway setup: ${gatewayName}`,
      ...steps.map((s, i) => `${i + 1}. ${s}`),
      "",
      `Server: ${creds.server}`,
      `Port: ${creds.port} (SSL/TLS on)`,
      `Client ID: ${creds.client_id}`,
      `Username: ${creds.username}`,
      "Password: I will share it separately.",
      `Publish topic: ${creds.topic}`,
      `MQTT version: ${creds.mqtt_version}`,
    ].join("\n");
    return "https://wa.me/?text=" + encodeURIComponent(text);
  }, [creds.client_id]);

  return (
    <>
      <p className="rv-banner-watch" role="alert">
        <AlertTriangle size={18} aria-hidden="true" />
        <span>
          <strong>The password is shown only once.</strong> Copy it into the
          gateway now, or download the settings file. If it's lost, regenerate
          it from the Devices page.
        </span>
      </p>
      <div className="rv-split">
        <Card>
          <div className="rv-card-head">
            <h2 className="rv-section-title">Connection settings</h2>
            <SecondaryButton
              onClick={() =>
                downloadJson(`${creds.client_id}-settings.json`, settings)
              }
            >
              <Download size={16} /> Download settings (.json)
            </SecondaryButton>
          </div>
          <div className="rv-copy-list">
            <CopyRow label="Server" value={creds.server} />
            <CopyRow
              label="Port"
              value={String(creds.port)}
              display={`${creds.port} (SSL/TLS on)`}
            />
            <CopyRow label="Client ID" value={creds.client_id} />
            <CopyRow label="Username" value={creds.username} />
            <CopyRow label="Password" value={creds.password} />
            <CopyRow label="Publish topic" value={creds.topic} />
            <CopyRow label="MQTT version" value={creds.mqtt_version} />
          </div>
        </Card>
        <aside className="rv-side">
          <Card>
            <h2 className="rv-section-title">
              On the {MODELS.find((m) => m.id === model)?.title}
            </h2>
            <ol className="rv-numbered">
              {steps.map((s) => (
                <li key={s}>
                  {s.includes("ISRG Root X1") ? (
                    <>
                      If it asks for a CA file, upload{" "}
                      <a
                        href="https://letsencrypt.org/certs/isrgrootx1.pem"
                        target="_blank"
                        rel="noreferrer"
                      >
                        ISRG Root X1
                      </a>
                      .
                    </>
                  ) : (
                    s
                  )}
                </li>
              ))}
            </ol>
            <p className="rv-side-foot">
              Stuck?{" "}
              <a href={whatsapp} target="_blank" rel="noreferrer">
                Send these steps to the technician on WhatsApp
              </a>
              <small className="rv-hint">
                The password is not included. Share it separately.
              </small>
            </p>
          </Card>
        </aside>
      </div>
      <DatapointPanel
        model={model}
        topic={creds.topic}
        clientId={creds.client_id}
      />
      <div className="rv-form-actions rv-form-actions-page">
        <SecondaryButton
          onClick={() => {
            if (
              window.confirm(
                "Going back discards these settings. The gateway is kept, and you can regenerate its password from the Devices page. Go back?",
              )
            )
              onBack();
          }}
        >
          Back
        </SecondaryButton>
        <PrimaryButton onClick={onNext}>
          I've configured it, check for data
        </PrimaryButton>
      </div>
    </>
  );
}

const fmt = (v: unknown) =>
  v === null || v === undefined || v === "" ? "—" : Number(v).toFixed(2);

function FirstDataStep({
  db,
  orgId,
  siteId,
  data,
  gatewayId,
  initial,
  onAnother,
  onAsset,
  onMapping,
  onChanged,
}: {
  db: SupabaseClient | null;
  orgId: string;
  siteId: string;
  data: Dataset;
  gatewayId: string;
  initial: Row;
  onAnother: () => void;
  onAsset: () => void;
  onMapping: () => void;
  onChanged: () => Promise<void> | void;
}) {
  const [gw, setGw] = useState<Row>(initial);
  const [reading, setReading] = useState<Row | null>(null);
  const [waited, setWaited] = useState(0);

  async function refresh() {
    const client = authorizedDataClient();
    const [{ data: row }, { data: readings }] = await Promise.all([
      client.from("gateways").select("*").eq("id", gatewayId).maybeSingle(),
      client
        .from("sensor_readings")
        .select("*")
        .eq("gateway_id", gatewayId)
        .order("timestamp", { ascending: false })
        .limit(1),
    ]);
    if (row) setGw(row);
    if (readings?.[0]) setReading(readings[0]);
  }

  useEffect(() => {
    void refresh();
    const started = Date.now();
    const tick = setInterval(
      () => setWaited(Math.floor((Date.now() - started) / 1000)),
      1000,
    );
    const poll = setInterval(() => void refresh(), 10_000);
    const channel = db
      ?.channel("gateway-onboarding-" + gatewayId)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "gateways",
          filter: "id=eq." + gatewayId,
        },
        (p) => {
          setGw(p.new as Row);
          void refresh();
        },
      )
      .subscribe();
    return () => {
      clearInterval(tick);
      clearInterval(poll);
      if (channel) void db?.removeChannel(channel);
    };
  }, [gatewayId]);

  const connected = !!(gw.first_seen_at || gw.last_seen_at);
  const live = connected && !!reading;
  const ingestError = gw.metadata?.last_ingest_error?.message as
    | string
    | undefined;

  useEffect(() => {
    if (connected) void onChanged();
  }, [connected]);

  return (
    <Card className="rv-first-data">
      <div aria-live="polite" className="rv-wait">
        {!connected ? (
          <>
            <span className="rv-pulse" aria-hidden="true" />
            <h2>Waiting for the first message…</h2>
            <p>
              This usually takes under a minute after the gateway restarts. Keep
              this page open; it updates by itself.
            </p>
          </>
        ) : live ? (
          <>
            <CheckCircle2
              size={44}
              className="rv-text-good"
              aria-hidden="true"
            />
            <h2>Gateway is live</h2>
            <p>
              The first reading arrived{" "}
              {new Date(reading!.timestamp).toLocaleTimeString()}.
            </p>
          </>
        ) : (
          <>
            <CheckCircle2
              size={44}
              className="rv-text-good"
              aria-hidden="true"
            />
            <h2>Gateway is connected</h2>
            <p>
              {ingestError
                ? `Messages are arriving, but readings can't be stored yet: ${ingestError}.`
                : "Waiting for the first reading to be stored…"}
            </p>
          </>
        )}
        <ul className="rv-progress-chips">
          <li className="rv-pill rv-pill-good">Credentials created</li>
          <li
            className={
              "rv-pill " + (connected ? "rv-pill-good" : "rv-pill-offline")
            }
          >
            Gateway connected{connected ? "" : " · waiting"}
          </li>
          <li
            className={"rv-pill " + (live ? "rv-pill-good" : "rv-pill-offline")}
          >
            Data received{live ? "" : " · waiting"}
          </li>
        </ul>
        {!connected && waited >= 300 && (
          <p className="rv-tip">
            <strong>Nothing after 5 minutes?</strong> Check: SSL on and port
            8883 · Client ID and username match exactly · the gateway's SIM has
            data · the publish topic has no extra spaces.
          </p>
        )}
      </div>

      {live && (
        <>
          <div className="rv-vitals">
            <Vital
              title="Velocity"
              unit="mm/s RMS · indicative"
              r={reading!}
              keys={["vx", "vy", "vz"]}
            />
            <Vital
              title="Acceleration"
              unit="m/s²"
              r={reading!}
              keys={["ax", "ay", "az"]}
            />
            <Vital
              title="Displacement"
              unit="µm"
              r={reading!}
              keys={["dx", "dy", "dz"]}
            />
            <div className="rv-vital">
              <p className="rv-card-label">Temperature</p>
              <p className="rv-vital-value">
                {fmt(reading!.temperature_c)} <small>°C</small>
              </p>
            </div>
          </div>
          <p className="rv-muted">
            Wrong numbers?{" "}
            <button type="button" className="rv-link-btn" onClick={onMapping}>
              Adjust register mapping
            </button>{" "}
            · Normal ranges (baselines) are learned over the first 14 days.
          </p>
        </>
      )}

      {connected && !reading && ingestError && (
        <p className="rv-muted">
          <button type="button" className="rv-link-btn" onClick={onMapping}>
            Map this gateway to an asset's sensor
          </button>
        </p>
      )}

      {connected && (
        <AddressMapping
          orgId={orgId}
          siteId={siteId}
          gateway={gw}
          data={data}
          onMapped={() => void refresh()}
        />
      )}

      <div className="rv-form-actions">
        <SecondaryButton onClick={onAnother}>
          Add another gateway
        </SecondaryButton>
        <PrimaryButton onClick={onAsset}>Go to asset</PrimaryButton>
      </div>
    </Card>
  );
}

function Vital({
  title,
  unit,
  r,
  keys,
}: {
  title: string;
  unit: string;
  r: Row;
  keys: string[];
}) {
  return (
    <div className="rv-vital">
      <p className="rv-card-label">{title}</p>
      <dl className="rv-axes">
        {keys.map((k) => (
          <div key={k}>
            <dt>{k.slice(1).toUpperCase()}</dt>
            <dd className="rv-mono">{fmt(r[k])}</dd>
          </div>
        ))}
      </dl>
      <small className="rv-muted">{unit}</small>
    </div>
  );
}
