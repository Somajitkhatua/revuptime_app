import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, {
  Circle,
  Defs,
  LinearGradient as SvgGradient,
  Stop,
} from "react-native-svg";
import type { AssetHealth } from "../types/operations";
import { Icon } from "./ui";

export default function HomeHealthHero({
  score,
  health,
  available,
  onPress,
}: {
  score: number | null;
  health: AssetHealth[];
  available: boolean;
  onPress: () => void;
}) {
  const normal = health.filter((h) => h.status === "good").length;
  const watch = health.filter((h) => h.status === "watch").length;
  const action = health.filter((h) => h.status === "act").length;
  const other = health.length - normal - watch - action;
  const known = score !== null && Number.isFinite(score);
  const progress = known ? Math.max(0, Math.min(100, score)) / 100 : 0;
  const label = !known ? "No data" : action ? "Act" : watch ? "Watch" : "Good";
  const badge = !available
    ? "Awaiting health data"
    : !known
      ? "No calculated scores"
      : "Calculated condition";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Plant health: ${known ? `${score} / 100` : "unavailable"}`}
      onPress={onPress}
      style={s.shadow}
    >
      <LinearGradient
        colors={["#064A7D", "#00315B", "#002744"]}
        start={{ x: 1, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={s.hero}
      >
        <View style={s.glow} pointerEvents="none" />
        <View style={s.main}>
          <View style={{ flex: 1, gap: 9 }}>
            <Text style={s.title}>Plant health</Text>
            <View style={{ flexDirection: "row", alignItems: "baseline" }}>
              <Text style={s.value}>{known ? score : "—"}</Text>
              <Text style={s.outOf}>/100</Text>
            </View>
            <View style={s.badge}>
              <Icon
                name={known ? "activity" : "clock"}
                color="#64E5AE"
                size={12}
              />
              <Text style={s.badgeText}>{badge}</Text>
            </View>
            <Text style={s.caption}>
              {available
                ? `${health.length} monitored ${health.length === 1 ? "asset" : "assets"}`
                : "Workspace condition overview"}
            </Text>
          </View>
          <View style={s.ring}>
            <Svg
              width="100%"
              height="100%"
              viewBox="0 0 130 130"
              accessibilityLabel={
                known
                  ? `Health ${score} out of 100`
                  : "Health score unavailable"
              }
            >
              <Defs>
                <SvgGradient id="home-health-ring" x1="0" y1="1" x2="1" y2="0">
                  <Stop offset="0" stopColor="#28DDF0" />
                  <Stop offset=".55" stopColor="#1890FF" />
                  <Stop offset="1" stopColor="#47E79A" />
                </SvgGradient>
              </Defs>
              <Circle
                cx="65"
                cy="65"
                r="52"
                stroke="#155178"
                strokeWidth="11"
                fill="none"
              />
              {progress > 0 && (
                <Circle
                  cx="65"
                  cy="65"
                  r="52"
                  stroke="url(#home-health-ring)"
                  strokeWidth="11"
                  fill="none"
                  strokeLinecap="round"
                  strokeDasharray={`${progress * 326.73} 326.73`}
                  transform="rotate(-90 65 65)"
                />
              )}
            </Svg>
            <View pointerEvents="none" style={s.ringText}>
              <Text style={s.ringLabel}>{label}</Text>
              <Text style={s.ringCaption}>{known ? "condition" : "yet"}</Text>
            </View>
          </View>
        </View>
        <View style={s.legend}>
          {[
            { label: "Normal", count: normal, color: "#40DF91" },
            { label: "Watch", count: watch, color: "#FFC842" },
            { label: "Need action", count: action, color: "#FF7B72" },
          ].map((item) => (
            <View key={item.label} style={s.legendItem}>
              <View style={[s.dot, { backgroundColor: item.color }]} />
              <Text style={s.legendText}>
                <Text style={{ fontWeight: "800" }}>
                  {available ? item.count : "—"}
                </Text>{" "}
                {item.label}
              </Text>
            </View>
          ))}
        </View>
        {other > 0 && (
          <Text style={[s.caption, { marginTop: 10 }]}>
            {other} assets offline or without current condition data
          </Text>
        )}
      </LinearGradient>
    </Pressable>
  );
}
const s = StyleSheet.create({
  shadow: {
    borderRadius: 19,
    shadowColor: "#003B66",
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.16,
    shadowRadius: 15,
    elevation: 3,
  },
  hero: {
    borderRadius: 19,
    padding: 17,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#0B6495",
  },
  glow: {
    position: "absolute",
    width: 240,
    height: 240,
    right: -45,
    top: -105,
    borderRadius: 140,
    backgroundColor: "#1670BC",
    opacity: 0.13,
  },
  main: { flexDirection: "row", alignItems: "center", gap: 8 },
  title: { color: "#F6FBFF", fontSize: 16, fontWeight: "700" },
  value: { color: "white", fontSize: 48, fontWeight: "800", letterSpacing: -2 },
  outOf: { color: "#9CC0DD", fontSize: 21, fontWeight: "600", marginLeft: 3 },
  badge: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 20,
    backgroundColor: "#076155",
  },
  badgeText: {
    color: "#CBFFEA",
    fontSize: 9,
    fontWeight: "600",
    flexShrink: 1,
  },
  caption: { color: "#B3D0E6", fontSize: 11, lineHeight: 16 },
  ring: { width: "40%", maxWidth: 155, aspectRatio: 1 },
  ringText: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
  },
  ringLabel: { color: "white", fontSize: 20, fontWeight: "800" },
  ringCaption: { color: "#BDD7EB", fontSize: 11 },
  legend: {
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#2D5E7D",
    paddingTop: 13,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 5,
    flexWrap: "wrap",
  },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { color: "#E5F4FF", fontSize: 10 },
});
