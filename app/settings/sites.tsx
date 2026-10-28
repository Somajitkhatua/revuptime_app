import { canEditMaintenance } from "../../utils/permissions";
import React from "react";
import { router } from "expo-router";
import { Screen, Card, T, Button, State } from "../../components/ui";
import { useSites } from "../../hooks/queries";
import { useApp } from "../../providers/AppProvider";
export default function Sites() {
  const sites = useSites(),
    { profile, site, setSite } = useApp();
  return (
    <Screen title="Sites" back>
      <T muted>Select the plant used for your dashboard and machine list.</T>
      <State
        loading={sites.isLoading}
        error={sites.error}
        retry={() => sites.refetch()}
        empty={
          !sites.isLoading && !sites.error && !sites.data?.length
            ? "No plants added yet."
            : undefined
        }
      />
      {sites.data?.map((plant) => (
        <Card key={plant.id} style={{ gap: 10 }}>
          <T style={{ fontSize: 18, fontWeight: "700" }}>{plant.name}</T>
          <T muted>{plant.location || "Location not provided"}</T>
          <Button
            title={site === plant.id ? "Selected plant" : "Select plant"}
            secondary={site !== plant.id}
            onPress={() => setSite(plant.id)}
          />
        </Card>
      ))}
      {canEditMaintenance(profile) && (
        <Button
          title="Add plant"
          icon="plus"
          onPress={() => router.push("/site/create")}
        />
      )}
    </Screen>
  );
}
