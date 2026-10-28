import { useOperations } from "../../hooks/queries";
import { ago, gatewayState } from "../../utils/operations";
import { Linking } from "react-native";
import React, { useState } from "react";
import { router } from "expo-router";
import {
  Screen,
  Card,
  T,
  Search,
  Chips,
  Badge,
  Button,
  State,
} from "../../components/ui";
import { useDevices } from "../../hooks/devices";
import DeviceSections from "../../components/DeviceSections";
export default function Devices() {
  const overview = useOperations();
  const q = useDevices(),
    [search, setSearch] = useState(""),
    [kind, setKind] = useState("All");
  const rows = (q.data || []).filter(
    (d) =>
      (kind === "All" || d.kind === kind) &&
      `${d.name} ${d.serial_number || ""} ${d.model || ""}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  return (
    <Screen
      title="Devices"
      onRefresh={() => q.refetch()}
      refreshing={q.isRefetching}
    >
      <DeviceSections active="Devices" />
      <T muted>Workspace sensors and gateways</T>
      <Search
        value={search}
        onChange={setSearch}
        placeholder="Search devices..."
      />
      <Chips
        values={["All", "Sensor", "Gateway"]}
        value={kind}
        onChange={setKind}
      />
      <State
        loading={q.isLoading}
        error={q.error}
        retry={() => q.refetch()}
        empty={
          !q.isLoading && !q.error && !rows.length
            ? "No devices match. Your workspace administrator can register sensors and gateways; machines are managed separately under Assets."
            : undefined
        }
      />
      <Button
        title="Gateway and sensor setup"
        secondary
        onPress={() =>
          void Linking.openURL("https://app.revuptime.com/#settings/gateways")
        }
      />
      {rows.map((d) => (
        <Card
          key={`${d.kind}:${d.id}`}
          onPress={() =>
            router.push({
              pathname: "/devices/detail",
              params: { id: d.id, kind: d.kind },
            })
          }
          style={{ gap: 8 }}
        >
          <T style={{ fontSize: 18, fontWeight: "700" }}>{d.name}</T>
          <T muted>
            {d.kind} · {d.sensor_type || d.protocol || "Type not specified"}
          </T>
          <Badge
            value={
              d.kind === "Gateway"
                ? overview.data?.gateways.find((g) => g.id === d.id)
                  ? gatewayState(
                      overview.data.gateways.find((g) => g.id === d.id)!,
                    )
                  : d.status || "Unknown"
                : overview.data?.points.some((p) => p.sensor_id === d.id)
                  ? overview.data.points.some(
                      (p) => p.sensor_id === d.id && p.fresh,
                    )
                    ? "Reporting"
                    : "No current reading"
                  : "Not mapped to a point"
            }
          />
          <T muted>
            {d.kind === "Gateway"
              ? `Last seen ${ago(d.last_seen_at)}`
              : `${overview.data?.points.filter((p) => p.sensor_id === d.id).length || 0} measurement points`}
          </T>
          <T muted>Serial: {d.serial_number || "Not provided"}</T>
        </Card>
      ))}
    </Screen>
  );
}
