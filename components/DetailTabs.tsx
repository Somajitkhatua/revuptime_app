import React from "react";
import { ScrollView, Pressable, Text } from "react-native";
export default function DetailTabs({
  values,
  value,
  onChange,
}: {
  values: string[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={{
        flexGrow: 0,
        borderBottomWidth: 1,
        borderBottomColor: "#E3ECF6",
      }}
    >
      {values.map((name) => (
        <Pressable
          key={name}
          accessibilityRole="tab"
          accessibilityLabel={name}
          accessibilityState={{ selected: value === name }}
          onPress={() => onChange(name)}
          style={{
            paddingHorizontal: 14,
            paddingVertical: 11,
            borderBottomWidth: 2,
            borderBottomColor: value === name ? "#0085FF" : "transparent",
          }}
        >
          <Text
            style={{
              fontSize: 12,
              fontWeight: "600",
              color: value === name ? "#0085FF" : "#345675",
            }}
          >
            {name}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}
