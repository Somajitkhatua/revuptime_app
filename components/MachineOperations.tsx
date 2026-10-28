import React, { useState } from "react";
import { View, Text, Pressable } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useOperations, useOrg } from "../hooks/queries";
import { getPointHistory, getInstallations } from "../services/operations";
import { ago, operationLabels } from "../utils/operations";
import { SectionHeading, StatusTag, o } from "./OperationsUI";
import { Select, Chips, State, Icon } from "./ui";
import TrendChart from "./TrendChart";
export default function MachineOperations({
  asset,
  fallback,
}: {
  asset: string;
  fallback: React.ReactNode;
}) {
  const org = useOrg(),
    overview = useOperations();
  const points = (overview.data?.points || []).filter(
    (p) => p.asset_id === asset,
  );
  const [selected, setSelected] = useState(""),
    [range, setRange] = useState("24H"),
    [compare, setCompare] = useState(false),
    [historyOpen, setHistoryOpen] = useState(false);
  const drivingPoint = overview.data?.health.find(h=>h.asset_id===asset)?.driven_by_point_id;
  const point = points.find((p) => p.point_id === selected) || points.find(p=>p.point_id===drivingPoint) || points[0];
  const ids = points.map((p) => p.point_id);
  const history = useQuery({
    queryKey: ["point-history", org, asset, ids.join(","), range],
    queryFn: () =>
      getPointHistory(
        org,
        asset,
        ids,
        range === "24H" ? 24 : range === "7D" ? 168 : 720,
      ),
    enabled: !!org && !!ids.length,
    refetchInterval: 30000,
  });
  const installs = useQuery({
    queryKey: ["installations", org, asset, ids.join(",")],
    queryFn: () => getInstallations(org, ids),
    enabled: historyOpen && !!org && !!ids.length,
  });
  if (!points.length) return <>{fallback}</>;
  const rows = (history.data || []).filter(
    (r) =>
      r.point_id === point.point_id &&
      typeof r.v_max === "number" &&
      Number.isFinite(r.v_max),
  );
  return (
    <>
      <View style={o.card}>
        <SectionHeading title="Measurement points" />
        {points.length > 1 && (
          <Select
            label="Measurement point"
            value={point.point_id}
            options={points.map((p) => ({
              label: p.point_name,
              value: p.point_id,
            }))}
            onChange={setSelected}
          />
        )}
        <View style={o.row}>
          <Icon name="radio" color="#0085FF" />
          <View style={{ flex: 1 }}>
            <Text style={o.title}>{point.point_name}</Text>
            <Text style={o.caption}>
              {point.sensor_name || "No sensor installed"}
            </Text>
          </View>
          <StatusTag
            label={operationLabels[point.status] || "No data"}
            status={point.status}
          />
        </View>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 14 }}>
          {[
            { label: "Velocity", value: point.velocity, unit: "mm/s" },
            { label: "Temperature", value: point.temperature, unit: "°C" },
          ].map((m) => (
            <View key={m.label} style={{ flex: 1, minWidth: 110, gap: 6 }}>
              <Text style={o.caption}>{m.label}</Text>
              <Text
                style={{
                  fontSize: 25,
                  fontWeight: "800",
                  color: point.fresh ? "#123B61" : "#71839A",
                }}
              >
                {typeof m.value === "number" && Number.isFinite(m.value)
                  ? `${m.value.toFixed(1)} ${m.unit}`
                  : "Unavailable"}
              </Text>
            </View>
          ))}
        </View>
        <View style={o.between}>
          <StatusTag
            label={
              point.fresh && point.graded && point.zone
                ? `Zone ${point.zone} · Configured limits`
                : !point.fresh
                  ? "No current zone"
                  : "No configured zone"
            }
            status={point.status}
          />
        </View>
        <Text style={o.caption}>
          {point.fresh
            ? "Latest valid reading"
            : "Historical / unavailable reading"}{" "}
          · {ago(point.latest_at)}
        </Text>
        {!!point.latest_at && (
          <Text style={o.caption}>
            Recorded {new Date(point.latest_at).toLocaleString()}
          </Text>
        )}
        {!!point.limit_set_name && (
          <Text style={o.caption}>
            {point.limit_set_name} · Indicative condition, verify before
            maintenance.
          </Text>
        )}
        <Pressable
          accessibilityRole="button"
          onPress={() => setHistoryOpen((v) => !v)}
        >
          <Text style={o.link}>
            {historyOpen
              ? "Hide sensor history"
              : "Sensor installation history"}
          </Text>
        </Pressable>
        {historyOpen && (
          <>
            <State
              loading={installs.isLoading}
              error={installs.error}
              retry={() => installs.refetch()}
              empty={
                installs.isSuccess && !installs.data?.length
                  ? "No installation history recorded."
                  : undefined
              }
            />
            {installs.data?.map((i) => (
              <View
                key={i.id}
                style={{
                  gap: 4,
                  borderTopWidth: 1,
                  borderTopColor: "#E0E8F2",
                  paddingTop: 10,
                }}
              >
                <Text style={o.text}>Sensor {i.sensor_id}</Text>
                <Text style={o.caption}>
                  Installed {new Date(i.installed_at).toLocaleString()}
                  {i.removed_at
                    ? ` · Removed ${new Date(i.removed_at).toLocaleString()}`
                    : " · Currently installed"}
                </Text>
                {!!i.note && <Text style={o.caption}>{i.note}</Text>}
              </View>
            ))}
          </>
        )}
      </View>
      <View style={o.card}>
        <SectionHeading title="Vibration trend" />
        <Chips
          values={["24H", "7D", "30D"]}
          value={range}
          onChange={setRange}
        />
        <State
          loading={history.isLoading}
          error={history.error}
          retry={() => history.refetch()}
          empty={
            history.isSuccess && !rows.length
              ? "No valid velocity readings in this period."
              : undefined
          }
        />
        {!!rows.length && (
          <TrendChart
            values={rows.map((r) => r.v_max!)}
            unit="mm/s"
            threshold={
              point.graded ? Number(point.zone_bc) || undefined : undefined
            }
            labels={rows.map((r) =>
              new Date(r.timestamp).toLocaleString([], {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              }),
            )}
          />
        )}
        <Text style={o.caption}>
          Latest 2,000 records across selected points. Invalid quality and
          missing velocity are excluded; missing values are not zero.
        </Text>
        {points.length > 1 && (
          <Pressable
            accessibilityRole="button"
            onPress={() => setCompare((v) => !v)}
          >
            <Text style={o.link}>
              {compare ? "Hide point comparison" : "Compare measurement points"}
            </Text>
          </Pressable>
        )}
        {compare &&
          points.map((p) => (
            <View key={p.point_id} style={o.between}>
              <View style={{ flex: 1 }}>
                <Text style={o.text}>{p.point_name}</Text>
                <Text style={o.caption}>
                  {ago(p.latest_at)} ·{" "}
                  {p.fresh ? "Reporting" : "No current reading"}
                </Text>
              </View>
              <Text style={o.title}>
                {p.velocity == null ? "—" : `${p.velocity.toFixed(1)} mm/s`}
              </Text>
            </View>
          ))}
      </View>
    </>
  );
}
