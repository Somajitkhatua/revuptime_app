import React, { useEffect } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, T, Button, State, ErrorMessage } from "./ui";
import MarkdownText from "./MarkdownText";
import { getMachineInsights, sendChatMessage } from "../services/aiService";
import { useOrg } from "../hooks/queries";
import { isDemo } from "../services/supabase";
export default function AIInsightCard({
  assetId,
}: {
  assetId: string;
  critical?: boolean;
}) {
  const org = useOrg();
  const insights = useQuery({
    queryKey: ["insights", org, assetId],
    queryFn: () => getMachineInsights(assetId),
    enabled: !!org && !!assetId && !isDemo,
  });
  const explanation = useMutation({
    mutationFn: () =>
      sendChatMessage(
        org,
        assetId,
        "Explain the latest measurements, current alerts and recent trend. State missing data and recommend the next qualified inspection.",
      ),
  });
  useEffect(() => {
    explanation.reset();
  }, [assetId, org]);
  const data = insights.data;
  return (
    <Card style={{ backgroundColor: "#F1F5F9", gap: 12 }}>
      <T style={{ fontWeight: "700", fontSize: 17 }}>
        AI Insights {data ? `· ${data.asset.name}` : ""}
      </T>
      {isDemo ? (
        <T muted>
          Illustrative demo readings. Sign in to analyze recorded machine data.
        </T>
      ) : (
        <State
          loading={insights.isLoading}
          error={insights.error}
          retry={() => insights.refetch()}
        />
      )}
      {data && (
        <>
          {!data.measurements.length && <T>Insufficient sensor data</T>}
          {data.measurements.map((m) => (
            <View
              key={`${m.sensor_id}:${m.metric}:${m.unit}`}
              style={{ gap: 4 }}
            >
              <T style={{ fontWeight: "600" }}>
                {m.metric.replace(/_/g, " ")}: {m.latest.value} {m.unit}
              </T>
              <T muted style={{ fontSize: 11 }}>
                {new Date(m.latest.timestamp).toLocaleString()}
                {m.stale ? " · Older than 24 hours" : ""}
              </T>
              <T muted style={{ fontSize: 11 }}>
                {m.count} samples · Average {m.average.toFixed(2)} · Change{" "}
                {m.change === null
                  ? "insufficient samples"
                  : `${m.change.toFixed(2)} ${m.unit}`}
              </T>
            </View>
          ))}
          <T style={{ fontWeight: "600" }}>
            Current alerts:{" "}
            {data.alert_count ??
              data.alerts.filter((a) =>
                ["open", "acknowledged"].includes(a.status),
              ).length}
          </T>
          {data.alerts
            .filter((a) => ["open", "acknowledged"].includes(a.status))
            .map((a) => (
              <T key={a.id}>
                {a.title} · {a.severity}
              </T>
            ))}
          {data.sensors.map((s) => (
            <T key={s.id} muted>
              {s.name}: {s.status}
            </T>
          ))}
          {data.window.truncated && (
            <T muted>
              Trends use the latest 1,000 records in the seven-day window.
            </T>
          )}
          {!data.provider_configured && (
            <T muted>
              Model explanations need an OpenRouter key configured by the
              administrator.
            </T>
          )}
          <Button
            title="Explain measurements with AI"
            secondary
            disabled={!data.provider_configured}
            loading={explanation.isPending}
            onPress={() => explanation.mutate()}
          />
          {!!explanation.data && (
            <MarkdownText content={explanation.data.content} />
          )}
          <ErrorMessage error={explanation.error} />
          {!!explanation.error && (
            <Button
              title="Retry explanation"
              secondary
              onPress={() => explanation.mutate()}
            />
          )}
        </>
      )}
      <Button
        title="Ask AI"
        secondary
        icon="message-square"
        onPress={() => router.push(`/(tabs)/ai?assetId=${assetId}`)}
      />
    </Card>
  );
}
