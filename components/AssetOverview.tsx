import SensorReadingsPanel from "./SensorReadingsPanel";
import React from "react";
import { View, Text, Image, StyleSheet } from "react-native";
import { Asset, Reading } from "../types/models";
import { Icon, formatDate, tone } from "./ui";
import { formatInstallation } from "../utils/assetDates";

const images: Record<string, number> = {
  Motor: require("../assets/machines/motor-detail.jpg"),
  Pump: require("../assets/machines/pump.jpg"),
  Fan: require("../assets/machines/fan.jpg"),
  Gearbox: require("../assets/machines/gearbox.jpg"),
};
export function AssetHero({ asset }: { asset: Asset }) {
  const color = tone(asset.health);
  return (
    <View style={s.hero}>
      <Image
        source={
          asset.image_url
            ? { uri: asset.image_url }
            : images[asset.type] || images.Motor
        }
        resizeMode="contain"
        style={{ width: "59%", height: 145 }}
        accessibilityLabel={`${asset.type} equipment`}
      />
      <View style={{ alignItems: "center", gap: 5 }}>
        <Text style={[s.badge, { backgroundColor: color }]}>
          {asset.health}
        </Text>
        <Text
          style={{ fontSize: 40, fontWeight: "800", color, letterSpacing: -1 }}
        >
          {asset.health === "Not assessed" ? "—" : `${asset.health_score}%`}
        </Text>
        <Text style={s.label}>Health Score</Text>
      </View>
    </View>
  );
}
export function AssetInformation({ asset }: { asset: Asset }) {
  const fields = [
    ["Asset code", asset.asset_code],
    ["Status", asset.status],
    ["Asset Type", asset.type],
    ["Manufacturer", asset.manufacturer],
    ["Model", asset.model],
    ["Serial Number", asset.serial_number],
    ["Rated Power", asset.power ? `${asset.power} kW` : "Not provided"],
    ["Rated RPM", asset.rpm || "Not provided"],
    ["Location", asset.location],
    ["Installed", formatInstallation(asset)],
  ];
  return (
    <View style={s.panel}>
      {fields.map(([key, value], i) => (
        <View
          key={key}
          style={[s.row, i === fields.length - 1 && { borderBottomWidth: 0 }]}
        >
          <Text style={s.label}>{key}</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            {key === "Status" && (
              <View
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor:
                    asset.status === "Running" ? "#08C575" : "#F59E0B",
                }}
              />
            )}
            <Text style={[s.value, key === "Status" && { color: "#07824C" }]}>
              {value || "Not provided"}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}
export function LatestReadingRows({ reading }: { reading: Reading }) {
  return <SensorReadingsPanel reading={reading} />;
}
const s = StyleSheet.create({
  hero: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    backgroundColor: "white",
    borderRadius: 15,
    padding: 6,
  },
  badge: {
    color: "white",
    borderRadius: 7,
    paddingHorizontal: 17,
    paddingVertical: 5,
    fontSize: 12,
    fontWeight: "600",
  },
  panel: { backgroundColor: "white", borderRadius: 12, paddingHorizontal: 12 },
  row: {
    minHeight: 31,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "#EAF0F7",
    gap: 10,
  },
  label: { fontSize: 12, color: "#31547B" },
  value: { fontSize: 12, color: "#173A62", textAlign: "right", flexShrink: 1 },
  pill: {
    borderRadius: 7,
    paddingHorizontal: 9,
    paddingVertical: 5,
    fontSize: 12,
    fontWeight: "600",
  },
});
