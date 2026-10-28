import React, { useEffect, useRef, useState } from "react";
import { TextInput, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useLocalSearchParams } from "expo-router";
import {
  Screen,
  Card,
  T,
  Select,
  Button,
  ErrorMessage,
  State,
} from "../../components/ui";
import MarkdownText from "../../components/MarkdownText";
import KnowledgeSources from "../../components/KnowledgeSources";
import { useAssets, useSites, useDocuments } from "../../hooks/queries";
import WorkspaceSelect from "../../components/WorkspaceSelect";
import { useApp } from "../../providers/AppProvider";
import { askKnowledge } from "../../services/knowledge";
import { conversationKey } from "../../utils/knowledge";
import { uuid } from "../../services/demo";
import { isDemo } from "../../services/supabase";
import type {
  AnswerMode,
  KnowledgeConversation,
  KnowledgeMessage,
} from "../../types/knowledge";

export default function AI() {
  const { profile } = useApp();
  const params = useLocalSearchParams<{ assetId?: string }>();
  const assets = useAssets(true),
    sites = useSites(),
    documents = useDocuments("");
  const [mode, setMode] = useState<AnswerMode>("workspace");
  const [site, setSite] = useState("");
  const [asset, setAsset] = useState(params.assetId || "");
  const [question, setQuestion] = useState("");
  const [conversations, setConversations] = useState<KnowledgeConversation[]>(
    [],
  );
  const [active, setActive] = useState("");
  const [loadedKey, setLoadedKey] = useState("");
  const [error, setError] = useState<unknown>();
  const [busy, setBusy] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const generation = useRef(0);
  const storageQueue = useRef<Promise<unknown>>(Promise.resolve());
  const previousOrganization = useRef(profile?.organization_id);
  useEffect(() => {
    if (
      previousOrganization.current &&
      previousOrganization.current !== profile?.organization_id
    ) {
      controller.current?.abort();
      setAsset("");
      setSite("");
      setActive("");
    }
    previousOrganization.current = profile?.organization_id;
  }, [profile?.organization_id]);
  const key = profile
    ? conversationKey(profile.id, profile.organization_id, mode)
    : "";
  const current =
    loadedKey === key ? conversations.find((c) => c.id === active) : undefined;
  const messages = current?.messages || [];
  useEffect(() => {
    const mine = ++generation.current;
    controller.current?.abort();
    setBusy(false);
    setConversations([]);
    setActive("");
    setError(null);
    setLoadedKey("");
    if (!key) return;
    setHistoryLoading(true);
    AsyncStorage.getItem(key)
      .then((raw) => {
        if (mine !== generation.current) return;
        const stored = raw ? JSON.parse(raw) : [];
        setConversations(Array.isArray(stored) ? stored : []);
        setLoadedKey(key);
      })
      .catch(() => {
        if (mine === generation.current)
          setError(
            new Error(
              "Saved conversations could not be loaded. Retry by reopening this screen.",
            ),
          );
      })
      .finally(() => {
        if (mine === generation.current) setHistoryLoading(false);
      });
    return () => {
      ++generation.current;
      controller.current?.abort();
    };
  }, [key]);
  useEffect(() => {
    if (params.assetId) {
      controller.current?.abort();
      setAsset(params.assetId);
      setSite("");
      setActive("");
    }
  }, [params.assetId]);
  function persist(next: KnowledgeConversation[]) {
    setConversations(next);
    const target = key;
    storageQueue.current = storageQueue.current
      .catch(() => {})
      .then(() => AsyncStorage.setItem(target, JSON.stringify(next)))
      .catch(() => {
        if (target === key)
          setError(
            new Error(
              "The answer is shown, but history could not be saved on this device.",
            ),
          );
      });
  }
  async function send() {
    if (busy || !profile || loadedKey !== key) return;
    const q = question.trim();
    if (!q) return;
    if (isDemo) {
      setError(
        new Error(
          "Sign in to a connected workspace for document lookup. Demo answers are available in Maintenance assistant.",
        ),
      );
      return;
    }
    const request = new AbortController();
    controller.current = request;
    const mine = generation.current;
    setBusy(true);
    setError(null);
    try {
      const answer = await askKnowledge(
        profile.organization_id,
        q,
        mode,
        messages,
        site,
        asset,
        request.signal,
      );
      if (mine !== generation.current || request.signal.aborted) return;
      const now = new Date().toISOString();
      const appended: KnowledgeMessage[] = [
        ...messages,
        { id: uuid(), role: "user", content: q, created_at: now },
        { ...answer, id: uuid(), role: "assistant", created_at: now },
      ];
      const conversation: KnowledgeConversation = {
        id: current?.id || uuid(),
        title: current?.title || q.slice(0, 70),
        mode,
        site_id: site,
        asset_id: asset,
        messages: appended,
      };
      persist([
        conversation,
        ...conversations.filter((c) => c.id !== conversation.id),
      ]);
      setActive(conversation.id);
      setQuestion("");
    } catch (e) {
      if (mine === generation.current) setError(e);
    } finally {
      if (mine === generation.current) setBusy(false);
    }
  }
  function newScope() {
    setActive("");
    setError(null);
  }
  return (
    <Screen
      title="RevUpTime AI"
      footer={
        <View style={{ padding: 12, backgroundColor: "white", gap: 8 }}>
          <TextInput
            accessibilityLabel="Ask a question"
            placeholder="Ask about workspace documents or machine data…"
            value={question}
            onChangeText={setQuestion}
            multiline
            maxLength={4000}
            editable={!busy}
            style={{
              borderWidth: 1,
              borderColor: "#CBD5E1",
              borderRadius: 10,
              padding: 12,
              minHeight: 48,
            }}
          />
          <Button
            title={busy ? "Asking…" : "Send question"}
            disabled={busy || !question.trim() || loadedKey !== key}
            onPress={() => void send()}
          />
          {busy && (
            <Button
              title="Cancel request"
              secondary
              onPress={() => controller.current?.abort()}
            />
          )}
        </View>
      }
    >
      <WorkspaceSelect disabled={busy} />
      <Select
        label="Answer from"
        value={mode}
        options={[
          { label: "Workspace documents and machine data", value: "workspace" },
          { label: "General AI", value: "general" },
        ]}
        onChange={(v) => {
          if (!busy) {
            setMode(v as AnswerMode);
            newScope();
          }
        }}
      />
      {mode === "workspace" ? (
        <>
          <T muted>
            Ask about your uploaded manuals and fresh machine records. Shared
            workspace documents are included. Scanned documents require OCR.
          </T>
          <T muted>
            {documents.isLoading
              ? "Loading document library…"
              : documents.error
                ? "Document library could not be loaded. Open Documents to retry."
                : `${documents.data?.length || 0} documents in this workspace`}
          </T>
          <Select
            label="Plant"
            value={site}
            options={[
              { label: "All plants", value: "" },
              ...(sites.data || []).map((s) => ({
                label: s.name,
                value: s.id,
              })),
            ]}
            onChange={(v) => {
              if (!busy) {
                setSite(v);
                setAsset("");
                newScope();
              }
            }}
          />
          <Select
            label="Machine"
            value={asset}
            options={[
              { label: "All machines and workspace documents", value: "" },
              ...(assets.data || [])
                .filter((a) => !site || a.site_id === site)
                .map((a) => ({ label: a.name, value: a.id })),
            ]}
            onChange={(v) => {
              if (!busy) {
                setAsset(v);
                newScope();
              }
            }}
          />
          <Button
            title="View workspace documents"
            secondary
            onPress={() => router.push("/asset/documents")}
          />
        </>
      ) : (
        <T muted>
          General AI answers general questions. To use uploaded documents or
          machine readings, choose Workspace documents and machine data.
        </T>
      )}
      <Button
        title="New conversation"
        secondary
        disabled={busy}
        onPress={newScope}
      />
      {loadedKey === key && !!conversations.length && (
        <Select
          label="Chat history"
          value={active}
          options={[
            { label: "New conversation", value: "" },
            ...conversations.map((c) => ({ label: c.title, value: c.id })),
          ]}
          onChange={(id) => {
            if (busy) return;
            setActive(id);
            const c = conversations.find((c) => c.id === id);
            if (c) {
              setSite(c.site_id);
              setAsset(c.asset_id);
            }
            setError(null);
          }}
        />
      )}
      <T muted>
        Conversations stay separate for each workspace and answer mode.
      </T>
      <State loading={historyLoading} />
      <ErrorMessage error={assets.error || sites.error} />
      {messages.map((message) => (
        <Card key={message.id} style={{ gap: 12 }}>
          <T style={{ fontWeight: "700" }}>
            {message.role === "user"
              ? "You"
              : message.response_mode === "source_excerpts" ||
                  message.engine === "local-retrieval"
                ? "Source excerpts · no AI-written summary"
                : "RevUpTime AI"}
          </T>
          <MarkdownText content={message.content} />
          {!!message.evidence?.retrieved_at && (
            <T muted>Retrieved: {message.evidence.retrieved_at}</T>
          )}
          {message.evidence?.warnings?.map((warning, i) => (
            <T muted key={i}>
              {warning}
            </T>
          ))}
          {!!message.citations?.length && (
            <KnowledgeSources
              sources={message.citations}
              org={profile!.organization_id}
            />
          )}
        </Card>
      ))}
      <ErrorMessage error={error} />
      {!!error && (
        <Button
          title="Retry question"
          secondary
          disabled={busy}
          onPress={() => void send()}
        />
      )}
      {!!error && mode === "general" && (
        <Button
          title="Search workspace documents instead"
          secondary
          disabled={busy}
          onPress={() => {
            setMode("workspace");
            newScope();
          }}
        />
      )}
      <Button
        title="Maintenance assistant and work-order drafts"
        secondary
        onPress={() =>
          router.push({
            pathname: "/maintenance-chat",
            params: asset ? { assetId: asset } : {},
          })
        }
      />
    </Screen>
  );
}
