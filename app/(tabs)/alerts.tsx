import React, { useState } from "react";
import { View, Text, Pressable } from "react-native";
import { Screen, Search, Chips, State, Icon } from "../../components/ui";
import { OperationalAlertCard } from "../../components/OperationalCards";
import { StatusTag, o } from "../../components/OperationsUI";
import { useAlerts, useAssets, useRealtime } from "../../hooks/queries";
import { useApp } from "../../providers/AppProvider";
export default function Alerts() {
  const q = useAlerts(),
    assets = useAssets(),
    { site } = useApp();
  const [search, setSearch] = useState(""),
    [status, setStatus] = useState("Open"),
    [severity, setSeverity] = useState("All"),
    [filters, setFilters] = useState(false);
  useRealtime();
  const ids = new Set((assets.data || []).map((a) => a.id));
  const scoped = (q.data || []).filter(
    (a) =>
      ids.has(a.asset_id) || (!a.asset_id && (!site || a.site_id === site)),
  );
  const rows = scoped
    .filter(
      (a) =>
        a.status === status &&
        (severity === "All" || a.severity === severity) &&
        `${a.title} ${assets.data?.find((x) => x.id === a.asset_id)?.name || ""}`
          .toLowerCase()
          .includes(search.toLowerCase()),
    )
    .sort(
      (a, b) =>
        ({ Critical: 0, High: 1, Warning: 2, Info: 3 })[a.severity] -
          { Critical: 0, High: 1, Warning: 2, Info: 3 }[b.severity] ||
        b.detected_at.localeCompare(a.detected_at),
    );
  const refresh = () => {
    q.refetch();
    assets.refetch();
  };
  return (
    <Screen
      title="Alerts"
      onRefresh={refresh}
      refreshing={q.isRefetching}
      actions={
        <View style={o.row}>
          <StatusTag
            label={String(scoped.filter((a) => a.status === "Open").length)}
            status="act"
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Filter alerts"
            onPress={() => setFilters((v) => !v)}
          >
            <Icon name="sliders" color="white" />
          </Pressable>
        </View>
      }
    >
      <Chips
        values={["Open", "Acknowledged", "Resolved"]}
        value={status}
        onChange={setStatus}
      />
      <Search
        value={search}
        onChange={setSearch}
        placeholder="Search alerts..."
      />
      {filters && (
        <Chips
          values={["All", "Critical", "High", "Warning", "Info"]}
          value={severity}
          onChange={setSeverity}
        />
      )}
      <Text style={o.caption}>
        {rows.length} {status.toLowerCase()} alerts ·{" "}
        {site ? "Selected plant" : "All plants"}
      </Text>
      <State
        loading={q.isLoading || assets.isLoading}
        error={q.error || assets.error}
        retry={refresh}
        empty={
          !q.isLoading && !assets.isLoading && !q.error && !rows.length
            ? "No alerts match your filters."
            : undefined
        }
      />
      {rows.map((a) => (
        <OperationalAlertCard
          key={a.id}
          alert={a}
          machine={assets.data?.find((x) => x.id === a.asset_id)?.name}
        />
      ))}
    </Screen>
  );
}
