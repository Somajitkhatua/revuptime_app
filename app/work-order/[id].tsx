import { canEditMaintenance } from "../../utils/permissions";
import React, { useState } from "react";
import { View, Text, Pressable, Image } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import {
  Screen,
  Card,
  T,
  Badge,
  Button,
  Chips,
  Icon,
  Select,
  AssetCard,
  State,
  ErrorMessage,
  styles,
  formatDate,
} from "../../components/ui";
import {
  useWorkOrders,
  useAsset,
  useActions,
  useOrg,
} from "../../hooks/queries";
import DetailTabs from "../../components/DetailTabs";
import AssetListRow from "../../components/AssetListRow";
import { getTechnicians } from "../../services/organizations";
import { useApp } from "../../providers/AppProvider";
export default function WorkDetail() {
  const { id } = useLocalSearchParams<{ id: string }>(),
    q = useWorkOrders(),
    w = q.data?.find((o) => o.id === id),
    asset = useAsset(w?.asset_id || ""),
    actions = useActions(),
    [tab, setTab] = useState("Tasks"),
    org = useOrg(),
    { profile } = useApp(),
    tech = useQuery({
      queryKey: ["technicians", org],
      queryFn: () => getTechnicians(org),
      enabled: !!org,
    });
  const editable = canEditMaintenance(profile) && w?.status !== "Completed";
  return (
    <Screen
      title="Work Order"
      back
      footer={
        w && editable ? (
          <View
            style={{
              padding: 12,
              gap: 7,
              backgroundColor: "white",
              borderTopWidth: 1,
              borderTopColor: "#E6EEF7",
            }}
          >
            {editable && (
              <View style={styles.row}>
                <Button
                  title="Start Work"
                  disabled={w.status !== "Open"}
                  loading={actions.work.isPending}
                  style={{ flex: 1 }}
                  onPress={() =>
                    actions.work.mutate({
                      id,
                      values: { status: "In Progress" },
                    })
                  }
                />
                <Button
                  title="Complete"
                  disabled={w.tasks.some((t) => !t.completed)}
                  style={{ flex: 1, backgroundColor: "#00A55B" }}
                  onPress={() => router.push(`/work-order/complete?id=${id}`)}
                />
              </View>
            )}
            {editable && w.tasks.some((t) => !t.completed) && (
              <T muted style={{ fontSize: 11 }}>
                Complete every checklist task to close this work order.
              </T>
            )}
          </View>
        ) : undefined
      }
      onRefresh={() => q.refetch()}
      refreshing={q.isRefetching}
    >
      <State
        loading={q.isLoading}
        error={q.error}
        retry={() => q.refetch()}
        empty={
          !q.isLoading && !q.error && !w ? "Work order not found." : undefined
        }
      />
      {w && (
        <>
          <Card style={{ gap: 11 }}>
            <View style={styles.between}>
              <T style={{ color: "#1B96FF", fontWeight: "700" }}>{w.number}</T>
              <Badge value={w.status} />
            </View>
            <Text style={styles.title}>{w.title}</Text>
            <View style={styles.row}>
              <Badge value={w.priority} />
              <Badge value="Predictive" />
            </View>
            <View
              style={{
                flexDirection: "row",
                alignItems: "flex-start",
                gap: 18,
              }}
            >
              <View style={{ flex: 1 }}>
                <State
                  loading={tech.isLoading}
                  error={tech.error}
                  retry={() => tech.refetch()}
                />
                <Select
                  compact
                  label="Assigned to"
                  value={w.assigned_to || ""}
                  options={[
                    { label: "Unassigned", value: "" },
                    ...(tech.data || []).map((t) => ({
                      label: t.name,
                      value: t.id,
                    })),
                  ]}
                  onChange={(v) =>
                    editable &&
                    actions.work.mutate({
                      id,
                      values: { assigned_to: v || null },
                    })
                  }
                />
              </View>
              <View style={{ flex: 1, gap: 10, paddingTop: 2 }}>
                <T style={{ fontSize: 12, fontWeight: "600" }}>Due date</T>
                <T style={{ fontSize: 12 }}>{formatDate(w.due_date)}</T>
              </View>
            </View>
            {w.status === "Completed" && (
              <T muted>
                Closed {formatDate(w.completed_at || w.created_at, true)}
              </T>
            )}
          </Card>
          {asset.data && <AssetListRow asset={asset.data} />}
          <DetailTabs
            values={["Tasks", "Updates", "Photos", "Details"]}
            value={tab}
            onChange={setTab}
          />
          {tab === "Tasks" && (
            <Card style={{ gap: 6 }}>
              <View style={styles.between}>
                <T style={{ fontWeight: "700" }}>Inspection checklist</T>
                <T muted>
                  {w.tasks.filter((t) => t.completed).length}/{w.tasks.length}
                </T>
              </View>
              {w.tasks.map((t) => (
                <Pressable
                  key={t.id}
                  accessibilityRole="checkbox"
                  accessibilityLabel={t.title}
                  accessibilityState={{ checked: t.completed }}
                  disabled={!editable || actions.work.isPending}
                  onPress={() =>
                    actions.work.mutate({
                      id,
                      values: {
                        tasks: w.tasks.map((x) =>
                          x.id === t.id ? { ...x, completed: !x.completed } : x,
                        ),
                      },
                    })
                  }
                  style={[
                    styles.row,
                    {
                      paddingVertical: 7,
                      borderTopWidth: 1,
                      borderTopColor: "#E5EAF1",
                    },
                  ]}
                >
                  <Icon
                    name={t.completed ? "check-square" : "square"}
                    color={t.completed ? "#12A875" : "#94A3B8"}
                  />
                  <T
                    style={{
                      flex: 1,
                      color: t.completed ? "#64748B" : "#0F1E3A",
                    }}
                  >
                    {t.title}
                  </T>
                </Pressable>
              ))}
            </Card>
          )}
          {tab === "Updates" && (
            <Card style={{ gap: 10 }}>
              <T style={{ fontWeight: "700" }}>Activity</T>
              <T muted>Created {formatDate(w.created_at, true)}</T>
              <T>Current status: {w.status}</T>
              {w.completed_at && (
                <T muted>Completed {formatDate(w.completed_at, true)}</T>
              )}
              <T muted>{w.notes || "No notes added."}</T>
            </Card>
          )}
          {tab === "Photos" && (
            <>
              {w.result?.photos.length ? (
                w.result.photos.map((uri, i) => (
                  <Image
                    key={i}
                    source={{ uri }}
                    style={{ height: 220, width: "100%", borderRadius: 12 }}
                  />
                ))
              ) : (
                <State empty="Completion photos will appear here." />
              )}
            </>
          )}
          {tab === "Details" && (
            <Card style={{ gap: 12 }}>
              <T>Maintenance type: Predictive</T>
              <T>Priority: {w.priority}</T>
              <T muted>{w.notes || "No additional notes."}</T>
              {w.result && (
                <>
                  <T>Root cause: {w.result.root_cause}</T>
                  <T>Action taken: {w.result.action_taken}</T>
                  <T>Parts replaced: {w.result.parts_replaced}</T>
                  <T>Downtime: {w.result.downtime_minutes} min</T>
                  <T>Final vibration: {w.result.final_vibration} mm/s</T>
                </>
              )}
            </Card>
          )}
          <ErrorMessage error={actions.work.error} />
        </>
      )}
    </Screen>
  );
}
