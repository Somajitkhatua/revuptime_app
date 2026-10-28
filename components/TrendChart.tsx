import React from "react";
import { View, Text, useWindowDimensions } from "react-native";
import { LineChart } from "react-native-gifted-charts";
import { colors as c } from "../constants/colors";
import { chartIndices } from "../utils/chartSampling";
export default function TrendChart({
  values,
  labels,
  color = c.blue,
  unit = "mm/s",
  threshold,
}: {
  values: number[];
  labels?: string[];
  color?: string;
  unit?: string;
  threshold?: number;
}) {
  const [width, setWidth] = React.useState(0);
  const indexes = chartIndices(values);
  const points = indexes.map((index) => values[index]);
  const max = Math.max(...points, threshold || 0, 1) * 1.2;
  return (
    <View
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      style={{ width: "100%", overflow: "hidden", paddingTop: 10 }}
    >
      {width > 0 && points.length > 0 ? (
        <View>
          <LineChart
            data={points.map((value, i) => ({
              value,
              label: "",
            }))}
            width={Math.max(width - 58, 160)}
            height={145}
            maxValue={max}
            noOfSections={4}
            spacing={Math.max(width - 80, 140) / Math.max(points.length - 1, 1)}
            initialSpacing={4}
            endSpacing={0}
            color={color}
            thickness={2.5}
            hideDataPoints
            areaChart
            startFillColor={color}
            endFillColor={color}
            startOpacity={0.13}
            endOpacity={0.01}
            rulesColor="#E9EEF4"
            rulesType="dashed"
            yAxisColor="transparent"
            xAxisColor="#E5EAF1"
            yAxisTextStyle={{ color: c.muted, fontSize: 10 }}
            xAxisLabelTextStyle={{ color: c.muted, fontSize: 9 }}
            formatYLabel={(v) => Number(v).toFixed(max > 100 ? 0 : 1)}
            showReferenceLine1={!!threshold}
            referenceLine1Position={threshold}
            referenceLine1Config={{
              color: c.amber,
              dashWidth: 5,
              dashGap: 4,
              labelText: "Threshold",
              labelTextStyle: { color: c.amber, fontSize: 9 },
            }}
            pointerConfig={{
              pointerStripHeight: 145,
              pointerStripColor: c.muted,
              pointerColor: color,
              radius: 4,
              pointerLabelWidth: 100,
              pointerLabelHeight: 40,
              pointerLabelComponent: (items: any[]) => (
                <View
                  style={{
                    backgroundColor: c.navy,
                    padding: 7,
                    borderRadius: 5,
                  }}
                >
                  <Text style={{ color: "white", fontSize: 11 }}>
                    {items[0]?.value?.toFixed(1)} {unit}
                  </Text>
                </View>
              ),
            }}
          />
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              paddingLeft: 34,
              paddingRight: 14,
              marginTop: -14,
              paddingBottom: 4,
            }}
          >
            {[0, Math.floor(points.length / 2), points.length - 1].map(
              (i, j) => (
                <Text key={j} style={{ fontSize: 10, color: c.muted }}>
                  {labels?.[indexes[i]] || ["Start", "Midpoint", "Now"][j]}
                </Text>
              ),
            )}
          </View>
        </View>
      ) : (
        <Text style={{ color: c.muted, padding: 20 }}>
          No readings in this time range.
        </Text>
      )}
    </View>
  );
}
