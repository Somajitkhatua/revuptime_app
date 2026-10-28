import React, { useState } from "react";
import { View, Text } from "react-native";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Screen, Search, Chips, State, Button } from "../../components/ui";
import { OperationalWorkCard } from "../../components/OperationalCards";
import { o } from "../../components/OperationsUI";
import {
  useWorkOrders,
  useAssets,
  useRealtime,
  useOrg,
} from "../../hooks/queries";
import { useApp } from "../../providers/AppProvider";
import { canEditMaintenance } from "../../utils/permissions";
import { isOverdue } from "../../utils/operations";
import { getTeamMembers } from "../../services/organizations";
export default function WorkOrders() {
  const q = useWorkOrders(),
    assets = useAssets(),
    org = useOrg(),
    { profile, site } = useApp();
  const team = useQuery({
    queryKey: ["team", org],
    queryFn: () => getTeamMembers(org),
    enabled: !!org,
  });
  const [search, setSearch] = useState(""),
    [filter, setFilter] = useState("All"),
    [status, setStatus] = useState("Active");
  useRealtime();
  const ids = new Set((assets.data || []).map((a) => a.id));
  const scoped = (q.data || []).filter(
    (w) =>
      (ids.has(w.asset_id) || (!w.asset_id && (!site || w.site_id === site))) &&
      !["cancelled", "closed"].includes(w.raw_status || ""),
  );
  const rows = scoped
    .filter(
      (w) =>
        (filter !== "Assigned to me" || w.assigned_to === profile?.id) &&
        (filter === "Completed"
          ? w.status === "Completed"
          : status === "Active"
            ? w.status !== "Completed"
            : w.status === status) &&
        `${w.number} ${w.title} ${assets.data?.find((a) => a.id === w.asset_id)?.name || ""}`
          .toLowerCase()
          .includes(search.toLowerCase()),
    )
    .sort(
      (a, b) =>
        Number(isOverdue(b)) - Number(isOverdue(a)) ||
        (a.due_date || "9999").localeCompare(b.due_date || "9999"),
    );
  const refresh = () => {
    q.refetch();
    assets.refetch();
  };
  return (
    <Screen
      title="Work Orders"
      onRefresh={refresh}
      refreshing={q.isRefetching}
      actions={
        canEditMaintenance(profile) ? (
          <Button
            title="New"
            icon="plus"
            onPress={() => router.push("/work-order/create")}
          />
        ) : undefined
      }
      footer={
        canEditMaintenance(profile) ? (
          <View style={{ padding: 12, backgroundColor: "white" }}>
            <Button
              title="New work order"
              icon="plus"
              onPress={() => router.push("/work-order/create")}
            />
          </View>
        ) : undefined
      }
    >
      <Chips
        values={["Assigned to me", "All", "Completed"]}
        value={filter}
        onChange={setFilter}
      />
      <Search
        value={search}
        onChange={setSearch}
        placeholder="Search work orders..."
      />
      {filter !== "Completed" && (
        <Chips
          values={["Active", "Open", "In Progress"]}
          value={status}
          onChange={setStatus}
        />
      )}
      <Text style={o.caption}>
        {scoped.filter((w) => isOverdue(w)).length} overdue · {rows.length}{" "}
        matching work orders
      </Text>
      <State
        loading={q.isLoading || assets.isLoading}
        error={q.error || assets.error}
        retry={refresh}
        empty={
          !q.isLoading && !assets.isLoading && !q.error && !rows.length
            ? "No work orders match your filters."
            : undefined
        }
      />
      {rows.map((w) => (
        <OperationalWorkCard
          key={w.id}
          order={w}
          machine={assets.data?.find((a) => a.id === w.asset_id)?.name}
          assignee={team.data?.find((m) => m.id === w.assigned_to)?.name}
        />
      ))}
    </Screen>
  );
}
