import React from "react";
import { View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import {
  Screen,
  Card,
  T,
  Icon,
  State,
  styles,
  formatDate,
} from "../../components/ui";
import { useMaintenanceHistory, useAsset } from "../../hooks/queries";
export default function History() {
  const { id } = useLocalSearchParams<{ id: string }>(),
    q = useMaintenanceHistory(id),
    a = useAsset(id);
  return (
    <Screen
      title="Maintenance History"
      subtitle={a.data?.name}
      back
      onRefresh={() => q.refetch()}
      refreshing={q.isRefetching}
    >
      <State
        loading={q.isLoading}
        error={q.error}
        retry={() => q.refetch()}
        empty={
          !q.isLoading && !q.error && !q.data?.length
            ? "No maintenance events recorded."
            : undefined
        }
      />
      {[...(q.data || [])]
        .sort((a, b) => b.occurred_at.localeCompare(a.occurred_at))
        .map((e) => (
          <View key={e.id} style={{ flexDirection: "row", gap: 15 }}>
            <View style={{ alignItems: "center" }}>
              <View
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  backgroundColor: "#E5F4EF",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Icon name="tool" size={15} color="#12A875" />
              </View>
              <View
                style={{
                  width: 1,
                  flex: 1,
                  backgroundColor: "#DCE6EF",
                  marginTop: 8,
                }}
              />
            </View>
            <Card style={{ flex: 1, gap: 10 }}>
              <T muted style={{ fontSize: 11 }}>
                {formatDate(e.occurred_at)} ·{" "}
                {e.work_order_id.startsWith("WO")
                  ? e.work_order_id
                  : "Completed work order"}
              </T>
              <T style={{ fontWeight: "700", fontSize: 16 }}>{e.title}</T>
              <T muted>Technician: {e.technician}</T>
              <T muted>Root cause: {e.root_cause}</T>
              <View style={styles.row}>
                <T>Before {e.before_vibration} mm/s</T>
                <Icon name="arrow-right" size={15} />
                <T style={{ color: "#12A875" }}>
                  After {e.after_vibration} mm/s
                </T>
              </View>
            </Card>
          </View>
        ))}
    </Screen>
  );
}
