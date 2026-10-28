import { canEditMaintenance } from "../../utils/permissions";
import React, { useState, useRef, useEffect } from "react";
import { Linking } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import {
  Screen,
  Card,
  T,
  Badge,
  Button,
  State,
  ErrorMessage,
} from "../../components/ui";
import { useDocuments } from "../../hooks/queries";
import { documentUrl, retryDocument } from "../../services/documents";
import { isDemo } from "../../services/supabase";
import { useApp } from "../../providers/AppProvider";
import { indexKnowledgeDocument } from "../../services/knowledge";
import type { IndexProgress } from "../../types/knowledge";
import { isCanonical } from "../../services/supabase";
export default function Document() {
  const { profile } = useApp();
  const { id, assetId } = useLocalSearchParams<{
      id: string;
      assetId: string;
    }>(),
    q = useDocuments(assetId || ""),
    doc = q.data?.find((d) => d.id === id),
    [error, setError] = useState<unknown>(),
    [processing, setProcessing] = useState(false),
    [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<IndexProgress>();
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  async function index(vectorsOnly: boolean) {
    if (!doc || processing) return;
    setError(null);
    setProcessing(true);
    controller.current = new AbortController();
    try {
      await indexKnowledgeDocument(
        doc.organization_id,
        doc.id,
        vectorsOnly,
        setProgress,
        controller.current.signal,
      );
    } catch (e) {
      setError(e);
    } finally {
      setProcessing(false);
      await q.refetch();
    }
  }
  const stalled =
    !!doc?.processing_started_at &&
    Date.now() - Date.parse(doc.processing_started_at) > 5 * 60000;
  async function open() {
    setBusy(true);
    setError(null);
    try {
      if (doc) await Linking.openURL(await documentUrl(doc));
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Screen title="Document Detail" back>
      <State
        loading={q.isLoading}
        error={q.error}
        retry={() => q.refetch()}
        empty={!q.isLoading && !doc ? "Document not found." : undefined}
      />
      {doc && (
        <Card style={{ gap: 18 }}>
          <T style={{ fontSize: 22, fontWeight: "700" }}>{doc.title}</T>
          {!!doc.filename && doc.filename !== doc.title && (
            <T muted>{doc.filename}</T>
          )}
          <Badge value={doc.status} />
          <T muted>
            {doc.type} · {doc.file_type} · {doc.pages || "Unknown"} pages
          </T>
          <T>Manufacturer: {doc.manufacturer || "—"}</T>
          <T>Model: {doc.model || "—"}</T>
          <T>Version: {doc.version}</T>
          <T muted>
            Scanned PDFs and images require OCR. Indexed text is searchable
            without AI credentials; summaries and vectors require server
            configuration and organization sharing permission.
          </T>
          {!isDemo &&
            isCanonical &&
            doc.storage_bucket !== "revuptime-documents" && (
              <T muted>
                This file uses the earlier storage bucket. Replace it with the
                same file to enable workspace indexing and private PDF page
                previews.
              </T>
            )}
          {!!doc.metadata?.index_status && (
            <T>
              Text indexing: {doc.metadata.index_status} ·{" "}
              {doc.metadata.chunks || 0} chunks · Vectors:{" "}
              {doc.metadata.embedding_status || "not configured"}
            </T>
          )}
          {!!progress && (
            <T>
              {progress.message}
              {progress.remaining !== undefined
                ? ` · ${progress.remaining} vectors remaining`
                : ""}
            </T>
          )}
          {!isDemo && isCanonical && canEditMaintenance(profile) && (
            <>
              <Button
                title="Index document"
                secondary
                disabled={processing}
                onPress={() => void index(false)}
              />
              <Button
                title="Resume vectors"
                secondary
                disabled={processing}
                onPress={() => void index(true)}
              />
              <Button
                title="Replace document"
                secondary
                disabled={processing}
                onPress={() =>
                  router.push(
                    `/document/upload?assetId=${doc.asset_id || ""}&replaceId=${doc.id}`,
                  )
                }
              />
              {processing && (
                <Button
                  title="Pause indexing"
                  secondary
                  onPress={() => controller.current?.abort()}
                />
              )}
            </>
          )}
          <T muted style={{ fontSize: 12 }}>
            Processing: Uploading → Extracting text → Ready for AI. Searchable
            passages include references to their original pages.
          </T>
          {isDemo && (
            <T muted style={{ fontSize: 12 }}>
              Sample documents contain illustrative metadata. Local uploads
              remain queued until a processing backend is connected.
            </T>
          )}
          <Button
            title="Open File"
            loading={busy}
            onPress={open}
            icon="external-link"
          />
          {doc.status === "Failed" && (
            <T muted>
              {doc.processing_error ||
                "Processing did not finish. The original file is still available."}
            </T>
          )}
          {["Queued", "Not indexed"].includes(doc.status) && !isDemo && (
            <T muted>
              Your file is saved but has not been indexed. An authorized user
              can tap Index document to make its text searchable.
            </T>
          )}
          {stalled && doc.status !== "Ready for AI" && (
            <T muted>
              Processing is taking longer than expected. You can retry safely.
            </T>
          )}
          {(doc.status === "Failed" || doc.status === "Queued" || stalled) &&
            doc.status !== "Ready for AI" &&
            !isDemo &&
            !isCanonical &&
            canEditMaintenance(profile) && (
              <Button
                title="Retry AI processing"
                secondary
                loading={processing}
                onPress={async () => {
                  setError(null);
                  setProcessing(true);
                  try {
                    await retryDocument(id);
                    await q.refetch();
                  } catch (e) {
                    setError(e);
                  } finally {
                    setProcessing(false);
                  }
                }}
              />
            )}
          <ErrorMessage error={error} />
        </Card>
      )}
    </Screen>
  );
}
