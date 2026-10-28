import React, { useState } from "react";
import { View, Text } from "react-native";
import { useLocalSearchParams } from "expo-router";
import {
  Screen,
  Card,
  T,
  Chips,
  Section,
  State,
  Field,
  ErrorMessage,
  Select,
} from "../../components/ui";
import DetailTabs from "../../components/DetailTabs";
import TrendChart from "../../components/TrendChart";
import { useAsset, useAssetTrend } from "../../hooks/queries";
import { validDate } from "../../utils/validation";
import { isDemo } from "../../services/supabase";
export default function Trends() {
  const { id } = useLocalSearchParams<{ id: string }>(),
    asset = useAsset(id);
  const [range, setRange] = useState("7D"),
    [stream, setStream] = useState(""),
    [category, setCategory] = useState("Vibration"),
    [axis, setAxis] = useState("X Axis"),
    [from, setFrom] = useState(
      new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10),
    ),
    [to, setTo] = useState(new Date().toISOString().slice(0, 10));
  const custom = range === "Custom",
    valid =
      !custom ||
      (validDate(from) && validDate(to) && Date.parse(from) <= Date.parse(to));
  const q = useAssetTrend(
    id,
    ({ "1H": 1, "24H": 24, "7D": 168, "30D": 720 } as Record<string, number>)[
      range
    ] || 168,
    custom && valid ? from : undefined,
    custom && valid ? to + "T23:59:59Z" : undefined,
  );
  const metric =
    category === "Temperature"
      ? "temperature"
      : axis === "Y Axis"
        ? "y_rms"
        : axis === "Z Axis"
          ? "z_rms"
          : axis === "RMS"
            ? "overall_rms"
            : "x_rms";
  const candidates = (q.data || []).filter(
    (r) =>
      isDemo || !r.available_metrics || r.available_metrics.includes(metric),
  );
  const streamKey = (r: (typeof candidates)[number]) =>
    `${r.sensor_id || "unspecified"}:${r.metric_units?.[metric] || (category === "Temperature" ? "°C" : "mm/s")}`;
  const streams = Array.from(new Set(candidates.map(streamKey))),
    activeStream = streams.includes(stream) ? stream : streams[0] || "";
  const rows = candidates.filter((r) => streamKey(r) === activeStream),
    unit =
      category === "Health"
        ? "%"
        : rows[0]?.metric_units?.[metric] ||
          (category === "Temperature" ? "°C" : "mm/s");
  const values =
    category === "Health" && !isDemo
      ? []
      : rows.map((r) =>
          category === "Temperature"
            ? r.temperature
            : category === "Health"
              ? Math.max(0, Math.min(100, Math.round(100 - (r.x_rms - 1) * 9)))
              : axis === "Y Axis"
                ? r.y_rms
                : axis === "Z Axis"
                  ? r.z_rms
                  : axis === "RMS"
                    ? (r.overall_rms ??
                      (isDemo
                        ? Math.sqrt(
                            (r.x_rms ** 2 + r.y_rms ** 2 + r.z_rms ** 2) / 3,
                          )
                        : NaN))
                    : r.x_rms,
        );
  const avg = values.length
    ? values.reduce((a, b) => a + b, 0) / values.length
    : 0;
  const labels = rows.map((r) =>
    new Date(r.recorded_at).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
    }),
  );
  return (
    <Screen
      title={asset.data?.name || "Asset trends"}
      back
      actions={
        <Select
          compact
          accessibilityLabel="Time range"
          value={range}
          options={["1H", "24H", "7D", "30D", "Custom"].map((v) => ({
            label: v,
            value: v,
          }))}
          onChange={setRange}
        />
      }
      onRefresh={() => q.refetch()}
      refreshing={q.isRefetching}
    >
      <DetailTabs
        values={["Vibration", "Temperature", "Health"]}
        value={category}
        onChange={setCategory}
      />
      {custom && (
        <Card style={{ gap: 10 }}>
          <Field label="From (YYYY-MM-DD)" value={from} onChange={setFrom} />
          <Field label="To (YYYY-MM-DD)" value={to} onChange={setTo} />
          <ErrorMessage
            error={
              !valid
                ? new Error("Enter valid dates in chronological order.")
                : null
            }
          />
        </Card>
      )}
      {category === "Vibration" && (
        <Chips
          values={["X Axis", "Y Axis", "Z Axis", "RMS"]}
          value={axis}
          onChange={setAxis}
        />
      )}
      {category === "Health" && !isDemo && (
        <T muted>
          Historical health scores are not available. Health is not inferred
          from vibration alone.
        </T>
      )}
      <State
        loading={q.isLoading}
        error={q.error || asset.error}
        retry={() => {
          q.refetch();
          asset.refetch();
        }}
      />
      {streams.length > 1 && (
        <Select
          label="Sensor stream"
          value={activeStream}
          options={streams.map((value) => ({ label: value, value }))}
          onChange={setStream}
        />
      )}
      <Card style={{ gap: 10 }}>
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <Text style={{ fontSize: 14, fontWeight: "700", color: "#132D4E" }}>
            {category === "Vibration"
              ? `${axis} Vibration (RMS)`
              : `${category} trend`}
          </Text>
          <T muted style={{ fontSize: 10 }}>
            {unit}
          </T>
        </View>
        <TrendChart
          values={valid ? values : []}
          labels={labels}
          unit={unit}
          threshold={
            isDemo && category === "Vibration" && axis === "X Axis"
              ? 4.5
              : undefined
          }
          color={category === "Temperature" ? "#FF8A00" : "#0085FF"}
        />
        <View
          style={{
            flexDirection: "row",
            borderWidth: 1,
            borderColor: "#E6EEF7",
            borderRadius: 10,
            paddingVertical: 12,
          }}
        >
          {[
            ["Current", values.at(-1)],
            ["Sample average", values.length ? avg : undefined],
            ["Max", values.length ? Math.max(...values) : undefined],
          ].map(([label, v], i) => (
            <View
              key={String(label)}
              style={{
                flex: 1,
                paddingHorizontal: 10,
                borderLeftWidth: i ? 1 : 0,
                borderLeftColor: "#E6EEF7",
                gap: 5,
              }}
            >
              <Text style={{ fontSize: 10, color: "#527197" }}>{label}</Text>
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: "700",
                  color:
                    isDemo && i === 0 && category === "Vibration" && Number(v) > 4.5
                      ? "#FF2947"
                      : "#17345A",
                }}
              >
                {typeof v === "number" ? v.toFixed(1) : "—"} {unit}
              </Text>
            </View>
          ))}
        </View>
        {category === "Health" && (
          <T muted style={{ fontSize: 10 }}>
            Estimated from RMS readings; the recorded asset health score is
            calculated separately.
          </T>
        )}
      </Card>
      {category === "Vibration" && (
        <Card style={{ gap: 8 }}>
          <Section title="Temperature" />
          <TrendChart
            values={valid ? rows.filter((r) => !r.available_metrics || r.available_metrics.includes("temperature")).map((r) => r.temperature) : []}
            labels={rows.filter((r) => !r.available_metrics || r.available_metrics.includes("temperature")).map((r) => new Date(r.recorded_at).toLocaleString())}
            unit={rows.find((r) => r.available_metrics?.includes("temperature"))?.metric_units?.temperature || "°C"}
            color="#FF8A00"
          />
        </Card>
      )}
    </Screen>
  );
}
