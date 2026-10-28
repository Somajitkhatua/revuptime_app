import { canEditMaintenance } from "../../utils/permissions";
import React, { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { View, Text, Pressable, ScrollView } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import {
  Card,
  T,
  Button,
  Section,
  State,
  AlertCard,
  DocumentCard,
  formatDate,
  Icon,
} from "../../components/ui";
import MachineOperations from "../../components/MachineOperations";
import { StatusTag, o } from "../../components/OperationsUI";
import IndustrialPage from "../../components/IndustrialPage";
import {
  AssetHero,
  AssetInformation,
  LatestReadingRows,
} from "../../components/AssetOverview";
import MainNavigation from "../../components/MainNavigation";
import AIInsightCard from "../../components/AIInsightCard";
import TrendChart from "../../components/TrendChart";
import AssetDataExplorer from "../../components/AssetDataExplorer";
import AssetTimeline from "../../components/AssetTimeline";
import { formatInstallation } from "../../utils/assetDates";
import {
  useAsset,
  useTelemetry,
  useAssetTrend,
  useAlerts,
  useDocuments,
  useMaintenanceHistory,
  useRealtime,
} from "../../hooks/queries";
import { useApp } from "../../providers/AppProvider";
export default function AssetDetail() {
  const qc = useQueryClient();
  const { profile } = useApp();
  const { id } = useLocalSearchParams<{ id: string }>(),
    a = useAsset(id),
    telemetry = useTelemetry(id),
    trend = useAssetTrend(id, 24),
    alerts = useAlerts(id),
    docs = useDocuments(id),
    history = useMaintenanceHistory(id),
    [tab, setTab] = useState("Overview");
  useRealtime(id);
  const asset = a.data,
    r = telemetry.data;
  return (
    <View style={{ flex: 1 }}>
      <IndustrialPage
        title={asset?.name || "Asset"}
        subtitle={asset?.description}
        back
        actions={
          asset && canEditMaintenance(profile) ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Edit machine"
              onPress={() =>
                router.push({ pathname: "/asset/edit", params: { id } })
              }
              style={{ padding: 8 }}
            >
              <Icon name="edit-2" color="white" size={19} />
            </Pressable>
          ) : undefined
        }
        onRefresh={() => {
          qc.invalidateQueries({
            queryKey: ["insights", profile?.organization_id, id],
          });
          qc.invalidateQueries({
            queryKey: ["trends", profile?.organization_id, id],
          });
          qc.invalidateQueries({
            queryKey: ["workOrders", profile?.organization_id, id],
          });
          a.refetch();
          telemetry.refetch();
          trend.refetch();
          alerts.refetch();
          docs.refetch();
          history.refetch();
        }}
        refreshing={a.isRefetching}
      >
        <State
          loading={a.isLoading}
          error={a.error}
          empty={
            !a.isLoading && !a.error && !asset ? "Asset not found." : undefined
          }
          retry={() => a.refetch()}
        />
        {asset && (
          <>
            <View style={o.card}>
              <View style={o.between}>
                <T style={{ fontSize: 21, fontWeight: "800" }}>{asset.name}</T>
                <StatusTag
                  label={
                    asset.health === "Warning"
                      ? "Needs attention"
                      : asset.health
                  }
                  status={
                    asset.health === "Critical"
                      ? "act"
                      : asset.health === "Warning"
                        ? "watch"
                        : asset.health === "Healthy"
                          ? "good"
                          : "no_data"
                  }
                />
              </View>
              <T muted>
                {[asset.asset_code, asset.manufacturer, asset.model]
                  .filter(Boolean)
                  .join(" · ") || asset.type}
              </T>
              <T muted style={{ fontSize: 11 }}>
                Location: {asset.location || "Not provided"}
              </T>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{
                flexGrow: 0,
                borderBottomWidth: 1,
                borderBottomColor: "#E2EBF5",
              }}
            >
              {[
                "Overview",
                "Details",
                "Alarms",
                "Data Explorer",
                "Timeline",
                "Documents",
              ].map((name) => (
                <Pressable
                  key={name}
                  accessibilityRole="tab"
                  accessibilityLabel={name}
                  accessibilityState={{ selected: tab === name }}
                  aria-selected={tab === name}
                  onPress={() => setTab(name)}
                  style={{
                    paddingHorizontal: 13,
                    paddingVertical: 12,
                    borderBottomWidth: 2,
                    borderBottomColor: tab === name ? "#0085FF" : "transparent",
                  }}
                >
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: "600",
                      color: tab === name ? "#0085FF" : "#31547B",
                    }}
                  >
                    {name}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
            {tab === "Overview" && (
              <>
                <MachineOperations
                  asset={id}
                  fallback={
                    <Card style={{ gap: 8, padding: 16 }}>
                      <Section title="Current readings" />
                      <State
                        loading={telemetry.isLoading}
                        error={telemetry.error}
                        retry={() => telemetry.refetch()}
                        empty={
                          !telemetry.isLoading && !telemetry.error && !r
                            ? "No sensor readings yet."
                            : undefined
                        }
                      />
                      {r && (
                        <>
                          <LatestReadingRows reading={r} />
                        </>
                      )}
                    </Card>
                  }
                />
                <View
                  style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}
                >
                  <Button
                    title="Ask AI"
                    secondary
                    icon="zap"
                    onPress={() => router.push(`/ai?assetId=${id}`)}
                  />
                  <Button
                    title="Manual & documents"
                    secondary
                    icon="file-text"
                    onPress={() => router.push(`/asset/documents?id=${id}`)}
                  />
                </View>
                <AIInsightCard
                  assetId={id}
                  critical={asset.health === "Critical"}
                />
                {canEditMaintenance(profile) && (
                  <Button
                    title="Create Work Order"
                    icon="plus"
                    onPress={() =>
                      router.push(`/work-order/create?assetId=${id}`)
                    }
                  />
                )}
              </>
            )}
            {tab === "Details" && (
              <>
                <AssetInformation asset={asset} />
                <Card>
                  <T>Installed: {formatInstallation(asset)}</T>
                </Card>
                <Card style={{ gap: 8 }}>
                  <T style={{ fontWeight: "700" }}>Description</T>
                  <T muted>{asset.description || "No description provided."}</T>
                </Card>
              </>
            )}
            {tab === "Data Explorer" && <AssetDataExplorer assetId={id} />}
            {tab === "Timeline" && <AssetTimeline asset={asset} />}
            {tab === "Alarms" && (
              <>
                <State
                  loading={alerts.isLoading}
                  error={alerts.error}
                  retry={() => alerts.refetch()}
                  empty={
                    !alerts.isLoading && !alerts.data?.length
                      ? "No alerts for this asset."
                      : undefined
                  }
                />
                {alerts.data?.map((alert) => (
                  <AlertCard key={alert.id} alert={alert} asset={asset} />
                ))}
              </>
            )}
            {tab === "Documents" && (
              <>
                <Button
                  title="Manage Documents"
                  secondary
                  onPress={() => router.push(`/asset/documents?id=${id}`)}
                />
                <State
                  loading={docs.isLoading}
                  error={docs.error}
                  retry={() => docs.refetch()}
                  empty={
                    !docs.isLoading && !docs.data?.length
                      ? "No documents uploaded."
                      : undefined
                  }
                />
                {docs.data?.map((d) => (
                  <DocumentCard key={d.id} document={d} />
                ))}
              </>
            )}
          </>
        )}
      </IndustrialPage>
      <MainNavigation />
    </View>
  );
}
