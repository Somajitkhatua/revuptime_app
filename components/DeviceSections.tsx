import React from "react";
import { View, Pressable, Text } from "react-native";
import { router } from "expo-router";
import { Icon } from "./ui";
export default function DeviceSections({
  active,
}: {
  active: "Devices" | "Certificates" | "Policies";
}) {
  const items = [
    {
      label: "Devices" as const,
      route: "/(tabs)/devices" as const,
      icon: "wifi" as const,
    },
    {
      label: "Certificates" as const,
      route: "/devices/certificates" as const,
      icon: "shield" as const,
    },
    {
      label: "Policies" as const,
      route: "/devices/policies" as const,
      icon: "sliders" as const,
    },
  ];
  return (
    <View style={{ gap: 10 }}>
      <Text
        style={{
          fontSize: 11,
          fontWeight: "700",
          color: "#64748B",
          letterSpacing: 1,
        }}
      >
        DEVICE MANAGEMENT
      </Text>
      <View
        style={{
          flexDirection: "row",
          padding: 4,
          backgroundColor: "#EAF1F8",
          borderRadius: 12,
        }}
      >
        {items.map((item) => (
          <Pressable
            key={item.label}
            accessibilityRole="tab"
            accessibilityLabel={item.label}
            accessibilityState={{ selected: item.label === active }}
            onPress={() => {
              if (item.label === active) return;
              if (item.label === "Devices" || active !== "Devices")
                router.replace(item.route);
              else router.push(item.route);
            }}
            style={{
              flex: 1,
              alignItems: "center",
              justifyContent: "center",
              gap: 7,
              minHeight: 62,
              borderRadius: 9,
              backgroundColor: item.label === active ? "white" : "transparent",
            }}
          >
            <Icon
              name={item.icon}
              size={18}
              color={item.label === active ? "#0085FF" : "#64748B"}
            />
            <Text
              style={{
                fontSize: 11,
                fontWeight: "600",
                color: item.label === active ? "#0085FF" : "#64748B",
              }}
            >
              {item.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
