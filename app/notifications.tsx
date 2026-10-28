import React from "react";
import { router } from "expo-router";
import {
  Screen,
  Card,
  T,
  Icon,
  State,
  styles,
  formatDate,
} from "../components/ui";
import { View } from "react-native";
import { useAlerts, useAssets, useWorkOrders } from "../hooks/queries";
export default function Notifications() {
  const alerts = useAlerts(),
    assets = useAssets(true),
    orders = useWorkOrders();
  return (
    <Screen
      title="Notifications"
      back
      onRefresh={() => {
        alerts.refetch();
        orders.refetch();
      }}
      refreshing={alerts.isRefetching}
    >
      <State
        loading={alerts.isLoading || orders.isLoading}
        error={alerts.error || orders.error}
        retry={() => {
          alerts.refetch();
          orders.refetch();
        }}
        empty={
          !alerts.isLoading &&
          !orders.isLoading &&
          !alerts.data?.length &&
          !orders.data?.length
            ? "You’re all caught up."
            : undefined
        }
      />
      {alerts.data
        ?.filter((a) => a.status !== "Resolved")
        .map((a) => (
          <Card key={a.id} onPress={() => router.push(`/alert/${a.id}`)}>
            <View style={styles.row}>
              <Icon
                name="alert-triangle"
                color={a.severity === "Critical" ? "#E34C5C" : "#EB951A"}
              />
              <View style={{ flex: 1 }}>
                <T style={{ fontWeight: "700" }}>{a.title}</T>
                <T muted>
                  {assets.data?.find((x) => x.id === a.asset_id)?.name} ·{" "}
                  {formatDate(a.detected_at, true)}
                </T>
              </View>
              <Icon name="chevron-right" size={16} />
            </View>
          </Card>
        ))}
      {orders.data
        ?.filter((w) => w.status !== "Completed")
        .map((w) => (
          <Card key={w.id} onPress={() => router.push(`/work-order/${w.id}`)}>
            <View style={styles.row}>
              <Icon name="clipboard" color="#1B96FF" />
              <View style={{ flex: 1 }}>
                <T style={{ fontWeight: "700" }}>
                  Work order {w.status.toLowerCase()}
                </T>
                <T muted>
                  {w.number} · {w.title}
                </T>
              </View>
              <Icon name="chevron-right" size={16} />
            </View>
          </Card>
        ))}
    </Screen>
  );
}
