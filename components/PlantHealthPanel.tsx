import React from "react";
import { View, Text, Image, StyleSheet } from "react-native";
import Svg, { Path, Defs, LinearGradient, Stop } from "react-native-svg";
import { Asset } from "../types/models";
import { tone } from "./ui";

export default function PlantHealthPanel({ assets }: { assets: Asset[] }) {
  const assessed = assets.filter((a) => a.health !== "Not assessed");
  const score = assessed.length
    ? Math.round(
        assessed.reduce((n, a) => n + a.health_score, 0) / assessed.length,
      )
    : 0;
  const status = score >= 80 ? "Healthy" : score >= 60 ? "Warning" : "Critical";
  const arc = "M44.7 135.3 A64 64 0 1 1 135.3 135.3";
  return (
    <View style={s.panel}>
      <View style={s.hero}>
        <View style={s.gaugeBlock}>
          <Text accessibilityRole="header" style={s.heading}>
            Plant Health
          </Text>
          <View style={s.gauge}>
            <Svg width="100%" height="100%" viewBox="0 0 180 165">
              <Defs>
                <LinearGradient id="plant-health" x1="0" y1="0" x2="1" y2="0">
                  <Stop offset="0" stopColor={tone(status)} />
                  <Stop
                    offset=".65"
                    stopColor={score >= 80 ? "#70D6A3" : "#F5C774"}
                  />
                  <Stop offset="1" stopColor="#0085FF" />
                </LinearGradient>
              </Defs>
              <Path
                d={arc}
                fill="none"
                stroke="#E7EDF3"
                strokeWidth="10"
                strokeLinecap="round"
              />
              <Path
                d={arc}
                fill="none"
                stroke="url(#plant-health)"
                strokeWidth="10"
                strokeLinecap="round"
                strokeDasharray={`${(301.6 * score) / 100} 301.6`}
              />
            </Svg>
            <View style={s.score}>
              <Text style={s.number}>
                {assessed.length ? score : "—"}
                {!!assessed.length && <Text style={{ fontSize: 22 }}>%</Text>}
              </Text>
              <Text style={s.health}>
                {!assets.length
                  ? "No assets"
                  : !assessed.length
                    ? "Not assessed"
                    : score >= 80
                      ? "Good Health"
                      : "Needs Attention"}
              </Text>
            </View>
          </View>
        </View>
        <Image
          source={require("../assets/plant-dashboard.jpg")}
          resizeMode="cover"
          style={s.plant}
          accessibilityLabel="Industrial plant towers"
        />
      </View>
      <View style={s.summaries}>
        {(["Healthy", "Warning", "Critical"] as const).map((health) => (
          <View
            key={health}
            style={[
              s.tile,
              {
                backgroundColor:
                  health === "Healthy"
                    ? "#E8F7E9"
                    : health === "Warning"
                      ? "#FFF3E1"
                      : "#FFE8EC",
              },
            ]}
          >
            <Text
              style={[
                s.count,
                { color: health === "Healthy" ? "#073B28" : tone(health) },
              ]}
            >
              {assets.filter((a) => a.health === health).length}
            </Text>
            <Text style={s.label}>{health}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}
const s = StyleSheet.create({
  panel: { gap: 10 },
  hero: {
    flexDirection: "row",
    height: 185,
    backgroundColor: "#F5F9FD",
    borderRadius: 13,
    overflow: "hidden",
  },
  gaugeBlock: { flex: 1, paddingLeft: 10, paddingTop: 12 },
  heading: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0F1E3A",
    letterSpacing: -0.5,
  },
  gauge: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: -6,
  },
  score: { position: "absolute", alignItems: "center", top: "35%" },
  number: {
    fontSize: 35,
    fontWeight: "800",
    color: "#0F1E3A",
    letterSpacing: -1.5,
  },
  health: { fontSize: 10, fontWeight: "600", color: "#0F1E3A", marginTop: 1 },
  plant: { width: "46%", height: "100%", borderRadius: 12 },
  summaries: { flexDirection: "row", gap: 8 },
  tile: {
    flex: 1,
    borderRadius: 11,
    paddingVertical: 10,
    alignItems: "center",
    gap: 3,
  },
  count: { fontSize: 27, fontWeight: "800", letterSpacing: -0.5 },
  label: { fontSize: 11, color: "#17334B" },
});
