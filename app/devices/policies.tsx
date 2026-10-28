import React from "react";
import { Screen, Card, T, State } from "../../components/ui";
import { useDevices } from "../../hooks/devices";
import DeviceSections from "../../components/DeviceSections";
export default function Policies() {
  const q = useDevices();
  return (
    <Screen title="Device policies" back>
      <DeviceSections active="Policies" />
      <Card style={{ gap: 10 }}>
        <T style={{ fontWeight: "700", fontSize: 18 }}>Workspace access</T>
        <T muted>
          Device records are restricted to your workspace. This page displays
          recorded device configuration; it does not deploy policies to
          hardware.
        </T>
      </Card>
      <State
        loading={q.isLoading}
        error={q.error}
        retry={() => q.refetch()}
        empty={
          !q.isLoading && !q.error && !q.data?.length
            ? "No devices registered. Device configuration appears here once sensors or gateways are added."
            : undefined
        }
      />
      {q.data?.map((d) => (
        <Card key={`${d.kind}:${d.id}`} style={{ gap: 10 }}>
          <T style={{ fontWeight: "700" }}>{d.name}</T>
          <T>Type: {d.kind}</T>
          <T>Protocol: {d.protocol || "Not recorded"}</T>
          <T>
            Sampling interval:{" "}
            {d.sampling_interval_seconds != null
              ? `${d.sampling_interval_seconds} seconds`
              : "Not recorded"}
          </T>
          <T muted>
            Contact your device administrator to provision or update hardware
            policies.
          </T>
        </Card>
      ))}
    </Screen>
  );
}
