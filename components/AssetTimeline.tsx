import React from "react";
import { router } from "expo-router";
import { Card, T, State, Icon, formatDate } from "./ui";
import { Asset } from "../types/models";
import {
  useAlerts,
  useWorkOrders,
  useDocuments,
  useMaintenanceHistory,
} from "../hooks/queries";
export default function AssetTimeline({ asset }: { asset: Asset }) {
  const alerts = useAlerts(asset.id),
    orders = useWorkOrders(asset.id),
    docs = useDocuments(asset.id),
    history = useMaintenanceHistory(asset.id);
  const events: {
    id: string;
    at: string;
    title: string;
    detail: string;
    time: boolean;
    open?: () => void;
  }[] = [];
  if (asset.created_at)
    events.push({
      id: "created",
      at: asset.created_at,
      title: "Asset registered",
      detail: asset.name,
      time: true,
    });
  if (asset.installation_datetime || asset.installed_at)
    events.push({
      id: "installed",
      at: asset.installation_datetime || asset.installed_at,
      title: "Asset installed",
      detail: asset.location || "Location not provided",
      time: !!asset.installation_datetime,
    });
  for (const a of alerts.data || [])
    events.push({
      id: `alarm:${a.id}`,
      at: a.detected_at,
      title: "Alarm detected",
      detail: `${a.title} · ${a.status}`,
      time: true,
      open: () => router.push(`/alert/${a.id}`),
    });
  for (const w of orders.data || [])
    events.push({
      id: `work:${w.id}`,
      at: w.created_at,
      title: "Work order created",
      detail: `${w.number} · ${w.title}`,
      time: true,
      open: () => router.push(`/work-order/${w.id}`),
    });
  for (const h of history.data || [])
    events.push({
      id: `repair:${h.id}`,
      at: h.occurred_at,
      title: "Maintenance completed",
      detail: h.title,
      time: true,
      open: () => router.push(`/asset/history?id=${asset.id}`),
    });
  for (const d of docs.data || [])
    events.push({
      id: `doc:${d.id}`,
      at: d.created_at,
      title: "Document uploaded",
      detail: d.title,
      time: true,
      open: () => router.push(`/document/${d.id}`),
    });
  const rows = events
    .filter((e) => Number.isFinite(Date.parse(e.at)))
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
  return (
    <>
      <Card style={{ gap: 8 }}>
        <T style={{ fontSize: 18, fontWeight: "700" }}>Asset timeline</T>
        <T muted>
          Installation, alarms, work orders, documents and completed maintenance
          recorded for this asset.
        </T>
      </Card>
      <State
        loading={
          alerts.isLoading ||
          orders.isLoading ||
          docs.isLoading ||
          history.isLoading
        }
        error={alerts.error || orders.error || docs.error || history.error}
        retry={() => {
          alerts.refetch();
          orders.refetch();
          docs.refetch();
          history.refetch();
        }}
        empty={!rows.length ? "No events recorded yet." : undefined}
      />
      {rows.map((e) => (
        <Card
          key={e.id}
          onPress={e.open}
          style={{ gap: 8, borderLeftWidth: 3, borderLeftColor: "#0085FF" }}
        >
          <T muted>
            {formatDate(
              !e.time && /^\d{4}-\d{2}-\d{2}$/.test(e.at)
                ? `${e.at}T12:00:00`
                : e.at,
              e.time,
            )}
          </T>
          <T style={{ fontWeight: "700" }}>{e.title}</T>
          <T>{e.detail}</T>
        </Card>
      ))}
    </>
  );
}
