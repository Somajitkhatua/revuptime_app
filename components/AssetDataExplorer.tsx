import React, { useState } from "react";
import { View } from "react-native";
import { Card, T, Chips, State, Select } from "./ui";
import TrendChart from "./TrendChart";
import { useAssetTrend } from "../hooks/queries";
import { readingFields } from "../utils/readingDisplay";
export default function AssetDataExplorer({ assetId }: { assetId: string }) {
  const [range, setRange] = useState("7D"),
    [stream, setStream] = useState(""),
    [metric, setMetric] = useState("x_rms");
  const q = useAssetTrend(
    assetId,
    ({ "1H": 1, "24H": 24, "7D": 168, "30D": 720 } as Record<string, number>)[
      range
    ],
  );
  const options = readingFields.map((field) => ({ label: field.label, value: field.key }));
  const candidates = (q.data || []).filter(
    (r) =>
      (!r.available_metrics || r.available_metrics.includes(metric)) &&
      Number.isFinite((r as any)[metric]),
  );
  const streamKey = (r: (typeof candidates)[number]) =>
    `${r.sensor_id || "unspecified"}:${r.metric_units?.[metric] || (metric === "temperature" ? "°C" : metric === "rpm" ? "rpm" : "mm/s")}`;
  const streams = Array.from(new Set(candidates.map(streamKey)));
  const activeStream = streams.includes(stream) ? stream : streams[0] || "";
  const rows = candidates.filter((r) => streamKey(r) === activeStream);
  const values = rows.map((r) => (r as any)[metric] as number),
    unit =
      rows[0]?.metric_units?.[metric] ||
      (metric === "temperature" ? "°C" : metric === "rpm" ? "rpm" : "mm/s");
  return (
    <>
      <Card style={{ gap: 14 }}>
        <T style={{ fontSize: 18, fontWeight: "700" }}>Data Explorer</T>
        <T muted>
          Explore recorded sensor measurements by metric and time range.
          Charts use samples across the entire selected period. Averages below describe the displayed samples.
        </T>
        <Chips
          values={["1H", "24H", "7D", "30D"]}
          value={range}
          onChange={setRange}
        />
        <Select
          label="Measurement"
          value={metric}
          options={options}
          onChange={setMetric}
        />
        <State
          loading={q.isLoading}
          error={q.error}
          retry={() => q.refetch()}
          empty={
            !q.isLoading && !q.error && !rows.length
              ? "No readings recorded for this measurement and time range."
              : undefined
          }
        />
        {streams.length > 1 && (
          <Select
            label="Sensor stream"
            value={activeStream}
            options={streams.map((value) => ({ label: value, value }))}
            onChange={setStream}
          />
        )}
        {!!values.length && (
          <>
            <TrendChart
              values={values}
              unit={unit}
              labels={rows.map((r) =>
                new Date(r.recorded_at).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                }),
              )}
            />
            <View
              style={{ flexDirection: "row", justifyContent: "space-between" }}
            >
              {[
                ["Latest", values.at(-1)!],
                ["Sample average", values.reduce((a, b) => a + b, 0) / values.length],
                ["Maximum", Math.max(...values)],
              ].map(([label, value]) => (
                <View key={label} style={{ gap: 5 }}>
                  <T muted>{label}</T>
                  <T>
                    {Number(value).toFixed(2)} {unit}
                  </T>
                </View>
              ))}
            </View>
          </>
        )}
      </Card>
      {rows
        .slice(-30)
        .reverse()
        .map((r) => (
          <Card key={r.id} style={{ gap: 5 }}>
            <T>{new Date(r.recorded_at).toLocaleString()}</T>
            <T style={{ fontWeight: "700" }}>
              {((r as any)[metric] as number).toFixed(2)} {unit}
            </T>
          </Card>
        ))}
      {!!rows.length && (
        <T muted>
          Showing the latest {Math.min(rows.length, 30)} of {rows.length}{" "}
          sampled records.
        </T>
      )}
    </>
  );
}
