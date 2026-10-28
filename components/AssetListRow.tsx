import React, { useState } from "react";
import { View, Text, Image, Pressable, StyleSheet } from "react-native";
import { router } from "expo-router";
import { Asset } from "../types/models";
import { Icon, tone } from "./ui";
import { useTelemetry } from "../hooks/queries";
import { userError } from "../utils/userError";
import SensorReadingsPanel from "./SensorReadingsPanel";

const thumbnails: Record<string, number> = {
  Motor: require("../assets/machines/motor.jpg"),
  Pump: require("../assets/machines/pump.jpg"),
  Fan: require("../assets/machines/fan.jpg"),
  Gearbox: require("../assets/machines/gearbox.jpg"),
};
export default function AssetListRow({ asset, plantName }: { asset: Asset; plantName?: string }) {
  const telemetry = useTelemetry(asset.id);
  const reading = telemetry.data;
  const [expanded, setExpanded] = useState(false);
  const metrics = [
    { key: "x_rms", label: "X RMS", value: reading?.x_rms },
    { key: "y_rms", label: "Y RMS", value: reading?.y_rms },
    { key: "z_rms", label: "Z RMS", value: reading?.z_rms },
    { key: "temperature", label: "Temp", value: reading?.temperature },
  ].filter((metric) => reading && (!reading.available_metrics || reading.available_metrics.includes(metric.key)) && Number.isFinite(metric.value));
  const critical = asset.health === "Critical",
    color = tone(asset.health);
  return (
    <View style={[s.row, critical && s.critical]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${asset.name}${asset.asset_code ? `, ${asset.asset_code}` : ""}, ${asset.health}${asset.health !== "Not assessed" ? `, ${asset.health_score}%` : ""}`}
        onPress={() => router.push(`/asset/${asset.id}`)}
        style={({ pressed }) => [s.header, pressed && { opacity: 0.78 }]}
      >
        <View style={s.imageBox}>
          <Image source={asset.image_url ? { uri: asset.image_url } : thumbnails[asset.type] || thumbnails.Motor}
            resizeMode="contain" style={s.image} accessibilityLabel={`${asset.type} equipment`} />
        </View>
        <View style={s.copy}>
          <Text style={s.name}>{asset.name}</Text>
          {!!asset.asset_code && <Text style={s.code}>{asset.asset_code}</Text>}
          <Text style={s.description} numberOfLines={1}>{asset.description || [asset.manufacturer, asset.model].filter(Boolean).join(" · ") || asset.type}</Text>
          <Text style={s.description}>{[plantName, asset.location].filter(Boolean).join(" · ") || "Location not recorded"}</Text>
          <Text style={s.description}>Status: {asset.status ? asset.status[0].toUpperCase() + asset.status.slice(1).replace(/_/g, " ") : "Not recorded"}</Text>
          <View style={s.health}>
            <View style={[s.dot, { backgroundColor: color }]} />
            <Text style={[s.status, { color }]}>{asset.health}</Text>
            {asset.health !== "Not assessed" && <Text style={s.percentage}>· {asset.health_score}%</Text>}
          </View>
        </View>
        <Icon name="chevron-right" size={17} color="#143653" />
      </Pressable>
      {!!metrics.length && <View style={s.metrics}>{metrics.map((metric) => <Text key={metric.key} style={s.measurement}>
        {metric.label}: {metric.value} {reading?.metric_units?.[metric.key] || ""}
      </Text>)}</View>}
      {reading && <Text style={s.timestamp}>Recorded {new Date(reading.recorded_at).toLocaleString()}{Date.now() - Date.parse(reading.recorded_at) > 86400000 ? " · Older than 24 hours" : ""}</Text>}
      {reading && <Pressable accessibilityRole="button" accessibilityLabel={`${expanded ? "Hide" : "View all"} readings for ${asset.name}`} onPress={() => setExpanded(!expanded)} style={{ paddingVertical: 8 }}>
        <Text style={s.code}>{expanded ? "Hide detailed readings" : `View all readings · ${reading.sensor_readings?.length || 1} sensor(s)`}</Text>
      </Pressable>}
      {reading && expanded && <SensorReadingsPanel reading={reading} />}
      {telemetry.isLoading && <Text style={s.timestamp}>Loading sensor readings…</Text>}
      {!telemetry.isLoading && !telemetry.error && !reading && <Text style={s.timestamp}>No sensor readings recorded</Text>}
      {!!telemetry.error && <Pressable accessibilityRole="button" accessibilityLabel={`Retry readings for ${asset.name}`} onPress={() => telemetry.refetch()}>
        <Text style={s.timestamp}>{userError(telemetry.error)} Tap to retry readings.</Text>
      </Pressable>}
    </View>
  );
}
const s = StyleSheet.create({
  row: {
    gap: 8,
    minHeight: 86,
    paddingVertical: 11,
    paddingHorizontal: 12,
    backgroundColor: "white",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5EBF3",
  },
  header: { flexDirection: "row", alignItems: "center", gap: 11 },
  critical: { backgroundColor: "#EAF4FF", borderColor: "#86C2FF" },
  imageBox: {
    width: 70,
    height: 60,
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: "white",
  },
  image: { width: "100%", height: "100%" },
  copy: { flex: 1, gap: 4 },
  name: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0F1E3A",
    letterSpacing: -0.2,
  },
  description: { fontSize: 11, color: "#425B7B" },
  code: { fontSize: 11, fontWeight: "600", color: "#0085FF" },
  metrics: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 5 },
  measurement: { fontSize: 10, color: "#21446A", backgroundColor: "#EEF5FC", padding: 5, borderRadius: 5 },
  timestamp: { fontSize: 10, color: "#687D94", marginTop: 3 },
  health: { flexDirection: "row", alignItems: "center", gap: 5 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  status: { fontSize: 11, fontWeight: "500" },
  percentage: { fontSize: 11, color: "#375475" },
});
