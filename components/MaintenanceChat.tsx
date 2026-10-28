import { canEditMaintenance } from "../utils/permissions";
import React, { useState, useEffect } from "react";
import { View, Text, TextInput, Pressable } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import {
  Screen,
  Card,
  T,
  Icon,
  Select,
  Button,
  State,
  ErrorMessage,
  styles,
  DemoBanner,
} from "../components/ui";
import AIChatBubble from "../components/AIChatBubble";
import { useAssets, useAIChat, useSites, useDocuments } from "../hooks/queries";
import { colors as c } from "../constants/colors";
import { useApp } from "../providers/AppProvider";
import { isDemo } from "../services/supabase";
export default function AI() {
  const { profile } = useApp();
  const params = useLocalSearchParams<{ assetId?: string }>(),
    assets = useAssets(true),
    plants = useSites(),
    [plant, setPlant] = useState(""),
    [sessionId, setSessionId] = useState<string>(),
    [action, setAction] = useState<"chat" | "draft">("chat"),
    [asset, setAsset] = useState(params.assetId || ""),
    [question, setQuestion] = useState(""),
    chat = useAIChat(asset, sessionId, action),
    documents = useDocuments(asset);
  const machines = (assets.data || []).filter(
    (a) => !plant || a.site_id === plant,
  );
  const sessions = Array.from(
    new Map(
      (chat.messages.data || [])
        .filter((m) => m.session_id)
        .map((m) => [m.session_id!, m]),
    ).entries(),
  );
  const messages = (chat.messages.data || []).filter((m) =>
    sessionId ? m.session_id === sessionId : isDemo,
  );
  useEffect(() => {
    if (params.assetId) {
      setAsset(params.assetId);
      setPlant("");
      setSessionId(undefined);
    } else if (!asset && assets.data?.length)
      setAsset(
        assets.data.find((a) => a.health === "Critical")?.id ||
          assets.data[0].id,
      );
  }, [params.assetId]);
  useEffect(() => {
    if (!asset && machines.length) setAsset(machines[0].id);
  }, [assets.data, plant]);
  const prompts = [
    "Analyze current condition",
    "Why is vibration increasing?",
    "What should I inspect?",
    "Show recent anomalies",
    "Compare with last week",
    "Summarize maintenance history",
    "What does OEM manual recommend?",
    "Create maintenance checklist",
  ];
  function send(q = question) {
    if (
      !q.trim() ||
      !assets.data?.some((a) => a.id === asset) ||
      chat.send.isPending
    )
      return;
    chat.send.mutate(q.trim(), {
      onSuccess: (answer) => {
        setQuestion("");
        setSessionId(answer.session_id);
      },
    });
  }
  return (
    <Screen
      title="RevUpTime AI"
      footer={
        <View
          style={{
            padding: 12,
            borderTopWidth: 1,
            borderTopColor: "#E6EEF7",
            backgroundColor: "white",
          }}
        >
          <View style={[styles.input, styles.row, { paddingVertical: 8 }]}>
            <TextInput
              accessibilityLabel="Ask about this machine"
              placeholder="Ask about this machine..."
              value={question}
              onChangeText={setQuestion}
              onSubmitEditing={() => send()}
              multiline
              style={{ flex: 1, minHeight: 40, fontSize: 14, color: c.navy }}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Send question"
              disabled={!question.trim() || !asset || chat.send.isPending}
              onPress={() => send()}
              style={{
                padding: 10,
                borderRadius: 9,
                backgroundColor: question.trim() ? c.blue : "#C5D5E6",
              }}
            >
              <Icon name="arrow-up" color="white" size={19} />
            </Pressable>
          </View>
        </View>
      }
    >
      <Select
        label="Plant"
        value={plant}
        options={[
          { label: "All plants", value: "" },
          ...(plants.data || []).map((s) => ({ label: s.name, value: s.id })),
        ]}
        onChange={(value) => {
          if (chat.send.isPending) return;
          setPlant(value);
          setAsset(
            (assets.data || []).find((a) => !value || a.site_id === value)
              ?.id || "",
          );
          setSessionId(undefined);
          chat.send.reset();
        }}
      />
      <Select
        compact
        accessibilityLabel="Select asset"
        value={asset}
        options={machines.map((a) => ({
          label: a.name,
          value: a.id,
        }))}
        onChange={(value) => {
          if (chat.send.isPending) return;
          setAsset(value);
          setSessionId(undefined);
          chat.send.reset();
        }}
      />
      <View style={{ flexDirection: "row", gap: 10 }}>
        <Button
          title="New conversation"
          secondary
          disabled={chat.send.isPending}
          onPress={() => {
            setSessionId(undefined);
            setQuestion("");
            chat.send.reset();
          }}
        />
      </View>
      {!!sessions.length && (
        <Select
          label="Chat history"
          value={sessionId || ""}
          options={[
            { label: "New conversation", value: "" },
            ...sessions.map(([id, m]) => ({
              label: `${new Date(m.created_at).toLocaleDateString()} · ${m.content.slice(0, 55)}`,
              value: id,
            })),
          ]}
          onChange={(id) => {
            if (!chat.send.isPending) {
              setSessionId(id || undefined);
              chat.send.reset();
            }
          }}
        />
      )}
      <Select
        label="Request type"
        value={action}
        options={[
          { label: "Ask maintenance assistant", value: "chat" },
          ...(canEditMaintenance(profile)
            ? [{ label: "Create Work Order with AI", value: "draft" }]
            : []),
        ]}
        onChange={(value) => {
          if (!chat.send.isPending) {
            setAction(value as "chat" | "draft");
            chat.send.reset();
          }
        }}
      />
      <T muted style={{ fontSize: 10 }}>
        {isDemo
          ? "Illustrative demo responses. Sign in for the connected assistant."
          : "Answers use your machine records and matching passages from processed documents. Check cited pages in the original manual."}
      </T>
      {!!asset && (
        <Card style={{ gap: 8 }}>
          <T style={{ fontWeight: "700" }}>Machine documents</T>
          <T muted>
            {documents.data?.length || 0} uploaded · Manual Q&A needs indexed
            passages and retrieval.
          </T>
          <Button
            title="View machine documents"
            secondary
            onPress={() => router.push(`/asset/documents?id=${asset}`)}
          />
          <ErrorMessage error={documents.error || plants.error} />
        </Card>
      )}
      <State
        loading={assets.isLoading || chat.messages.isLoading}
        error={assets.error || chat.messages.error}
        retry={() => {
          assets.refetch();
          chat.messages.refetch();
        }}
        empty={
          !assets.isLoading && !machines.length
            ? "No machines available in this plant."
            : undefined
        }
      />
      {!messages.length && !!asset && (
        <Card style={{ alignItems: "center", paddingVertical: 20, gap: 12 }}>
          <View
            style={{
              width: 54,
              height: 54,
              borderRadius: 16,
              backgroundColor: "#ECF5FF",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Icon name="zap" size={27} color={c.blue} />
          </View>
          <T style={{ fontWeight: "700", fontSize: 18 }}>How can I help?</T>
          <T muted style={{ textAlign: "center", maxWidth: 380 }}>
            Explore trends, review machine manuals, and prepare your next
            maintenance action.
          </T>
        </Card>
      )}
      {messages.map((m) => (
        <AIChatBubble
          key={m.id}
          message={m}
          onCreate={
            !canEditMaintenance(profile)
              ? undefined
              : () =>
                  router.push({
                    pathname: "/work-order/create",
                    params: {
                      assetId: asset,
                      title: m.draft?.title || "Inspect machine condition",
                      description: m.draft?.description || m.content,
                      priority: m.draft?.priority || "Medium",
                    },
                  })
          }
        />
      ))}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {prompts.map((p) => (
          <Pressable
            key={p}
            disabled={!asset || chat.send.isPending}
            onPress={() => send(p)}
            style={{
              paddingVertical: 8,
              paddingHorizontal: 12,
              borderWidth: 1,
              borderColor: c.border,
              borderRadius: 10,
              backgroundColor: "#ECF4FF",
            }}
          >
            <T style={{ fontSize: 11, color: c.muted }}>{p} ↗</T>
          </Pressable>
        ))}
      </View>
      {chat.send.isPending && <State loading />}
      <ErrorMessage error={chat.send.error} />
      {!!chat.send.error && (
        <Button
          title="Retry failed request"
          secondary
          onPress={() => send(chat.send.variables || question)}
        />
      )}
      <T muted style={{ fontSize: 10, textAlign: "center" }}>
        AI recommendations support qualified engineering judgment. Verify
        sources before acting.
      </T>
    </Screen>
  );
}
