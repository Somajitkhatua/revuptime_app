import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Icon, IconName } from "./ui";
import { operationColor } from "../utils/operations";
export const palette = {
  navy: "#092947",
  blue: "#0085FF",
  muted: "#687D95",
  border: "#E0E8F2",
  background: "#F5F8FC",
};
export function StatusTag({
  label,
  status = "",
  color,
}: {
  label: string;
  status?: string;
  color?: string;
}) {
  const tint = color || operationColor(status);
  return (
    <View
      style={{
        alignSelf: "flex-start",
        backgroundColor: tint + "14",
        borderRadius: 20,
        paddingHorizontal: 10,
        paddingVertical: 5,
      }}
    >
      <Text style={{ color: tint, fontSize: 11, fontWeight: "700" }}>
        {label}
      </Text>
    </View>
  );
}
export function MetricCard({
  title,
  value,
  detail,
  icon,
  onPress,
  color = palette.blue,
}: {
  title: string;
  value: string;
  detail?: string;
  icon: IconName;
  onPress: () => void;
  color?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}: ${value}`}
      onPress={onPress}
      style={o.metric}
    >
      <Icon name={icon} color={color} size={21} />
      <Text style={o.metricTitle}>{title}</Text>
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Text style={[o.metricValue, { color }]}>{value}</Text>
        <Icon name="chevron-right" size={14} />
      </View>
      {!!detail && (
        <Text
          numberOfLines={1}
          style={{ fontSize: 9, lineHeight: 12, color: palette.muted }}
        >
          {detail}
        </Text>
      )}
    </Pressable>
  );
}
export function SectionHeading({
  title,
  link,
  onPress,
}: {
  title: string;
  link?: string;
  onPress?: () => void;
}) {
  return (
    <View style={o.between}>
      <Text style={o.heading}>{title}</Text>
      {!!link && (
        <Pressable accessibilityRole="button" onPress={onPress}>
          <Text style={o.link}>{link}</Text>
        </Pressable>
      )}
    </View>
  );
}
export const o = StyleSheet.create({
  card: {
    backgroundColor: "white",
    borderRadius: 15,
    borderWidth: 1,
    borderColor: palette.border,
    padding: 13,
    gap: 10,
  },
  metric: {
    flexBasis: "47%",
    flexGrow: 1,
    minWidth: 120,
    padding: 12,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: "white",
    borderRadius: 14,
    gap: 6,
  },
  metricTitle: { fontSize: 12, color: "#385574" },
  metricValue: { fontSize: 27, fontWeight: "800", letterSpacing: -0.7 },
  heading: {
    fontSize: 18,
    fontWeight: "800",
    color: palette.navy,
    letterSpacing: -0.4,
  },
  title: { fontSize: 16, fontWeight: "700", color: palette.navy },
  text: { fontSize: 13, lineHeight: 21, color: "#365575" },
  caption: { fontSize: 11, lineHeight: 17, color: palette.muted },
  link: { fontSize: 12, fontWeight: "600", color: palette.blue },
  between: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
});
