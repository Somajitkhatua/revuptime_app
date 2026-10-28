import React from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Screen, Card, T, Badge, State, Button } from "../../components/ui";
import { useOrg, useSites, useAssets } from "../../hooks/queries";
import { useApp } from "../../providers/AppProvider";
import { getOrganization, getTeamMembers } from "../../services/organizations";
import WorkspaceSelect from "../../components/WorkspaceSelect";
export default function Organization() {
  const org = useOrg(),
    { profile } = useApp();
  const organization = useQuery({
    queryKey: ["organization", org],
    queryFn: () => getOrganization(org),
    enabled: !!org,
  });
  const sites = useSites(),
    assets = useAssets(true);
  const team = useQuery({
    queryKey: ["team", org],
    queryFn: () => getTeamMembers(org),
    enabled: !!org,
  });
  return (
    <Screen title="Organization" back>
      <WorkspaceSelect />
      <State
        loading={organization.isLoading}
        error={organization.error}
        retry={() => organization.refetch()}
      />
      {organization.data && (
        <Card style={{ gap: 16, backgroundColor: "#002B4D", padding: 24 }}>
          <View
            style={{
              width: 62,
              height: 62,
              borderRadius: 18,
              backgroundColor: "#0E4876",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <T style={{ fontSize: 24, fontWeight: "800", color: "white" }}>
              {organization.data.name
                ?.split(/\s+/)
                .map((n: string) => n[0])
                .join("")
                .slice(0, 2)
                .toUpperCase()}
            </T>
          </View>
          <T style={{ fontSize: 24, fontWeight: "800", color: "white" }}>
            {organization.data.name}
          </T>
          <T style={{ color: "#BDD4E9" }}>Your maintenance workspace</T>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <View
              style={{
                backgroundColor: "#EAF4FF",
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 20,
              }}
            >
              <T style={{ color: "#0A3B63", fontWeight: "700", fontSize: 12 }}>
                {profile?.role || "Viewer"}
              </T>
            </View>
            <View
              style={{
                backgroundColor: "#DDF6E8",
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 20,
              }}
            >
              <T style={{ color: "#087848", fontWeight: "700", fontSize: 12 }}>
                {organization.data.status || "Active"}
              </T>
            </View>
          </View>
        </Card>
      )}
      <View style={{ flexDirection: "row", gap: 10 }}>
        {[
          ["Plants", sites.data?.length],
          ["Machines", assets.data?.length],
          ["Team members", team.data?.length],
        ].map(([label, count]) => (
          <View
            key={label}
            style={{
              flex: 1,
              backgroundColor: "white",
              borderRadius: 14,
              padding: 12,
              gap: 6,
              borderWidth: 1,
              borderColor: "#E2EBF5",
            }}
          >
            <T style={{ fontSize: 24, fontWeight: "800", color: "#0085FF" }}>
              {count ?? "—"}
            </T>
            <T muted style={{ fontSize: 11 }}>
              {label}
            </T>
          </View>
        ))}
      </View>
      <State
        error={sites.error || assets.error}
        retry={() => {
          sites.refetch();
          assets.refetch();
        }}
      />
      <Card style={{ gap: 14 }}>
        <T style={{ fontSize: 18, fontWeight: "700" }}>Your account</T>
        <T>{profile?.name}</T>
        <T muted>{profile?.email}</T>
        <T muted>Your role: {profile?.role}</T>
      </Card>
      <Card style={{ gap: 12 }}>
        <T style={{ fontSize: 18, fontWeight: "700" }}>Plants & machines</T>
        <T muted>
          Manage locations and explore the equipment in your workspace.
        </T>
        <Button
          title="Manage plants"
          secondary
          icon="map-pin"
          onPress={() => router.push("/settings/sites")}
        />
        <Button
          title="View machines"
          secondary
          icon="box"
          onPress={() => router.push("/(tabs)/assets")}
        />
      </Card>
      <Card style={{ gap: 16 }}>
        <T style={{ fontSize: 18, fontWeight: "700" }}>Team members</T>
        <State
          loading={team.isLoading}
          error={team.error}
          retry={() => team.refetch()}
        />
        {team.data?.map((member) => (
          <View
            key={member.id}
            style={{ flexDirection: "row", alignItems: "center", gap: 12 }}
          >
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: "#EAF4FF",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <T style={{ color: "#0085FF", fontWeight: "700" }}>
                {member.name.slice(0, 1).toUpperCase()}
              </T>
            </View>
            <View style={{ flex: 1, gap: 4 }}>
              <T style={{ fontWeight: "700" }}>{member.name}</T>
              <T muted>
                {member.id === profile?.id
                  ? `You · ${profile?.role}`
                  : member.role
                    ? member.role.charAt(0).toUpperCase() + member.role.slice(1)
                    : "Workspace member"}
              </T>
            </View>
          </View>
        ))}
        <T muted>
          Contact your workspace owner to add registered members or change
          access.
        </T>
      </Card>
    </Screen>
  );
}
