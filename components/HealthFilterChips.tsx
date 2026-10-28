import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
export default function HealthFilterChips({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <View style={s.row}>
      {["All", "Healthy", "Warning", "Critical", "Not assessed"].map((health) => (
        <Pressable
          key={health}
          accessibilityRole="button"
          accessibilityLabel={`${health} assets`}
          accessibilityState={{ selected: value === health }}
          onPress={() => onChange(health)}
          style={[s.chip, value === health && s.active]}
        >
          <Text style={[s.label, value === health && s.selected]}>
            {health}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
const s = StyleSheet.create({
  row: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  chip: {
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: "#EDF2F8",
  },
  active: { backgroundColor: "#0085FF" },
  label: { fontSize: 11, fontWeight: "500", color: "#173959" },
  selected: { color: "white" },
});
