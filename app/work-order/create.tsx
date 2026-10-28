import { canEditMaintenance } from "../../utils/permissions";
import React, { useState, useEffect } from "react";
import { router, useLocalSearchParams } from "expo-router";
import {
  Screen,
  Card,
  Field,
  Select,
  Button,
  ErrorMessage,
  State,
  T,
} from "../../components/ui";
import { useAssets, useActions, useOrg } from "../../hooks/queries";
import { useQuery } from "@tanstack/react-query";
import { getTechnicians } from "../../services/organizations";
import { useApp } from "../../providers/AppProvider";
import { validDate } from "../../utils/validation";
export default function Create() {
  const { profile } = useApp();
  const params = useLocalSearchParams<{
      assetId?: string;
      alertId?: string;
      title?: string;
      description?: string;
      priority?: string;
    }>(),
    assets = useAssets(true),
    org = useOrg(),
    tech = useQuery({
      queryKey: ["technicians", org],
      queryFn: () => getTechnicians(org),
      enabled: !!org,
    }),
    actions = useActions(),
    [asset, setAsset] = useState(params.assetId || ""),
    [title, setTitle] = useState(params.title || ""),
    [priority, setPriority] = useState(
      ["High", "Medium", "Low"].includes(params.priority || "")
        ? params.priority!
        : "High",
    ),
    [assignee, setAssignee] = useState(""),
    [due, setDue] = useState(new Date().toISOString().slice(0, 10)),
    [notes, setNotes] = useState(params.description || ""),
    [error, setError] = useState<unknown>();
  useEffect(() => {
    if (!asset && assets.data?.length) setAsset(assets.data[0].id);
  }, [assets.data]);
  function submit() {
    if (
      !title.trim() ||
      !assets.data?.some((a) => a.id === asset) ||
      !validDate(due)
    ) {
      setError(
        new Error("Select an asset, enter a title and a valid due date."),
      );
      return;
    }
    actions.create.mutate(
      {
        asset_id: asset,
        title: title.trim(),
        priority: priority as "High" | "Medium" | "Low",
        assigned_to: assignee || null,
        due_date: due,
        notes,
        alert_id: params.alertId,
      },
      { onSuccess: (w) => router.replace(`/work-order/${w.id}`) },
    );
  }
  if (assets.isLoading || assets.error || !canEditMaintenance(profile))
    return (
      <Screen title="Create Work Order" back>
        <State
          loading={assets.isLoading}
          error={assets.error}
          retry={() => assets.refetch()}
          empty="Your account has read-only access."
        />
      </Screen>
    );
  return (
    <Screen title="Create Work Order" back>
      {!!params.description && (
        <T muted>
          Review and edit this AI draft. Nothing is saved until you tap Create
          Work Order.
        </T>
      )}
      <State
        loading={assets.isLoading}
        error={assets.error}
        retry={() => assets.refetch()}
      />
      <Card style={{ gap: 18 }}>
        <Select
          label="Asset"
          value={asset}
          options={(assets.data || []).map((a) => ({
            label: a.name,
            value: a.id,
          }))}
          onChange={setAsset}
        />
        <Field
          label="Title"
          value={title}
          onChange={setTitle}
          placeholder="Describe the maintenance task"
        />
        <Select
          label="Priority"
          value={priority}
          options={["High", "Medium", "Low"].map((v) => ({
            label: v,
            value: v,
          }))}
          onChange={setPriority}
        />
        <Select
          label="Assigned to"
          value={assignee}
          options={[
            { label: "Unassigned", value: "" },
            ...(tech.data || []).map((t) => ({ label: t.name, value: t.id })),
          ]}
          onChange={setAssignee}
        />
        <ErrorMessage error={tech.error} />
        <Field label="Due date (YYYY-MM-DD)" value={due} onChange={setDue} />
        <Field label="Notes" value={notes} onChange={setNotes} multiline />
        <ErrorMessage error={error || actions.create.error} />
        <Button
          title="Create Work Order"
          loading={actions.create.isPending}
          onPress={submit}
        />
      </Card>
    </Screen>
  );
}
