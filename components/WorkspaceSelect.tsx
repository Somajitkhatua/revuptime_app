import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useApp } from "../providers/AppProvider";
import { client, isDemo } from "../services/supabase";
import { getMyWorkspaces } from "../services/workspaces";
import { Button, ErrorMessage, Select, T } from "./ui";

export default function WorkspaceSelect({
  disabled = false,
  onChanged,
}: {
  disabled?: boolean;
  onChanged?: () => void;
}) {
  const { profile, selectWorkspace } = useApp();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>();
  const query = useQuery({
    queryKey: ["myWorkspaces", profile?.id],
    queryFn: () => getMyWorkspaces(client(), profile!.id),
    enabled: !isDemo && !!profile,
  });
  if (isDemo || !profile) return null;
  const options = (query.data || []).map((w) => ({
    label: w.name,
    value: w.id,
  }));
  if (!options.some((o) => o.value === profile.organization_id))
    options.unshift({
      label: profile.organization_name || "Current workspace",
      value: profile.organization_id,
    });
  async function choose(id: string) {
    if (disabled || busy || id === profile?.organization_id) return;
    setBusy(true);
    setError(null);
    try {
      await selectWorkspace(id);
      onChanged?.();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Select
        label="Workspace"
        value={profile.organization_id}
        options={options}
        onChange={(id) => void choose(id)}
      />
      {busy && <T muted>Switching workspace…</T>}
      <ErrorMessage error={error || query.error} />
      {!!query.error && (
        <Button
          title="Reload workspaces"
          secondary
          onPress={() => void query.refetch()}
        />
      )}
    </>
  );
}
