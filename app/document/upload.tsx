import { canEditMaintenance } from "../../utils/permissions";
import React, { useState, useEffect, useRef } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import {
  Screen,
  Card,
  Field,
  Select,
  Button,
  T,
  ErrorMessage,
  State,
} from "../../components/ui";
import { useAssets, useOrg, useDocuments } from "../../hooks/queries";
import { uploadDocument, UploadFile } from "../../services/documents";
import type { IndexProgress } from "../../types/knowledge";
import { useApp } from "../../providers/AppProvider";
export default function Upload() {
  const { profile } = useApp();
  const { assetId, replaceId } = useLocalSearchParams<{
      assetId?: string;
      replaceId?: string;
    }>(),
    documents = useDocuments(assetId || ""),
    assets = useAssets(true),
    org = useOrg(),
    qc = useQueryClient(),
    [asset, setAsset] = useState(assetId || ""),
    [title, setTitle] = useState(""),
    [type, setType] = useState("OEM Manual"),
    [manufacturer, setManufacturer] = useState(""),
    [model, setModel] = useState(""),
    [file, setFile] = useState<UploadFile | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>(),
    [progress, setProgress] = useState<IndexProgress>(),
    [savedId, setSavedId] = useState("");
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  const previous = documents.data?.find((d) => d.id === replaceId);
  useEffect(() => {
    if (previous) {
      setAsset(previous.asset_id || "");
      setTitle(previous.title);
      setType(previous.type);
    }
  }, [previous?.id]);
  async function pick() {
    try {
      const r = await DocumentPicker.getDocumentAsync({
        type: "*/*",
        copyToCacheDirectory: true,
      });
      if (!r.canceled) {
        setFile(r.assets[0]);
        if (!title) setTitle(r.assets[0].name);
      }
    } catch (e) {
      setError(e);
    }
  }
  async function image(camera: boolean) {
    try {
      const p = camera
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!p.granted) throw new Error("Permission required to attach a photo.");
      const r = camera
        ? await ImagePicker.launchCameraAsync({ quality: 0.85 })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ["images"],
            quality: 0.85,
          });
      if (!r.canceled) {
        const a = r.assets[0];
        setFile({
          uri: a.uri,
          name: a.fileName || "nameplate.jpg",
          mimeType: a.mimeType || "image/jpeg",
          size: a.fileSize,
        });
        if (!title) setTitle("Machine nameplate");
      }
    } catch (e) {
      setError(e);
    }
  }
  async function submit() {
    if (
      (asset && !assets.data?.some((a) => a.id === asset)) ||
      !title.trim() ||
      !file ||
      (replaceId && !previous)
    ) {
      setError(new Error("Select an asset, title, and file."));
      return;
    }
    setError(null);
    setBusy(true);
    controller.current = new AbortController();
    try {
      const saved = await uploadDocument(
        org,
        {
          asset_id: asset,
          title: title.trim(),
          type,
          manufacturer,
          model,
          version: "1",
        },
        file,
        {
          previous,
          siteId: assets.data?.find((a) => a.id === asset)?.site_id,
          onProgress: setProgress,
          signal: controller.current.signal,
        },
      );
      setSavedId(saved.id);
      qc.invalidateQueries({ queryKey: ["documents", org, asset] });
      qc.invalidateQueries({ queryKey: ["documents", org, ""] });
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  if (assets.isLoading || assets.error || !canEditMaintenance(profile))
    return (
      <Screen title="Upload Document" back>
        <State
          loading={assets.isLoading}
          error={assets.error}
          retry={() => assets.refetch()}
          empty="Your account has read-only access."
        />
      </Screen>
    );
  return (
    <Screen title="Upload Document" back>
      <State
        loading={assets.isLoading}
        error={assets.error}
        retry={() => assets.refetch()}
      />
      <Card style={{ gap: 18 }}>
        <Select
          label="Asset"
          value={asset}
          options={[
            { label: "Workspace document (all machines)", value: "" },
            ...(assets.data || []).map((a) => ({
              label: a.name,
              value: a.id,
            })),
          ]}
          onChange={(v) => {
            if (!replaceId && !busy) setAsset(v);
          }}
        />
        <Select
          label="Document Type"
          value={type}
          options={[
            "OEM Manual",
            "Datasheet",
            "SOP",
            "Maintenance Manual",
            "Drawing",
            "Nameplate",
            "Inspection Report",
            "Failure Report",
            "Other",
          ].map((v) => ({ label: v, value: v }))}
          onChange={setType}
        />
        <Field label="Title" value={title} onChange={setTitle} />
        <Field
          label="Manufacturer"
          value={manufacturer}
          onChange={setManufacturer}
        />
        <Field label="Model" value={model} onChange={setModel} />
        <T muted>
          {replaceId
            ? `Replacing version ${previous?.version || "…"}. Document identity is preserved and the version increases automatically.`
            : "New documents start at version 1."}
        </T>
        <Button
          title="Select document"
          icon="file-plus"
          secondary
          onPress={pick}
        />
        <Button
          title="Upload photo"
          icon="image"
          secondary
          onPress={() => image(false)}
        />
        <Button
          title="Scan nameplate / Take photo"
          icon="camera"
          secondary
          onPress={() => image(true)}
        />
        {file && (
          <T>
            {file.name} · {((file.size || 0) / 1024).toFixed(0)} KB
          </T>
        )}
        <T muted style={{ fontSize: 11 }}>
          Maximum 15 MB. PDF, DOCX, TXT, Markdown, CSV, TSV, JSON and log files.
          Scanned documents require OCR before indexing. Keyword lookup does not
          need AI credentials.
        </T>
        {!!progress && (
          <T>
            {progress.message}
            {progress.remaining !== undefined
              ? ` · ${progress.remaining} vectors remaining`
              : ""}
          </T>
        )}
        {!!savedId && (
          <Button
            title="Open saved document"
            onPress={() =>
              router.replace(`/document/${savedId}?assetId=${asset}`)
            }
          />
        )}
        {busy && (
          <Button
            title="Pause indexing"
            secondary
            onPress={() => controller.current?.abort()}
          />
        )}
        <ErrorMessage error={error} />
        <Button
          title={
            busy
              ? "Saving and indexing…"
              : replaceId
                ? "Replace Document"
                : "Upload Document"
          }
          disabled={!!savedId || busy}
          loading={busy}
          onPress={submit}
        />
      </Card>
    </Screen>
  );
}
