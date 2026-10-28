import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { Asset, AssetAlert, WorkOrder, AssetDocument } from "../types/models";
import { formatDate, tone } from "./ui";

function Tag({ value, outline = false }: { value: string; outline?: boolean }) {
  const color = ["Open", "In Progress", "Predictive"].includes(value)
    ? "#007FFF"
    : tone(value);
  return (
    <Text
      style={{
        fontSize: 10,
        color,
        backgroundColor: outline ? "white" : color + "14",
        borderWidth: outline ? 1 : 0,
        borderColor: color + "88",
        borderRadius: 6,
        paddingHorizontal: 7,
        paddingVertical: 4,
      }}
    >
      {value}
    </Text>
  );
}
export function MonitoringAlertRow({
  alert,
  asset,
}: {
  alert: AssetAlert;
  asset?: Asset;
}) {
  const color = tone(alert.severity);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${asset?.name || "Asset"}: ${alert.title}`}
      onPress={() => router.push(`/alert/${alert.id}`)}
      style={s.row}
    >
      <View style={[s.iconBox, { backgroundColor: color + "12" }]}>
        <View style={[s.icon, { backgroundColor: color }]}>
          <Feather
            name={alert.severity === "Info" ? "wifi-off" : "bell"}
            size={16}
            color="white"
          />
        </View>
        <View
          style={{
            height: 3,
            width: 3,
            borderRadius: 2,
            backgroundColor: color,
          }}
        />
      </View>
      <View style={{ flex: 1, gap: 3 }}>
        <View style={s.between}>
          <Text style={s.title}>{asset?.name || "Asset alert"}</Text>
          <Tag value={alert.severity} outline />
        </View>
        <Text style={s.description}>{alert.title}</Text>
        <Text style={[s.description, { color }]}>
          {alert.value == null ? "—" : alert.value} {alert.unit}
        </Text>
        <Text style={s.date}>{formatDate(alert.detected_at, true)}</Text>
      </View>
    </Pressable>
  );
}
export function MonitoringWorkRow({
  order,
  asset,
  compact = false,
}: {
  order: WorkOrder;
  asset?: Asset;
  compact?: boolean;
}) {
  const overdue =
    Date.parse(order.due_date) < new Date().setHours(0, 0, 0, 0) &&
    order.status !== "Completed";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${order.number}: ${order.title}`}
      onPress={() => router.push(`/work-order/${order.id}`)}
      style={[s.row, { minHeight: compact ? 61 : 112 }]}
    >
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={s.title}>{order.number}</Text>
        {!compact && <Text style={s.description}>{order.title}</Text>}
        <Text style={s.description}>{asset?.name || "Asset"}</Text>
        {!compact && (
          <Text style={[s.date, overdue && { color: "#F52E48" }]}>
            Due: {formatDate(order.due_date)}
          </Text>
        )}
      </View>
      <View style={{ alignItems: "flex-end", gap: 10 }}>
        <Tag value={order.priority} />
        {!compact && (
          <Tag value={order.status} outline={order.status === "Open"} />
        )}
      </View>
    </Pressable>
  );
}
export function MonitoringDocumentRow({
  document,
}: {
  document: AssetDocument;
}) {
  const ready = document.status === "Ready for AI",
    failed = document.status === "Failed",
    color = ready ? "#00AD63" : failed ? "#EF3751" : "#FF9A00";
  const fileColor =
    document.file_type === "PDF"
      ? "#F52238"
      : document.type === "Drawing"
        ? "#FF9A00"
        : "#0759B5";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open ${document.title}`}
      onPress={() =>
        router.push(`/document/${document.id}?assetId=${document.asset_id}`)
      }
      style={s.row}
    >
      <View
        style={[
          s.iconBox,
          {
            width: 42,
            backgroundColor: "#F6F9FC",
            borderWidth: 1,
            borderColor: "#E1EBF5",
          },
        ]}
      >
        <View style={[s.icon, { backgroundColor: fileColor, borderRadius: 4 }]}>
          <Feather name="file-text" color="white" size={18} />
        </View>
      </View>
      <View style={{ flex: 1, gap: 3 }}>
        <Text style={s.title}>{document.title}</Text>
        {!!document.filename && document.filename !== document.title && (
          <Text style={s.description}>{document.filename}</Text>
        )}
        <Text style={s.description}>{document.type}</Text>
        <Text style={s.date}>
          {document.asset_id ? "Machine document" : "Shared workspace document"}
        </Text>
        <Text style={s.date}>
          {document.pages
            ? `${document.pages} pages`
            : "Page count unavailable"}{" "}
          · {document.file_type}
        </Text>
        <Text style={[s.date, { color }]}>{document.status}</Text>
      </View>
      <View
        style={{
          backgroundColor: color,
          width: 21,
          height: 21,
          borderRadius: 11,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Feather
          name={ready ? "check" : failed ? "x" : "loader"}
          color="white"
          size={13}
        />
      </View>
    </Pressable>
  );
}
const s = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "#E8EEF6",
    borderRadius: 11,
    minHeight: 104,
  },
  between: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 6,
  },
  iconBox: {
    width: 45,
    height: 66,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
  },
  icon: {
    width: 26,
    height: 32,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: 13, fontWeight: "700", color: "#102742", flexShrink: 1 },
  description: { fontSize: 11, color: "#395777", lineHeight: 16 },
  date: { fontSize: 10, color: "#526F90", lineHeight: 14 },
});
