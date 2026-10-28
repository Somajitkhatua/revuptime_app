import React from "react";
import { Screen, Card, T, State } from "../../components/ui";
import { useDevices } from "../../hooks/devices";
import DeviceSections from "../../components/DeviceSections";
export default function Certificates() {
  const q = useDevices();
  const rows = (q.data || []).flatMap((d) => {
    const c = d.metadata?.certificate || d.configuration?.certificate;
    return c && typeof c === "object"
      ? [{ device: d.name, certificate: c }]
      : [];
  });
  return (
    <Screen title="Device certificates" back>
      <DeviceSections active="Certificates" />
      <T muted>
        Certificate metadata recorded for workspace devices. Private keys are
        never displayed.
      </T>
      <State
        loading={q.isLoading}
        error={q.error}
        retry={() => q.refetch()}
        empty={
          !q.isLoading && !q.error && !rows.length
            ? "No certificate metadata has been registered for these devices."
            : undefined
        }
      />
      {rows.map((r, i) => (
        <Card key={i} style={{ gap: 10 }}>
          <T style={{ fontWeight: "700" }}>{r.device}</T>
          {["subject", "issuer", "expires_at", "fingerprint"].map((k) => (
            <T key={k}>
              {k.replaceAll("_", " ")}:{" "}
              {typeof r.certificate[k] === "string"
                ? r.certificate[k]
                : "Not provided"}
            </T>
          ))}
        </Card>
      ))}
    </Screen>
  );
}
