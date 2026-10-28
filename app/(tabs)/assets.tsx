import { canEditMaintenance } from "../../utils/permissions";
import React, { useState } from "react";
import { View, Text, Pressable, Modal, StyleSheet } from "react-native";
import IndustrialPage from "../../components/IndustrialPage";
import HealthFilterChips from "../../components/HealthFilterChips";
import AssetListRow from "../../components/AssetListRow";
import { Search, State, Icon, Chips, Button, Select } from "../../components/ui";
import { useAssets, useSites, useRealtime } from "../../hooks/queries";
import { useQueryClient } from "@tanstack/react-query";
import { useApp } from "../../providers/AppProvider";
import { router } from "expo-router";

export default function Assets() {
  const q = useAssets(),
    sites = useSites(),
    { site, setSite, profile } = useApp();
  const qc = useQueryClient();
  useRealtime();
  const refresh = () => {
    q.refetch();
    sites.refetch();
    qc.invalidateQueries({ queryKey: ["telemetry", profile?.organization_id] });
  };
  const [search, setSearch] = useState(""),
    [health, setHealth] = useState("All"),
    [type, setType] = useState("All"),
    [sort, setSort] = useState("Default"),
    [dialog, setDialog] = useState<"filter" | "sort" | null>(null);
  const rows = (q.data || []).filter(
    (a) =>
      (health === "All" || a.health === health) &&
      (type === "All" || a.type === type) &&
      `${a.name} ${a.asset_code || ""} ${a.description} ${a.manufacturer} ${a.model} ${a.location}`
        .toLowerCase()
        .includes(search.trim().toLowerCase()),
  );
  if (sort === "Asset name") rows.sort((a, b) => a.name.localeCompare(b.name));
  else if (sort === "Health: lowest first")
    rows.sort((a, b) => a.health_score - b.health_score);
  else if (sort === "Health: highest first")
    rows.sort((a, b) => b.health_score - a.health_score);
  const activeType = type !== "All";
  return (
    <IndustrialPage
      title="Assets"
      refreshing={q.isRefetching}
      onRefresh={refresh}
      actions={
        <>
          <Pressable accessibilityRole="button" accessibilityLabel="Refresh assets and readings" onPress={refresh} hitSlop={8}>
            <Icon name="refresh-cw" color="white" size={19} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Filter assets by type"
            onPress={() => setDialog("filter")}
            hitSlop={8}
          >
            <Icon
              name="sliders"
              color={activeType ? "#5BB8EE" : "white"}
              size={19}
            />
            {activeType && <View style={s.filterDot} />}
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Sort assets"
            onPress={() => setDialog("sort")}
            hitSlop={8}
          >
            <Icon
              name="bar-chart-2"
              color={sort === "Default" ? "white" : "#5BB8EE"}
              size={19}
            />
          </Pressable>
        </>
      }
    >
      <Select label="Plant" value={site} onChange={setSite}
        options={[{ label: "All plants", value: "" }, ...(sites.data || []).map((plant) => ({ label: plant.name, value: plant.id }))]} />
      <Text style={s.summary}>Assets you can access in this workspace. Select All plants to include every plant.</Text>
      <Search
        value={search}
        onChange={setSearch}
        placeholder="Search assets..."
      />
      <HealthFilterChips value={health} onChange={setHealth} />
      {canEditMaintenance(profile) && (
        <Button
          title="Add machine"
          icon="plus"
          onPress={() => router.push("/asset/edit")}
        />
      )}
      {activeType && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Clear asset type filter"
          onPress={() => setType("All")}
          style={s.applied}
        >
          <Text style={s.appliedText}>{type} assets</Text>
          <Icon name="x" color="#0085FF" size={13} />
        </Pressable>
      )}
      <State
        loading={q.isLoading}
        error={q.error || sites.error}
        retry={refresh}
        empty={
          !q.isLoading && !q.error && !rows.length
            ? "No assets match your filters."
            : undefined
        }
      />
      <View style={s.list}>
        {rows.map((a) => (
          <AssetListRow key={a.id} asset={a} plantName={sites.data?.find((plant) => plant.id === a.site_id)?.name} />
        ))}
      </View>
      {!q.isLoading && !q.error && (
        <Text style={s.summary}>
          {rows.length} {rows.length === 1 ? "asset" : "assets"} ·{" "}
          {site ? sites.data?.find((p) => p.id === site)?.name || "Selected plant" : "All plants"}
        </Text>
      )}
      <Modal
        visible={!!dialog}
        transparent
        animationType="fade"
        onRequestClose={() => setDialog(null)}
      >
        <View style={s.overlay}>
          <View style={s.dialog}>
            <View style={s.dialogHeading}>
              <Text style={s.dialogTitle}>
                {dialog === "filter" ? "Filter by asset type" : "Sort assets"}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close options"
                onPress={() => setDialog(null)}
                hitSlop={8}
              >
                <Icon name="x" size={20} />
              </Pressable>
            </View>
            {dialog === "filter" ? (
              <>
                <Chips
                  values={["All", "Motor", "Pump", "Fan", "Gearbox", "Other"]}
                  value={type}
                  onChange={setType}
                />
                <Button title="Show assets" onPress={() => setDialog(null)} />
              </>
            ) : (
              [
                "Default",
                "Asset name",
                "Health: lowest first",
                "Health: highest first",
              ].map((option) => (
                <Pressable
                  key={option}
                  accessibilityRole="button"
                  accessibilityLabel={option}
                  onPress={() => {
                    setSort(option);
                    setDialog(null);
                  }}
                  style={s.sortRow}
                >
                  <Text style={s.sortText}>
                    {option === "Default" ? "Default order" : option}
                  </Text>
                  {sort === option && (
                    <Icon name="check" color="#0085FF" size={18} />
                  )}
                </Pressable>
              ))
            )}
          </View>
        </View>
      </Modal>
    </IndustrialPage>
  );
}
const s = StyleSheet.create({
  list: { gap: 8 },
  summary: {
    textAlign: "center",
    fontSize: 11,
    color: "#7A8CA3",
    marginTop: 5,
  },
  filterDot: {
    position: "absolute",
    height: 5,
    width: 5,
    borderRadius: 3,
    backgroundColor: "#5BB8EE",
    right: -4,
    top: -3,
  },
  applied: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: "#E6F2FF",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 7,
  },
  appliedText: { fontSize: 11, color: "#0085FF" },
  overlay: {
    flex: 1,
    backgroundColor: "#001C3670",
    alignItems: "center",
    justifyContent: "center",
    padding: 22,
  },
  dialog: {
    width: "100%",
    maxWidth: 440,
    backgroundColor: "white",
    borderRadius: 18,
    padding: 22,
    gap: 20,
  },
  dialogHeading: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  dialogTitle: { fontSize: 18, fontWeight: "700", color: "#0F1E3A" },
  sortRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#EDF2F8",
  },
  sortText: { fontSize: 14, color: "#304B70" },
});
