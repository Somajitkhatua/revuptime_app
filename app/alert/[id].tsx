import { canEditMaintenance } from "../../utils/permissions";
import React from "react";
import { View, Text } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import {
  Screen,
  Card,
  T,
  Badge,
  Button,
  Section,
  SensorMetric,
  State,
  ErrorMessage,
  styles,
  formatDate,
} from "../../components/ui";
import TrendChart from "../../components/TrendChart";
import AIInsightCard from "../../components/AIInsightCard";
import {
  useAlerts,
  useAsset,
  useAssetTrend,
  useActions,
} from "../../hooks/queries";
import { useApp } from "../../providers/AppProvider";
export default function AlertDetail() {
  const { id } = useLocalSearchParams<{ id: string }>(),
    q = useAlerts(),
    alert = q.data?.find((a) => a.id === id),
    asset = useAsset(alert?.asset_id || ""),
    trend = useAssetTrend(alert?.asset_id || "", 24),
    actions = useActions(),
    { profile } = useApp();
  return (
    <Screen
      title="Alert Detail"
      back
      footer={
        alert && canEditMaintenance(profile) ? (
          <View
            style={{
              padding: 12,
              gap: 8,
              backgroundColor: "white",
              borderTopWidth: 1,
              borderTopColor: "#E6EEF7",
            }}
          >
            <Button
              title="Create Work Order"
              icon="clipboard"
              onPress={() =>
                router.push(
                  `/work-order/create?assetId=${alert.asset_id || ""}&alertId=${alert.id}&title=${encodeURIComponent("Inspect " + alert.title.toLowerCase())}`,
                )
              }
            />
            <ErrorMessage error={actions.alert.error} />
            <View style={styles.row}>
              <Button
                title="Acknowledge"
                secondary
                disabled={alert.status !== "Open"}
                loading={actions.alert.isPending}
                style={{ flex: 1 }}
                onPress={() =>
                  actions.alert.mutate({ id, status: "Acknowledged" })
                }
              />
              <Button
                title="Resolve"
                disabled={alert.status === "Resolved"}
                loading={actions.alert.isPending}
                style={{ flex: 1 }}
                onPress={() => actions.alert.mutate({ id, status: "Resolved" })}
              />
            </View>
          </View>
        ) : undefined
      }
    >
      <State
        loading={q.isLoading}
        error={q.error}
        retry={() => q.refetch()}
        empty={
          !q.isLoading && !q.error && !alert ? "Alert not found." : undefined
        }
      />
      {alert && (
        <>
          <Card style={{ gap: 10 }}>
            <View style={styles.between}>
              <Badge value={alert.severity} />
              <Badge value={alert.status} />
            </View>
            <View>
              <Text style={styles.title}>{asset.data?.name}</Text>
              <T muted style={{ marginTop: 5 }}>
                {alert.title}
              </T>
            </View>
            {[
              [
                "Measured Value",
                alert.value == null
                  ? "Unavailable"
                  : alert.value + " " + alert.unit,
              ],
              [
                "Threshold",
                alert.threshold == null
                  ? "Not configured"
                  : alert.threshold + " " + alert.unit,
              ],
              ["Detected", formatDate(alert.detected_at, true)],
              [
                "Duration",
                Math.max(
                  0,
                  Math.floor(
                    ((alert.resolved_at
                      ? Date.parse(alert.resolved_at)
                      : Date.now()) -
                      Date.parse(alert.detected_at)) /
                      60000,
                  ),
                ) + " minutes",
              ],
            ].map(([label, value]) => (
              <View
                key={label}
                style={[
                  styles.between,
                  {
                    borderBottomWidth: 1,
                    borderBottomColor: "#EAF0F7",
                    paddingVertical: 5,
                  },
                ]}
              >
                <T muted style={{ fontSize: 11 }}>
                  {label}
                </T>
                <T style={{ fontSize: 11, fontWeight: "600" }}>{value}</T>
              </View>
            ))}
          </Card>
          {!!alert.asset_id && (
            <Card style={{ gap: 8 }}>
              <Section title="24-hour vibration trend" />
              <State
                loading={trend.isLoading}
                error={trend.error}
                retry={() => trend.refetch()}
              />
              <TrendChart values={(trend.data || []).map((r) => r.x_rms)} />
            </Card>
          )}
          {!!alert.asset_id && (
            <AIInsightCard
              assetId={alert.asset_id}
              critical={alert.severity === "Critical"}
            />
          )}
        </>
      )}
    </Screen>
  );
}
