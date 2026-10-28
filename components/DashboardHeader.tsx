import React from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  useWindowDimensions,
} from "react-native";
import { router } from "expo-router";
import { Icon } from "./ui";
import { useApp } from "../providers/AppProvider";
import UserAvatar from "./UserAvatar";
import RevUpTimeLogo from "./RevUpTimeLogo";
export default function DashboardHeader({
  alertCount = 0,
}: {
  alertCount?: number;
}) {
  const { profile } = useApp();
  const compact = useWindowDimensions().width < 360;
  return (
    <View style={s.header}>
      <View style={s.inner}>
        <View
          accessibilityRole="header"
          accessibilityLabel="RevUpTime"
          style={s.brand}
        >
          <RevUpTimeLogo variant="brand" size={compact ? 32 : 40} />
          <Text style={[s.wordmark, { fontSize: compact ? 21 : 24 }]}>
            Rev<Text style={{ color: "#0085FF" }}>Up</Text>Time
          </Text>
        </View>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: compact ? 10 : 15,
          }}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Alerts"
            accessibilityHint={`${alertCount} open workspace alerts`}
            onPress={() => router.push("/(tabs)/alerts")}
            style={s.bell}
          >
            <Icon name="bell" color="#0B2A48" size={24} />
            {alertCount > 0 && (
              <View style={s.badge}>
                <Text style={s.badgeText}>
                  {alertCount > 99 ? "99+" : alertCount}
                </Text>
              </View>
            )}
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Profile"
            onPress={() => router.push("/profile")}
          >
            <UserAvatar profile={profile} size={37} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}
const s = StyleSheet.create({
  header: { backgroundColor: "#F8FBFF", paddingTop: 10, paddingBottom: 8 },
  inner: {
    height: 46,
    paddingHorizontal: 19,
    maxWidth: 680,
    width: "100%",
    alignSelf: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  wordmark: {
    fontSize: 26,
    fontWeight: "800",
    color: "#092947",
    letterSpacing: -1,
  },
  brand: { flexDirection: "row", alignItems: "center", gap: 3, flexShrink: 1 },
  bell: {
    padding: 7,
    minWidth: 42,
    minHeight: 42,
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    position: "absolute",
    top: 0,
    right: -2,
    minWidth: 17,
    height: 17,
    paddingHorizontal: 4,
    borderRadius: 10,
    backgroundColor: "#F04C53",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "white",
  },
  badgeText: { fontSize: 10, fontWeight: "700", color: "white" },
});
