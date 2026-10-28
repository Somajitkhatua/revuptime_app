import React, { useState } from "react";
import { View, Text, Linking } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Screen, Chips, Button, State, Search } from "../../components/ui";
import { o, StatusTag } from "../../components/OperationsUI";
import { useOperations, useAssets, useOrg } from "../../hooks/queries";
import { useApp } from "../../providers/AppProvider";
import { client, isDemo } from "../../services/supabase";
export default function OperationsSettings() {
  const params = useLocalSearchParams<{ section?: string }>(),
    [section, setSection] = useState(
      params.section === "rules" ? "Alert rules" : "Measurement points",
    ),
    [search, setSearch] = useState(""),
    org = useOrg(),
    { profile, site } = useApp(),
    operations = useOperations(),
    assets = useAssets();
  const manage = ["Owner", "Admin", "Maintenance Manager"].includes(
    profile?.role || "",
  );
  const rules = useQuery({
    queryKey: ["alert-rules", org],
    enabled: !!org,
    queryFn: async () => {
      if (isDemo) return [];
      const { data, error } = await client()
        .from("alert_rules")
        .select(
          "id,name,description,severity,is_active,asset_id,site_id,rule_type",
        )
        .eq("organization_id", org)
        .order("name");
      if (error) throw error;
      return data || [];
    },
  });
  const toggle = useMutation({
    mutationFn: async (rule: { id: string; is_active: boolean }) => {
      if (!manage) throw new Error("Your role cannot manage alert rules.");
      const { data, error } = await client()
        .from("alert_rules")
        .update({ is_active: !rule.is_active })
        .eq("organization_id", org)
        .eq("id", rule.id)
        .select("id")
        .single();
      if (error || !data)
        throw new Error(
          "The rule could not be updated. Check your permissions and retry.",
        );
    },
    onSuccess: () => rules.refetch(),
  });
  const ids = new Set((assets.data || []).map((a) => a.id)),
    points = (operations.data?.points || []).filter(
      (p) =>
        ids.has(p.asset_id) &&
        `${p.point_name} ${p.sensor_name}`
          .toLowerCase()
          .includes(search.toLowerCase()),
    );
  return (
    <Screen title="Operational settings" back>
      <Chips
        values={["Measurement points", "Alert rules"]}
        value={section}
        onChange={setSection}
      />
      <Search
        value={search}
        onChange={setSearch}
        placeholder="Search configuration..."
      />
      {section === "Measurement points" ? (
        <>
          <State
            loading={operations.isLoading}
            error={operations.error}
            retry={() => operations.refetch()}
            empty={
              operations.isSuccess && !points.length
                ? "No measurement points in this plant. Existing sensor readings are available under Assets."
                : undefined
            }
          />
          {points.map((p) => (
            <View key={p.point_id} style={o.card}>
              <Text style={o.title}>{p.point_name}</Text>
              <Text style={o.text}>
                {assets.data?.find((a) => a.id === p.asset_id)?.name}
              </Text>
              <Text style={o.caption}>
                {p.sensor_name || "No sensor assigned"} ·{" "}
                {p.position || "Position not set"}
              </Text>
              <StatusTag label={p.status} status={p.status} />
              <Text style={o.caption}>
                {p.limit_set_name || "No limit set"}
                {p.graded
                  ? ` · A/B ${p.zone_ab} · B/C ${p.zone_bc} · C/D ${p.zone_cd} mm/s`
                  : " · Ungraded"}
              </Text>
              <Button
                title="Open machine and point history"
                secondary
                onPress={() => router.push(`/asset/${p.asset_id}`)}
              />
            </View>
          ))}
        </>
      ) : (
        <>
          <State
            loading={rules.isLoading}
            error={rules.error || toggle.error}
            retry={() => rules.refetch()}
            empty={
              rules.isSuccess && !rules.data?.length
                ? "No alert rules configured."
                : undefined
            }
          />
          {rules.data
            ?.filter(
              (r) =>
                (!site || !r.site_id || r.site_id === site) &&
                r.name.toLowerCase().includes(search.toLowerCase()),
            )
            .map((r) => (
              <View key={r.id} style={o.card}>
                <View style={o.between}>
                  <Text style={[o.title, { flex: 1 }]}>{r.name}</Text>
                  <StatusTag
                    label={r.is_active ? "Enabled" : "Disabled"}
                    status={r.is_active ? "good" : "no_data"}
                  />
                </View>
                <Text style={o.text}>{r.description || r.rule_type}</Text>
                <Text style={o.caption}>
                  {r.severity} ·{" "}
                  {assets.data?.find((a) => a.id === r.asset_id)?.name ||
                    "Workspace scope"}
                </Text>
                {manage && (
                  <Button
                    title={r.is_active ? "Disable rule" : "Enable rule"}
                    secondary
                    disabled={toggle.isPending}
                    onPress={() => toggle.mutate(r)}
                  />
                )}
              </View>
            ))}
        </>
      )}
      {manage && (
        <View style={o.card}>
          <Text style={o.title}>Advanced setup</Text>
          <Text style={o.caption}>
            Create points, install sensors and configure limit sets using the
            SaaS setup tools. Changes appear in the mobile workspace after
            refresh.
          </Text>
          <Button
            title="Open SaaS configuration"
            secondary
            onPress={() =>
              void Linking.openURL(
                `https://app.revuptime.com/#settings/${section === "Alert rules" ? "alert-rules" : "vibration-standards"}`,
              )
            }
          />
        </View>
      )}
    </Screen>
  );
}
