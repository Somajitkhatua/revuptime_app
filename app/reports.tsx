import React, { useState } from "react";
import { View, Text, Share } from "react-native";
import { Screen, Select, Button, State, Chips } from "../components/ui";
import {
  useAssets,
  useAlerts,
  useWorkOrders,
  useSites,
  useOperations,
} from "../hooks/queries";
import { useApp } from "../providers/AppProvider";
import { scopedOperations, isOverdue } from "../utils/operations";
import { o, SectionHeading, StatusTag } from "../components/OperationsUI";
import TrendChart from "../components/TrendChart";
export default function Reports() {
  const { site, setSite } = useApp(),
    sites = useSites(),
    assets = useAssets(true),
    alerts = useAlerts(),
    orders = useWorkOrders(),
    operations = useOperations();
  const [range, setRange] = useState("7D"),
    [pointId, setPoint] = useState(""),
    [error, setError] = useState<unknown>();
  const view = scopedOperations(
    operations.data,
    assets.data || [],
    site,
    alerts.data || [],
    orders.data || [],
  );
  const point =
    view.points.find((p) => p.point_id === pointId) || view.points[0];
  const days = range === "7D" ? 7 : 30,
    after = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
  const daily = (operations.data?.daily || [])
    .filter(
      (d) =>
        d.point_id === point?.point_id &&
        d.day >= after &&
        typeof d.v_max === "number",
    )
    .sort((a, b) => a.day.localeCompare(b.day));
  const summary = `RevUpTime operations report\n${sites.data?.find((s) => s.id === site)?.name || "All plants"}\nGenerated ${new Date().toLocaleString()}\nAssets: ${view.assets.length}\nCalculated plant health: ${view.score === null ? "Not available" : `${view.score}/100`}\nOpen alarms: ${view.alerts.filter((a) => a.status === "Open").length}\nOpen work orders: ${view.orders.length}\nOverdue: ${view.orders.filter((w) => isOverdue(w)).length}\nSensors reporting: ${view.sensorsOnline}/${view.sensorCount}\nGateway online: ${view.gatewaysOnline}/${view.gateways.length}\n\nAttention:\n${
    view.health
      .filter((h) => ["act", "watch", "offline"].includes(h.status))
      .map(
        (h) =>
          `${view.assets.find((a) => a.id === h.asset_id)?.name}: ${h.status}, ${h.score ?? "unavailable"}/100`,
      )
      .join("\n") || "No items in loaded health results"
  }\n\nCurrent operational snapshot; trends show recorded daily maxima, not a diagnosis or prediction.`;
  return (
    <Screen
      title="Reports"
      back
      actions={
        <Button
          title="Share"
          icon="share-2"
          onPress={() => Share.share({ message: summary }).catch(setError)}
        />
      }
    >
      <Select
        label="Plant"
        value={site}
        onChange={setSite}
        options={[
          { label: "All plants", value: "" },
          ...(sites.data || []).map((s) => ({ label: s.name, value: s.id })),
        ]}
      />
      <State
        loading={operations.isLoading || assets.isLoading}
        error={operations.error || assets.error || error}
        retry={() => operations.refetch()}
      />
      <View style={o.card}>
        <SectionHeading title="Operational summary" />
        <Text style={o.caption}>
          Current snapshot ·{" "}
          {new Date(operations.dataUpdatedAt || Date.now()).toLocaleString()}
        </Text>
        {[
          [
            "Plant health",
            view.score === null ? "Not available" : `${view.score}/100`,
          ],
          ["Assets", view.assets.length],
          [
            "Open alarms",
            view.alerts.filter((a) => a.status === "Open").length,
          ],
          ["Open work orders", view.orders.length],
          ["Overdue work", view.orders.filter((w) => isOverdue(w)).length],
        ].map(([label, value]) => (
          <View key={label} style={o.between}>
            <Text style={o.text}>{label}</Text>
            <Text style={o.title}>{value}</Text>
          </View>
        ))}
      </View>
      <View style={o.card}>
        <SectionHeading title="Recorded vibration history" />
        <Chips values={["7D", "30D"]} value={range} onChange={setRange} />
        {!!view.points.length && (
          <Select
            label="Measurement point"
            value={point?.point_id || ""}
            options={view.points.map((p) => ({
              label: `${view.assets.find((a) => a.id === p.asset_id)?.name} · ${p.point_name}`,
              value: p.point_id,
            }))}
            onChange={setPoint}
          />
        )}
        {daily.length ? (
          <TrendChart
            values={daily.map((d) => d.v_max!)}
            labels={daily.map((d) => d.day)}
            threshold={
              point?.graded ? Number(point.zone_bc) || undefined : undefined
            }
          />
        ) : (
          <Text style={o.caption}>
            No daily point readings are available for this period.
          </Text>
        )}
        <Text style={o.caption}>
          Daily maximum velocity (mm/s). Current counts describe now; they are
          not totals for the selected chart period.
        </Text>
      </View>
      <SectionHeading title="Machine condition" />
      {view.health.map((h) => (
        <View key={h.asset_id} style={[o.card, o.between]}>
          <View style={{ flex: 1 }}>
            <Text style={o.title}>
              {view.assets.find((a) => a.id === h.asset_id)?.name}
            </Text>
            <Text style={o.caption}>
              {h.driven_by_point_name || "No driving point"}
            </Text>
          </View>
          <StatusTag label={h.status} status={h.status} />
          <Text style={o.title}>{h.score ?? "—"}</Text>
        </View>
      ))}
    </Screen>
  );
}
