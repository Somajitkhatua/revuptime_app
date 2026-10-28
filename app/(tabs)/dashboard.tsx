import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  Pressable,
  StyleSheet,
} from "react-native";
import { router, Href } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Select, State, Icon, IconName } from "../../components/ui";
import DashboardHeader from "../../components/DashboardHeader";
import HomeHealthHero from "../../components/HomeHealthHero";
import {
  useSites,
  useAssets,
  useAlerts,
  useWorkOrders,
  useOperations,
  useRealtime,
} from "../../hooks/queries";
import { useApp } from "../../providers/AppProvider";
import {
  scopedOperations,
  ago,
  gatewayState,
  operationLabels,
  operationColor,
  isOverdue,
} from "../../utils/operations";
import { canEditMaintenance } from "../../utils/permissions";
import { isDemo } from "../../services/supabase";
function SummaryTile({
  label,
  value,
  icon,
  color,
  onPress,
}: {
  label: string;
  value: string;
  icon: IconName;
  color: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value}`}
      onPress={onPress}
      style={s.summaryTile}
    >
      <View style={[s.miniIcon, { backgroundColor: color + "12" }]}>
        <Icon name={icon} size={19} color={color} />
      </View>
      <Text style={s.summaryValue} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={s.summaryLabel}>{label}</Text>
    </Pressable>
  );
}
export default function Dashboard() {
  const { site, setSite, profile } = useApp();
  const sites = useSites(),
    assets = useAssets(true),
    alerts = useAlerts(),
    orders = useWorkOrders(),
    operations = useOperations();
  const connection = useRealtime();
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 15000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (site && sites.isSuccess && !sites.data.some((p) => p.id === site))
      setSite("");
  }, [site, sites.data]);
  const view = scopedOperations(
    operations.data,
    assets.data || [],
    site,
    alerts.data || [],
    orders.data || [],
  );
  const available = !!operations.data?.available;
  const openAlerts = view.alerts
    .filter((a) => a.status === "Open")
    .sort(
      (a, b) =>
        ({ Critical: 0, High: 1, Warning: 2, Info: 3 })[a.severity] -
          { Critical: 0, High: 1, Warning: 2, Info: 3 }[b.severity] ||
        b.detected_at.localeCompare(a.detected_at),
    );
  const represented = new Set(openAlerts.map((a) => a.asset_id));
  const needs = view.health
    .filter(
      (h) =>
        ["act", "watch"].includes(h.status) && !represented.has(h.asset_id),
    )
    .sort((a, b) => (a.score ?? 101) - (b.score ?? 101));
  const silent = view.gateways.filter(
    (g) =>
      ["Offline", "Stale"].includes(gatewayState(g)) &&
      !openAlerts.some((a) => a.gateway_id === g.id),
  );
  const overdue = view.orders.filter((w) => isOverdue(w));
  const issueCount =
    openAlerts.length + needs.length + silent.length + overdue.length;
  const refresh = () => {
    sites.refetch();
    assets.refetch();
    alerts.refetch();
    orders.refetch();
    operations.refetch();
  };
  const loading = assets.isLoading || sites.isLoading || operations.isLoading;
  const error =
    assets.error ||
    sites.error ||
    operations.error ||
    alerts.error ||
    orders.error;
  const updated = operations.dataUpdatedAt
    ? ago(new Date(operations.dataUpdatedAt).toISOString())
    : "Fetching";
  const writable = canEditMaintenance(profile);
  return (
    <View style={s.root}>
      <DashboardHeader alertCount={openAlerts.length} />
      <LinearGradient
        colors={["#F8FBFF", "#F0F7FD", "#F7FAFD"]}
        style={{ flex: 1 }}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={s.scroll}
          refreshControl={
            <RefreshControl
              refreshing={operations.isRefetching}
              onRefresh={refresh}
              tintColor="#0085FF"
            />
          }
        >
          <View style={s.body}>
            <View style={{ gap: 5 }}>
              <Text style={s.greeting}>
                Good{" "}
                {new Date().getHours() < 12
                  ? "morning"
                  : new Date().getHours() < 17
                    ? "afternoon"
                    : "evening"}
                , {profile?.name.split(" ")[0] || "there"}
              </Text>
              <Text style={s.subtitle}>Here’s your plant at a glance.</Text>
            </View>
            <View style={s.selectorRow}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Select
                  compact
                  accessibilityLabel="Plant"
                  value={site}
                  onChange={setSite}
                  options={[
                    { label: "All plants", value: "" },
                    ...(sites.data || []).map((p) => ({
                      label: p.name,
                      value: p.id,
                    })),
                  ]}
                />
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Refresh dashboard"
                accessibilityHint={
                  connection === "Connected"
                    ? "Workspace updates connected"
                    : "Refresh workspace data"
                }
                onPress={refresh}
                style={s.updated}
              >
                <View
                  style={[
                    s.dot,
                    {
                      backgroundColor: error
                        ? "#E05252"
                        : operations.isFetching
                          ? "#D8A52C"
                          : "#24AE60",
                    },
                  ]}
                />
                <Text style={s.updatedText}>
                  {isDemo
                    ? "Demo data"
                    : error
                      ? "Retry refresh"
                      : operations.isFetching
                        ? "Updating…"
                        : `Updated ${updated}`}
                </Text>
                <Icon name="refresh-cw" size={12} color="#607F99" />
              </Pressable>
            </View>
            <State loading={loading} error={error} retry={refresh} />
            <HomeHealthHero
              score={view.score}
              health={view.health}
              available={available}
              onPress={() => router.push("/(tabs)/assets")}
            />
            {!available && operations.isSuccess && (
              <Text style={s.caption}>
                Calculated health is not available yet. Existing machine
                readings remain accessible under Assets.
              </Text>
            )}
            <View style={s.summaryRow}>
              <SummaryTile
                label="Open alerts"
                value={alerts.isError ? "—" : String(openAlerts.length)}
                color="#F04C53"
                icon="bell"
                onPress={() => router.push("/(tabs)/alerts")}
              />
              <SummaryTile
                label="Work orders"
                value={orders.isError ? "—" : String(view.orders.length)}
                color="#0085FF"
                icon="clipboard"
                onPress={() => router.push("/(tabs)/work-orders")}
              />
              <SummaryTile
                label="Sensors online"
                value={
                  available ? `${view.sensorsOnline}/${view.sensorCount}` : "—"
                }
                color="#16AB52"
                icon="wifi"
                onPress={() => router.push("/(tabs)/devices")}
              />
            </View>
            <View style={s.sectionHeading}>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 7,
                  flex: 1,
                }}
              >
                <Text style={s.sectionTitle}>Needs your attention</Text>
                {issueCount > 0 && (
                  <View style={s.count}>
                    <Text style={s.countText}>{issueCount}</Text>
                  </View>
                )}
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="View all alerts"
                onPress={() => router.push("/(tabs)/alerts")}
              >
                <Text style={s.link}>View all →</Text>
              </Pressable>
            </View>
            {openAlerts.slice(0, 2).map((a) => {
              const tint = ["Critical", "High"].includes(a.severity)
                ? "#E34D59"
                : a.severity === "Warning"
                  ? "#E5A000"
                  : "#648299";
              const point = view.points.find((p) => p.point_id === a.point_id);
              return (
                <Pressable
                  key={a.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Review alert: ${a.title}`}
                  onPress={() => router.push(`/alert/${a.id}`)}
                  style={[s.issueCard, { borderLeftColor: tint }]}
                >
                  <View style={[s.issueIcon, { backgroundColor: tint + "14" }]}>
                    <Icon
                      name={a.gateway_id ? "wifi-off" : "alert-triangle"}
                      color={tint}
                      size={24}
                    />
                  </View>
                  <View style={{ flex: 1, minWidth: 0, gap: 5 }}>
                    <View style={s.issueTop}>
                      <Text style={s.issueTitle}>
                        {view.assets.find((x) => x.id === a.asset_id)?.name ||
                          view.gateways.find((g) => g.id === a.gateway_id)
                            ?.name ||
                          "Workspace alert"}
                      </Text>
                      {Number.isFinite(a.value) && (
                        <Text style={[s.issueValue, { color: tint }]}>
                          {a.value} {a.unit}
                        </Text>
                      )}
                    </View>
                    <Text style={s.issueDescription}>{a.title}</Text>
                    {Number.isFinite(a.threshold) && (
                      <Text style={s.caption}>
                        Limit {a.threshold} {a.unit}
                      </Text>
                    )}
                    <View style={s.issueFooter}>
                      <Text style={[s.caption, { flex: 1 }]}>
                        {point?.point_name ? `${point.point_name} · ` : ""}
                        {ago(a.detected_at)}
                      </Text>
                      <Text style={s.link}>Review alert →</Text>
                    </View>
                  </View>
                </Pressable>
              );
            })}
            {needs.slice(0, 2).map((h) => {
              const p = view.points.find(
                  (p) => p.point_id === h.driven_by_point_id,
                ),
                tint = operationColor(h.status);
              return (
                <Pressable
                  key={h.asset_id}
                  accessibilityRole="button"
                  accessibilityLabel={`Review machine: ${view.assets.find((a) => a.id === h.asset_id)?.name || "Machine"}`}
                  onPress={() => router.push(`/asset/${h.asset_id}`)}
                  style={[s.issueCard, { borderLeftColor: tint }]}
                >
                  <View style={[s.issueIcon, { backgroundColor: tint + "14" }]}>
                    <Icon name="activity" color={tint} size={24} />
                  </View>
                  <View style={{ flex: 1, gap: 5 }}>
                    <View style={s.issueTop}>
                      <Text style={s.issueTitle}>
                        {view.assets.find((a) => a.id === h.asset_id)?.name ||
                          "Machine"}
                      </Text>
                      {p?.velocity != null && (
                        <Text style={[s.issueValue, { color: tint }]}>
                          {p.velocity.toFixed(1)} mm/s
                        </Text>
                      )}
                    </View>
                    <Text style={s.issueDescription}>
                      {operationLabels[h.status] || h.status}
                    </Text>
                    <Text style={s.caption}>
                      {h.driven_by_point_name || "Calculated machine condition"}
                    </Text>
                    <View style={s.issueFooter}>
                      <Text style={s.caption}>{ago(h.latest_at)}</Text>
                      <Text style={s.link}>Review machine →</Text>
                    </View>
                  </View>
                </Pressable>
              );
            })}
            {silent.slice(0, 2).map((g) => (
              <Pressable
                key={g.id}
                accessibilityRole="button"
                accessibilityLabel={`Open gateway: ${g.name}`}
                onPress={() =>
                  router.push({
                    pathname: "/devices/detail",
                    params: { id: g.id, kind: "Gateway" },
                  })
                }
                style={s.compactIssue}
              >
                <View style={[s.issueIcon, { backgroundColor: "#FFF1F1" }]}>
                  <Icon name="wifi-off" color="#E95359" size={24} />
                </View>
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={s.issueTitle}>{g.name}</Text>
                  <Text style={s.caption}>
                    {gatewayState(g)} · Last seen {ago(g.last_seen_at)}
                  </Text>
                </View>
                <Icon name="chevron-right" size={20} />
              </Pressable>
            ))}
            {overdue.slice(0, 2).map((w) => (
              <Pressable
                key={w.id}
                accessibilityRole="button"
                onPress={() => router.push(`/work-order/${w.id}`)}
                style={s.compactIssue}
              >
                <View style={[s.issueIcon, { backgroundColor: "#FFF6E5" }]}>
                  <Icon name="clipboard" color="#C58613" size={22} />
                </View>
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={s.issueTitle}>{w.title}</Text>
                  <Text style={s.caption}>Overdue · {w.due_date}</Text>
                </View>
                <Icon name="chevron-right" size={20} />
              </Pressable>
            ))}
            {!issueCount && !loading && !error && (
              <View style={s.compactIssue}>
                <Icon name="check-circle" color="#19A759" size={24} />
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={s.issueTitle}>
                    {available
                      ? "No urgent items found"
                      : "Explore your workspace"}
                  </Text>
                  <Text style={s.caption}>
                    Open Assets to review measurements and reporting status.
                  </Text>
                </View>
              </View>
            )}
            <Text style={s.sectionTitle}>Quick actions</Text>
            <View style={s.quickRow}>
              {[
                { label: "Ask AI", icon: "zap" as const, route: "/ai" },
                {
                  label: "Documents",
                  icon: "file-text" as const,
                  route: "/asset/documents",
                },
                ...(writable
                  ? [
                      {
                        label: "Add work",
                        icon: "plus-circle" as const,
                        route: "/work-order/create",
                      },
                    ]
                  : [
                      {
                        label: "View work",
                        icon: "clipboard" as const,
                        route: "/work-orders",
                      },
                    ]),
              ].map((item) => (
                <Pressable
                  key={item.label}
                  accessibilityRole="button"
                  accessibilityLabel={item.label}
                  onPress={() => router.push(item.route as Href)}
                  style={s.quick}
                >
                  <Icon name={item.icon} color="#0085FF" size={21} />
                  <Text style={s.quickText}>{item.label}</Text>
                </Pressable>
              ))}
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Gateways online: ${available ? `${view.gatewaysOnline} / ${view.gateways.length}` : "unavailable"}`}
              onPress={() => router.push("/(tabs)/devices")}
              style={s.connectionFooter}
            >
              <Icon name="radio" size={14} color="#648199" />
              <Text style={s.caption}>
                {available
                  ? `${view.gatewaysOnline} of ${view.gateways.length} gateways online`
                  : "View gateway reporting status"}
              </Text>
              <Icon name="chevron-right" size={14} color="#648199" />
            </Pressable>
          </View>
        </ScrollView>
      </LinearGradient>
    </View>
  );
}
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#F8FBFF" },
  scroll: { paddingHorizontal: 16, paddingTop: 15, paddingBottom: 24 },
  body: { width: "100%", maxWidth: 680, alignSelf: "center", gap: 14 },
  greeting: {
    fontSize: 25,
    fontWeight: "800",
    letterSpacing: -0.9,
    color: "#092947",
  },
  subtitle: { fontSize: 14, color: "#55728F", lineHeight: 21 },
  selectorRow: { flexDirection: "row", alignItems: "center", gap: 11 },
  updated: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingVertical: 12,
    minHeight: 42,
  },
  updatedText: { fontSize: 10, color: "#55728F" },
  dot: { width: 7, height: 7, borderRadius: 4 },
  caption: { fontSize: 10, color: "#6E859C", lineHeight: 15 },
  summaryRow: { flexDirection: "row", gap: 9 },
  summaryTile: {
    flex: 1,
    minWidth: 0,
    backgroundColor: "white",
    padding: 11,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E6EFF7",
    gap: 6,
    shadowColor: "#003C69",
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 7,
    shadowOpacity: 0.035,
  },
  miniIcon: {
    width: 31,
    height: 31,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  summaryValue: {
    fontSize: 23,
    fontWeight: "800",
    letterSpacing: -0.7,
    color: "#0B2D4E",
  },
  summaryLabel: { fontSize: 10, color: "#4E6C87", lineHeight: 14 },
  sectionHeading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 5,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "800",
    letterSpacing: -0.4,
    color: "#092947",
  },
  count: {
    backgroundColor: "#FFE5E3",
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 10,
  },
  countText: { fontSize: 10, color: "#E35353", fontWeight: "700" },
  link: { fontSize: 11, fontWeight: "600", color: "#0085FF" },
  issueCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: "white",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E7EFF6",
    borderLeftWidth: 4,
    padding: 13,
  },
  issueIcon: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 11,
  },
  issueTop: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 5,
  },
  issueTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#0B2C4D",
    flexShrink: 1,
  },
  issueValue: { fontSize: 16, fontWeight: "800" },
  issueDescription: { fontSize: 12, lineHeight: 18, color: "#506F8B" },
  issueFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 5,
    flexWrap: "wrap",
    marginTop: 4,
  },
  compactIssue: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    backgroundColor: "white",
    padding: 13,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E7EFF6",
  },
  quickRow: { flexDirection: "row", gap: 8 },
  quick: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    backgroundColor: "white",
    paddingHorizontal: 6,
    paddingVertical: 14,
    minHeight: 51,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2EDF7",
  },
  quickText: { fontSize: 11, fontWeight: "700", color: "#123451" },
  connectionFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    paddingVertical: 4,
  },
});
