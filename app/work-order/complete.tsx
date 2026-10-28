import { canEditMaintenance } from "../../utils/permissions";
import React, { useState } from "react";
import { View, Image } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import {
  Screen,
  Card,
  Field,
  Button,
  ErrorMessage,
  T,
  State,
} from "../../components/ui";
import { useActions, useOrg, useWorkOrders } from "../../hooks/queries";
import { uploadFile } from "../../services/documents";
import { useApp } from "../../providers/AppProvider";
import { nonNegativeNumber } from "../../utils/validation";
export default function Complete() {
  const { profile } = useApp();
  const { id } = useLocalSearchParams<{ id: string }>(),
    org = useOrg(),
    orders = useWorkOrders(),
    w = orders.data?.find((x) => x.id === id),
    actions = useActions(),
    [root, setRoot] = useState(""),
    [action, setAction] = useState(""),
    [parts, setParts] = useState("None"),
    [downtime, setDowntime] = useState(""),
    [vibration, setVibration] = useState(""),
    [notes, setNotes] = useState(""),
    [photos, setPhotos] = useState<ImagePicker.ImagePickerAsset[]>([]),
    [error, setError] = useState<unknown>(),
    [uploading, setUploading] = useState(false);
  async function photo() {
    try {
      const p = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!p.granted) throw new Error("Photo permission is required.");
      const r = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 0.8,
      });
      if (!r.canceled) setPhotos((s) => [...s, ...r.assets]);
    } catch (e) {
      setError(e);
    }
  }
  async function submit() {
    setError(null);
    if (
      !w ||
      !canEditMaintenance(profile) ||
      w.status === "Completed" ||
      w.tasks.some((t) => !t.completed)
    ) {
      setError(
        new Error(
          "Complete every checklist task before closing an editable work order.",
        ),
      );
      return;
    }
    if (
      !root.trim() ||
      !action.trim() ||
      !nonNegativeNumber(downtime) ||
      !nonNegativeNumber(vibration)
    ) {
      setError(
        new Error(
          "Enter root cause, action taken, and valid non-negative downtime and vibration.",
        ),
      );
      return;
    }
    setUploading(true);
    try {
      const uploaded = [];
      for (const p of photos)
        uploaded.push(
          await uploadFile(
            org,
            w.asset_id,
            {
              uri: p.uri,
              name: p.fileName || "maintenance.jpg",
              mimeType: p.mimeType || "image/jpeg",
              size: p.fileSize,
            },
            "work-order-photos",
          ),
        );
      await actions.complete.mutateAsync({
        id,
        result: {
          root_cause: root.trim(),
          action_taken: action.trim(),
          parts_replaced: parts,
          downtime_minutes: Number(downtime),
          final_vibration: Number(vibration),
          notes,
          photos: uploaded,
        },
      });
      router.replace(`/work-order/${id}`);
    } catch (e) {
      setError(e);
    } finally {
      setUploading(false);
    }
  }
  if (
    orders.isLoading ||
    orders.error ||
    !w ||
    !canEditMaintenance(profile) ||
    w.status === "Completed"
  )
    return (
      <Screen title="Complete Work Order" back>
        <State
          loading={orders.isLoading}
          error={orders.error}
          retry={() => orders.refetch()}
          empty={
            !canEditMaintenance(profile)
              ? "Your account has read-only access."
              : w?.status === "Completed"
                ? "This work order is already completed."
                : "Work order not found."
          }
        />
      </Screen>
    );
  return (
    <Screen title="Complete Work Order" back>
      <Card style={{ gap: 11 }}>
        <T muted style={{ fontSize: 11 }}>
          Record the repair outcome for {w?.number || "this work order"}.
        </T>
        <Field
          label="Root Cause"
          value={root}
          onChange={setRoot}
          placeholder="e.g. Bearing lubrication issue"
        />
        <Field
          label="Action Taken"
          value={action}
          onChange={setAction}
          placeholder="Describe the repair"
          multiline
        />
        <Field label="Parts Replaced" value={parts} onChange={setParts} />
        <View style={{ flexDirection: "row", gap: 12 }}>
          <View style={{ flex: 1 }}>
            <Field
              label="Downtime (Minutes)"
              value={downtime}
              onChange={setDowntime}
              numeric
            />
          </View>
          <View style={{ flex: 1 }}>
            <Field
              label="Final Vibration (mm/s)"
              value={vibration}
              onChange={setVibration}
              numeric
            />
          </View>
        </View>
        <Field label="Notes" value={notes} onChange={setNotes} multiline />
        <Button
          title="Add completion photos"
          secondary
          icon="camera"
          onPress={photo}
        />
        {photos.map((p, i) => (
          <Image
            key={i}
            source={{ uri: p.uri }}
            style={{ height: 160, borderRadius: 10, width: "100%" }}
          />
        ))}
        <ErrorMessage error={error || actions.complete.error} />
        <Button
          title="Complete Work Order"
          style={{ backgroundColor: "#00A55B" }}
          onPress={submit}
          loading={uploading || actions.complete.isPending}
        />
      </Card>
    </Screen>
  );
}
