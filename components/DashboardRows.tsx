import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { router } from "expo-router";
import { Asset, AssetAlert, WorkOrder } from "../types/models";
import { Icon, tone, formatDate } from "./ui";

export function DashboardAlertRow({
  alert,
  asset,
  last = false,
}: {
  alert: AssetAlert;
  asset?: Asset;
  last?: boolean;
}) {
  const color = tone(alert.severity);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${asset?.name}: ${alert.title}`}
      onPress={() => router.push(`/alert/${alert.id}`)}
      style={[s.alertRow, !last && s.divider]}
    >
      <View style={[s.alertIcon, { backgroundColor: color + "16" }]}>
        <View style={[s.bell, { backgroundColor: color }]}>
          <Icon name="bell" color="white" size={17} />
        </View>
      </View>
      <View style={s.copy}>
        <Text style={s.asset}>{asset?.name || "Asset alert"}</Text>
        <Text style={s.description}>
          {alert.title} ({alert.value} {alert.unit})
        </Text>
        <Text style={s.time}>{formatDate(alert.detected_at, true)}</Text>
      </View>
      <Icon name="chevron-right" color="#244662" size={17} />
    </Pressable>
  );
}
export function DashboardWorkOrderRow({
  order,
  asset,
  last = false,
}: {
  order: WorkOrder;
  asset?: Asset;
  last?: boolean;
}) {
  const color = tone(order.priority);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${order.number}: ${order.title}`}
      onPress={() => router.push(`/work-order/${order.id}`)}
      style={[s.workRow, !last && s.divider]}
    >
      <Text style={s.order}>{order.number}</Text>
      <Text style={s.orderAsset} numberOfLines={1}>
        {asset?.name || "Asset"}
      </Text>
      <View style={[s.priority, { backgroundColor: color + "17" }]}>
        <Text style={{ fontSize: 9, fontWeight: "700", color }}>
          {order.priority.toUpperCase()}
        </Text>
      </View>
    </Pressable>
  );
}
export function DashboardSection({
  title,
  onPress,
}: {
  title: string;
  onPress: () => void;
}) {
  return (
    <View style={s.section}>
      <Text style={s.title}>{title}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`See all ${title}`}
        onPress={onPress}
        hitSlop={8}
      >
        <Text style={s.seeAll}>See All</Text>
      </Pressable>
    </View>
  );
}
const s = StyleSheet.create({
  section: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 5,
  },
  title: {
    fontSize: 17,
    fontWeight: "800",
    color: "#0F1E3A",
    letterSpacing: -0.4,
  },
  seeAll: { fontSize: 11, color: "#0085FF", fontWeight: "500" },
  alertRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 11,
    minHeight: 74,
  },
  divider: { borderBottomWidth: 1, borderBottomColor: "#E7EDF4" },
  alertIcon: {
    width: 39,
    height: 46,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  bell: {
    width: 29,
    height: 31,
    borderRadius: 7,
    alignItems: "center",
    justifyContent: "center",
  },
  copy: { flex: 1, gap: 3 },
  asset: { fontSize: 13, fontWeight: "700", color: "#0F1E3A" },
  description: { fontSize: 11, color: "#304B70" },
  time: { fontSize: 10, color: "#64748B" },
  workRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minHeight: 46,
    paddingHorizontal: 11,
  },
  order: { fontSize: 11, fontWeight: "600", color: "#0F1E3A" },
  orderAsset: { flex: 1, fontSize: 11, color: "#304B70" },
  priority: { paddingVertical: 5, paddingHorizontal: 7, borderRadius: 7 },
});
