import React from "react";
import { View, Pressable } from "react-native";
import { router } from "expo-router";
import { ChatMessage } from "../types/models";
import { Card, T, styles, Icon, Button } from "./ui";
import { colors as c } from "../constants/colors";
import MarkdownText from "./MarkdownText";
export default function AIChatBubble({
  message,
  onCreate,
}: {
  message: ChatMessage;
  onCreate?: () => void;
}) {
  if (message.role === "user")
    return (
      <View
        style={{
          alignSelf: "flex-end",
          maxWidth: "88%",
          backgroundColor: "#DDEEFF",
          padding: 12,
          borderRadius: 16,
          borderBottomRightRadius: 4,
        }}
      >
        <T style={{ color: "#17375B", fontSize: 12 }}>{message.content}</T>
        <T muted style={{ fontSize: 10 }}>
          {new Date(message.created_at).toLocaleString()}
        </T>
      </View>
    );
  return (
    <Card style={{ gap: 10 }}>
      <View style={styles.row}>
        <View style={[styles.iconBox, { width: 30, height: 30 }]}>
          <Icon name="zap" size={16} color={c.blue} />
        </View>
        <T style={{ fontWeight: "700" }}>
          {message.content.startsWith("Stored-data summary")
            ? "Machine data summary"
            : "RevUpTime AI"}
        </T>
      </View>
      <MarkdownText content={message.content} />
      <T muted style={{ fontSize: 10 }}>
        {new Date(message.created_at).toLocaleString()}
      </T>
      {message.evidence?.map((e, i) => (
        <View
          key={i}
          style={{
            gap: 7,
            borderLeftWidth: 2,
            borderLeftColor: i === 4 ? c.blue : c.border,
            paddingLeft: 13,
          }}
        >
          <T
            style={{
              fontSize: 10,
              fontWeight: "700",
              color: i === 4 ? c.blue : c.muted,
              letterSpacing: 0.5,
            }}
          >
            {e.kind.toUpperCase()}
          </T>
          <T style={{ fontSize: 12 }}>{e.text}</T>
          {e.sources?.map((s, j) => (
            <Pressable
              key={j}
              disabled={!s.document_id}
              onPress={() =>
                router.push(
                  `/document/${s.document_id}?assetId=${message.asset_id}`,
                )
              }
            >
              <T style={{ fontSize: 11, color: c.blue }}>↗ {s.label}</T>
            </Pressable>
          ))}
        </View>
      ))}
      {onCreate && (
        <Button
          title={
            message.draft ? "Review Work Order Draft" : "Create Work Order"
          }
          secondary
          icon="clipboard"
          onPress={onCreate}
        />
      )}
    </Card>
  );
}
