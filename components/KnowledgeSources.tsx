import React, { useEffect, useState } from "react";
import { Image, Modal, ScrollView, View } from "react-native";
import { Button, Card, ErrorMessage, T } from "./ui";
import type { KnowledgeSource } from "../types/knowledge";
import { knowledgeRequest } from "../services/knowledge";

function PdfPage({ source, org }: { source: KnowledgeSource; org: string }) {
  const [requested, setRequested] = useState(!!source.preview_recommended);
  const [image, setImage] = useState("");
  const [error, setError] = useState<unknown>();
  const [busy, setBusy] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [open, setOpen] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!requested) return;
    const controller = new AbortController();
    setBusy(true);
    setError(null);
    setImage("");
    knowledgeRequest<{ image: string }>(
      "documents/page",
      {
        organization_id: org,
        document_id: source.id,
        page_number: source.page_number,
        source_path: source.source_path,
      },
      controller.signal,
    )
      .then((result) => {
        if (!controller.signal.aborted) setImage(result.image);
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e);
      })
      .finally(() => {
        if (!controller.signal.aborted) setBusy(false);
      });
    return () => controller.abort();
  }, [
    requested,
    org,
    source.id,
    source.source_path,
    source.page_number,
    attempt,
  ]);
  return (
    <View style={{ gap: 8 }}>
      {!requested && (
        <Button
          title={`View cited PDF page ${source.page_number}`}
          secondary
          onPress={() => setRequested(true)}
        />
      )}
      {busy && <T>Loading cited PDF page…</T>}
      <ErrorMessage error={error} />
      {!!error && (
        <Button
          title="Retry page preview"
          secondary
          onPress={() => setAttempt((n) => n + 1)}
        />
      )}
      {!!image && (
        <>
          <Image
            source={{ uri: image }}
            accessibilityLabel={`Original PDF page ${source.page_number}`}
            resizeMode="contain"
            style={{ width: "100%", height: 320, backgroundColor: "#fff" }}
          />
          <Button
            title="Zoom drawing"
            secondary
            onPress={() => {
              setZoom(1);
              setOpen(true);
            }}
          />
          <Modal
            visible={open}
            onRequestClose={() => setOpen(false)}
            animationType="slide"
          >
            <View
              style={{
                flex: 1,
                paddingTop: 50,
                paddingBottom: 30,
                backgroundColor: "white",
              }}
            >
              <View
                style={{ flexDirection: "row", justifyContent: "space-around" }}
              >
                <Button
                  title="Close preview"
                  secondary
                  onPress={() => setOpen(false)}
                />
                <Button
                  title="−"
                  secondary
                  onPress={() => setZoom((v) => Math.max(1, v - 0.5))}
                />
                <Button
                  title="+"
                  secondary
                  onPress={() => setZoom((v) => Math.min(5, v + 0.5))}
                />
              </View>
              <T style={{ textAlign: "center" }}>
                Page {source.page_number} · {zoom * 100}% · Use +/− to zoom and
                scroll to pan
              </T>
              <ScrollView
                maximumZoomScale={5}
                minimumZoomScale={1}
                centerContent
              >
                <ScrollView horizontal>
                  <Image
                    source={{ uri: image }}
                    resizeMode="contain"
                    style={{ width: 390 * zoom, height: 650 * zoom }}
                  />
                </ScrollView>
              </ScrollView>
            </View>
          </Modal>
        </>
      )}
    </View>
  );
}
function Source({ source, org }: { source: KnowledgeSource; org: string }) {
  const [expanded, setExpanded] = useState(!!source.preview_recommended);
  return (
    <Card style={{ gap: 8 }}>
      <Button
        title={`${expanded ? "▾" : "▸"} [${source.source_id || "Source"}] ${source.label}`}
        secondary
        onPress={() => setExpanded((v) => !v)}
      />
      {expanded && (
        <>
          <T>{source.location || source.table.replace(/_/g, " ")}</T>
          <T muted>
            Record: {source.id}
            {source.version ? ` · Version ${source.version}` : ""}
            {source.page_number ? ` · Page ${source.page_number}` : ""}
            {source.chunk_id ? ` · Chunk ${source.chunk_id}` : ""}
          </T>
          {!!source.recorded_at && <T>Recorded: {source.recorded_at}</T>}
          {!!source.excerpt && <T>{source.excerpt}</T>}
          {source.table === "asset_documents" &&
            !!source.page_number &&
            (source.mime_type === "application/pdf" ||
              /\.pdf/i.test(source.label)) && (
              <PdfPage source={source} org={org} />
            )}
          <T muted>
            Source snapshot from this answer. If the file has been replaced, ask
            again for its current version.
          </T>
        </>
      )}
    </Card>
  );
}
export default function KnowledgeSources({
  sources,
  org,
}: {
  sources: KnowledgeSource[];
  org: string;
}) {
  if (!sources.length) return null;
  return (
    <View style={{ gap: 10 }}>
      <T style={{ fontWeight: "700" }}>Sources</T>
      {sources.map((source, i) => (
        <Source
          key={`${source.source_id}:${source.chunk_id || source.id}:${i}`}
          source={source}
          org={org}
        />
      ))}
    </View>
  );
}
