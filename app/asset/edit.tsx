import { canEditMaintenance } from "../../utils/permissions";
import React, { useEffect, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  Screen,
  Card,
  Field,
  Select,
  Button,
  State,
  ErrorMessage,
  T,
} from "../../components/ui";
import { useAsset, useSites } from "../../hooks/queries";
import { useApp } from "../../providers/AppProvider";
import { AssetInput, saveAsset } from "../../services/assets";
export default function EditAsset() {
  const { id } = useLocalSearchParams<{ id?: string }>(),
    { profile, site } = useApp(),
    sites = useSites(),
    asset = useAsset(id || ""),
    qc = useQueryClient();
  const [input, setInput] = useState<AssetInput>({
    name: "",
    site_id: site,
    type: "Motor",
    description: "",
    manufacturer: "",
    model: "",
    serial_number: "",
    location: "",
    installed_at: "",
    installed_time: "",
  });
  const [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>();
  useEffect(() => {
    if (asset.data) {
      const date = asset.data.installation_datetime
        ? new Date(asset.data.installation_datetime)
        : null;
      const pad = (n: number) => String(n).padStart(2, "0");
      const values = Object.fromEntries(
        Object.keys(input).map((k) => [k, (asset.data as any)[k] || ""]),
      ) as AssetInput;
      if (date) {
        values.installed_at = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
        values.installed_time = `${pad(date.getHours())}:${pad(date.getMinutes())}`;
      }
      setInput(values);
    }
  }, [asset.data]);
  useEffect(() => {
    if (!id && !input.site_id && sites.data?.length)
      setInput((v) => ({ ...v, site_id: sites.data![0].id }));
  }, [sites.data]);
  const change = (key: keyof AssetInput, value: string) =>
    setInput((v) => ({ ...v, [key]: value }));
  async function submit() {
    if (!profile || !canEditMaintenance(profile) || busy) return;
    setBusy(true);
    setError(null);
    try {
      const saved = await saveAsset(profile.organization_id, input, id);
      await qc.invalidateQueries({
        queryKey: ["assets", profile.organization_id],
      });
      await qc.invalidateQueries({
        queryKey: ["asset", profile.organization_id, saved.id],
      });
      router.replace(`/asset/${saved.id}`);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Screen title={id ? "Edit machine" : "Add machine"} back>
      <State
        loading={sites.isLoading || (!!id && asset.isLoading)}
        error={sites.error || asset.error}
        retry={() => {
          sites.refetch();
          if (id) asset.refetch();
        }}
      />
      {!canEditMaintenance(profile) ? (
        <T>Your account has read-only access.</T>
      ) : (
        !sites.isLoading &&
        !sites.error &&
        (!id || !!asset.data) && (
          <Card style={{ gap: 16 }}>
            <Field
              label="Machine name"
              value={input.name}
              onChange={(v) => change("name", v)}
            />
            <Select
              label="Plant"
              value={input.site_id}
              options={(sites.data || []).map((s) => ({
                label: s.name,
                value: s.id,
              }))}
              onChange={(v) => change("site_id", v)}
            />
            <Button
              title="Add plant"
              secondary
              onPress={() => router.push("/site/create")}
            />
            <Select
              label="Machine type"
              value={input.type}
              options={["Motor", "Pump", "Fan", "Gearbox", "Other"].map(
                (v) => ({ label: v, value: v }),
              )}
              onChange={(v) => change("type", v)}
            />
            {(
              [
                ["description", "Description"],
                ["manufacturer", "Manufacturer"],
                ["model", "Model"],
                ["serial_number", "Serial number"],
                ["location", "Machine location"],
                ["installed_at", "Installation date (YYYY-MM-DD)"],
                ["installed_time", "Installation time (HH:mm)"],
              ] as [keyof AssetInput, string][]
            ).map(([key, label]) => (
              <Field
                key={key}
                label={label}
                value={input[key]}
                onChange={(v) => change(key, v)}
              />
            ))}
            <T muted>
              Installation time uses this device's time zone. Leave the time
              blank if it is unknown.
            </T>
            <T muted>
              Sensor readings and health assessments appear when telemetry is
              connected.
            </T>
            <ErrorMessage error={error} />
            <Button title="Save machine" loading={busy} onPress={submit} />
          </Card>
        )
      )}
    </Screen>
  );
}
