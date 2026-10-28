import React from "react";
import { View, Text, StyleSheet } from "react-native";
import type { Reading } from "../types/models";
import { displayMeasurements } from "../utils/readingDisplay";

export default function SensorReadingsPanel({ reading }: { reading: Reading }) {
  const streams = reading.sensor_readings?.length ? reading.sensor_readings : [reading];
  return <View style={{ gap: 16 }}>
    <Text style={s.help}>Stored measurements from the assigned sensors. X, Y and Z identify the sensor’s three measurement directions. RMS describes the effective vibration level.</Text>
    {streams.map((stream, index) => {
      const measurements = displayMeasurements(stream);
      const groups = [...new Set(measurements.map((field) => field.group))];
      return <View key={`${stream.sensor_id}:${index}`} style={{ gap: 8 }}>
        <Text style={s.sensor}>{stream.sensor_name || `Sensor ${index + 1}`}</Text>
        {stream.sensor_id && <Text selectable style={s.help}>Sensor ID: {stream.sensor_id}</Text>}
        {groups.map((group) => <View key={group} style={s.group}>
          <Text style={s.heading}>{group}</Text>
          {group === "Displacement" && <Text style={s.help}>How far the sensor moves during vibration.</Text>}
          {group === "Acceleration" && <Text style={s.help}>How quickly vibration velocity changes.</Text>}
          {measurements.filter((field) => field.group === group).map((field) => <View key={field.key} style={s.row}>
            <View style={{ flex: 1 }}><Text style={s.label}>{field.label}</Text>
              <Text style={s.time}>{new Date(field.timestamp).toLocaleString()}</Text></View>
            <Text selectable style={s.value}>{field.value} {field.unit}</Text>
          </View>)}
        </View>)}
        {Date.now() - Date.parse(stream.recorded_at) > 86400000 && <Text style={s.help}>Last received more than 24 hours ago. These are historical stored values, not a live measurement.</Text>}
        {measurements.some((field) => field.unit === "unit not recorded") && <Text style={s.help}>A unit was not stored for some measurements. Confirm the sensor’s unit configuration before comparing those values.</Text>}
      </View>;
    })}
  </View>;
}
const s = StyleSheet.create({
  help: { fontSize: 11, lineHeight: 17, color: "#58718E" },
  sensor: { fontSize: 14, fontWeight: "700", color: "#173959" },
  group: { borderWidth: 1, borderColor: "#E4EDF7", borderRadius: 10, padding: 10, gap: 8 },
  heading: { fontSize: 12, fontWeight: "700", color: "#1765A0" },
  row: { flexDirection: "row", gap: 8, justifyContent: "space-between", alignItems: "center" },
  label: { fontSize: 11, color: "#21446A" }, time: { fontSize: 9, marginTop: 3, color: "#687D94" },
  value: { fontSize: 12, fontWeight: "600", color: "#173959", textAlign: "right", maxWidth: "48%", flexShrink: 1 },
});
