import { canEditMaintenance } from "../../utils/permissions";
import React, { useState } from "react";
import { router } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  Screen,
  Card,
  Field,
  Button,
  ErrorMessage,
  T,
} from "../../components/ui";
import { useApp } from "../../providers/AppProvider";
import { createSite } from "../../services/sites";
export default function CreateSite() {
  const { profile, setSite } = useApp(),
    qc = useQueryClient();
  const [name, setName] = useState(""),
    [location, setLocation] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>();
  async function submit() {
    if (!profile || !canEditMaintenance(profile) || busy) return;
    setBusy(true);
    setError(null);
    try {
      const site = await createSite(profile.organization_id, name, location);
      await qc.invalidateQueries({
        queryKey: ["sites", profile.organization_id],
      });
      setSite(site.id);
      router.back();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Screen title="Add plant" back>
      <Card style={{ gap: 16 }}>
        {!canEditMaintenance(profile) ? (
          <T>Your account has read-only access.</T>
        ) : (
          <>
            <Field label="Plant name" value={name} onChange={setName} />
            <Field
              label="Location / city"
              value={location}
              onChange={setLocation}
            />
            <ErrorMessage error={error} />
            <Button title="Save plant" loading={busy} onPress={submit} />
          </>
        )}
      </Card>
    </Screen>
  );
}
