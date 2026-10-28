import React from "react";
import { useLocalSearchParams } from "expo-router";
import { Screen, Card, T, State } from "../../components/ui";
import { useDevices } from "../../hooks/devices";
export default function Device() {
  const { id, kind } = useLocalSearchParams<{ id: string; kind: string }>(),
    q = useDevices(),
    d = q.data?.find((d) => d.id === id && d.kind === kind);
  return (
    <Screen title={d?.name || "Device details"} back>
      <State
        loading={q.isLoading}
        error={q.error}
        retry={() => q.refetch()}
        empty={
          !q.isLoading && !q.error && !d
            ? "Device not found in your workspace."
            : undefined
        }
      />
      {d && (
        <Card style={{ gap: 12 }}>
          {[
            ["Name", d.name],
            ["Device type", d.kind],
            ["Status", d.status],
            ["Manufacturer", d.manufacturer],
            ["Model", d.model],
            ["Serial number", d.serial_number],
            ["Protocol", d.protocol],
            ["Sensor type", d.sensor_type],
            ["Measurement", d.measurement_type],
            ["Unit", d.unit],
            [
              "Sampling interval",
              d.sampling_interval_seconds != null
                ? `${d.sampling_interval_seconds} seconds`
                : undefined,
            ],
            [
              "Last seen",
              d.last_seen_at
                ? new Date(d.last_seen_at).toLocaleString()
                : undefined,
            ],
          ].map(([label, value]) => (
            <T key={label}>
              {label}: {value || "Not provided"}
            </T>
          ))}
        </Card>
      )}
    </Screen>
  );
}
