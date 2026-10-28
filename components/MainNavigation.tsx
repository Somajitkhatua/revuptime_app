import React from "react";
import { View, Text, Pressable, Platform } from "react-native";
import { router } from "expo-router";
import { mobileNavigation } from "../constants/navigation";
import { Icon } from "./ui";
import { useSafeAreaInsets } from "react-native-safe-area-context";
export default function MainNavigation({
  active = "assets",
}: {
  active?: string;
}) {
  const insets = useSafeAreaInsets();
  const items = mobileNavigation;
  return (
    <View
      style={{
        flexDirection: "row",
        backgroundColor: "white",
        borderTopWidth: 1,
        borderTopColor: "#E5EAF1",
        height: 70 + insets.bottom,
        paddingBottom: 10 + insets.bottom,
        paddingTop: 10,
      }}
    >
      {items.map((item) => (
        <Pressable
          key={item.route}
          accessibilityRole="button"
          accessibilityLabel={`Go to ${item.title}`}
          accessibilityState={{
            selected:
              item.route ===
              (["ai", "more"].includes(active) ? "more" : active),
          }}
          onPress={() => router.replace(`/(tabs)/${item.route}` as never)}
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            gap: 5,
          }}
        >
          <Icon
            name={item.icon}
            size={22}
            color={
              item.route === (["ai", "more"].includes(active) ? "more" : active)
                ? "#0085FF"
                : "#8493A7"
            }
          />
          <Text
            style={{
              fontSize: 10,
              fontWeight: "600",
              color:
                item.route ===
                (["ai", "more"].includes(active) ? "more" : active)
                  ? "#0085FF"
                  : "#8493A7",
            }}
          >
            {item.title}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
