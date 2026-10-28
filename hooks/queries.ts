import { canEditMaintenance } from "../utils/permissions";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { AppState } from "react-native";
import { getOperations } from "../services/operations";
import { applyComputedHealth } from "../utils/operations";
import { useApp } from "../providers/AppProvider";
import { getAssets, getAsset } from "../services/assets";
import { getSites } from "../services/sites";
import { getAlerts, setAlertStatus } from "../services/alerts";
import {
  getWorkOrders,
  createWorkOrder,
  setWorkOrder,
  completeWorkOrder,
} from "../services/workOrders";
import { getReadings, getLatest } from "../services/telemetry";
import { getMaintenance } from "../services/maintenance";
import { getDocuments } from "../services/documents";
import { getMessages, askAI } from "../services/ai";
import { supabase } from "../services/supabase";
import { AlertStatus, Completion, WorkOrder } from "../types/models";
export const useOrg = () => useApp().profile?.organization_id || "";
export const useOperations = () => {
  const org = useOrg();
  return useQuery({
    queryKey: ["operations", org],
    queryFn: () => getOperations(org),
    enabled: !!org,
    refetchInterval: 30000,
  });
};
export const useSites = () => {
  const org = useOrg();
  return useQuery({
    queryKey: ["sites", org],
    queryFn: () => getSites(org),
    enabled: !!org,
  });
};
export const useAssets = (all = false) => {
  const org = useOrg(),
    { site } = useApp();
  const operations = useOperations();
  return useQuery({
    queryKey: ["assets", org, all ? "all" : site],
    queryFn: () => getAssets(org, all ? undefined : site || undefined),
    enabled: !!org,
    refetchInterval: 30000,
    select: (rows) =>
      rows.map((asset) =>
        applyComputedHealth(
          asset,
          operations.data?.health.find((h) => h.asset_id === asset.id),
        ),
      ),
  });
};
export const useAsset = (id: string) => {
  const org = useOrg();
  const operations = useOperations();
  return useQuery({
    queryKey: ["asset", org, id],
    queryFn: () => getAsset(org, id),
    enabled: !!org && !!id,
    select: (asset) =>
      applyComputedHealth(
        asset,
        operations.data?.health.find((h) => h.asset_id === asset.id),
      ),
  });
};
export const useAlerts = (asset?: string) => {
  const org = useOrg();
  return useQuery({
    queryKey: ["alerts", org, asset || "all"],
    queryFn: () => getAlerts(org, asset),
    enabled: !!org,
  });
};
export const useWorkOrders = (asset?: string) => {
  const org = useOrg();
  return useQuery({
    queryKey: ["workOrders", org, asset || "all"],
    queryFn: () => getWorkOrders(org, asset),
    enabled: !!org,
  });
};
export const useTelemetry = (asset: string) => {
  const org = useOrg();
  return useQuery({
    queryKey: ["telemetry", org, asset],
    queryFn: () => getLatest(org, asset),
    enabled: !!org && !!asset,
    refetchInterval: (query) =>
      query.state.status === "error" ? false : 30000,
  });
};
export const useAssetTrend = (
  asset: string,
  hours: number,
  from?: string,
  to?: string,
) => {
  const org = useOrg();
  return useQuery({
    queryKey: ["trends", org, asset, hours, from, to],
    queryFn: () => getReadings(org, asset, hours, from, to),
    enabled: !!org && !!asset,
  });
};
export const useDocuments = (asset: string) => {
  const org = useOrg();
  return useQuery({
    queryKey: ["documents", org, asset],
    queryFn: () => getDocuments(org, asset),
    enabled: !!org,
    refetchInterval: 15000,
  });
};
export const useMaintenanceHistory = (asset: string) => {
  const org = useOrg();
  return useQuery({
    queryKey: ["maintenance", org, asset],
    queryFn: () => getMaintenance(org, asset),
    enabled: !!org && !!asset,
  });
};
export function useActions() {
  const { profile } = useApp();
  const writable = <T>(action: () => Promise<T>) => {
    if (!profile || !canEditMaintenance(profile))
      return Promise.reject(new Error("Your account has read-only access."));
    return action();
  };
  const org = useOrg(),
    qc = useQueryClient();
  const invalidate = async () => {
    await Promise.all(
      ["alerts", "workOrders", "maintenance", "documents", "messages"].map(
        (k) => qc.invalidateQueries({ queryKey: [k, org] }),
      ),
    );
  };
  return {
    alert: useMutation({
      mutationFn: ({ id, status }: { id: string; status: AlertStatus }) =>
        writable(() => setAlertStatus(org, id, status)),
      onSuccess: invalidate,
    }),
    create: useMutation({
      mutationFn: (input: Parameters<typeof createWorkOrder>[1]) =>
        writable(() => createWorkOrder(org, input)),
      onSuccess: invalidate,
    }),
    work: useMutation({
      mutationFn: ({
        id,
        values,
      }: {
        id: string;
        values: Parameters<typeof setWorkOrder>[2];
      }) => writable(() => setWorkOrder(org, id, values)),
      onSuccess: invalidate,
    }),
    complete: useMutation({
      mutationFn: ({ id, result }: { id: string; result: Completion }) =>
        writable(() => completeWorkOrder(org, id, result)),
      onSuccess: invalidate,
    }),
  };
}
export function useAIChat(
  asset: string,
  sessionId?: string,
  action: "chat" | "draft" = "chat",
) {
  const org = useOrg(),
    qc = useQueryClient();
  const messages = useQuery({
    queryKey: ["messages", org, asset],
    queryFn: () => getMessages(org, asset),
    enabled: !!org && !!asset,
  });
  const send = useMutation({
    mutationFn: (question: string) =>
      askAI(org, asset, question, sessionId, action),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["messages", org, asset] }),
  });
  return { messages, send };
}
let realtimeSubscriptionId = 0;
export function useRealtime(asset?: string) {
  const [connection, setConnection] = useState("Connecting");
  const org = useOrg(),
    qc = useQueryClient();
  useEffect(() => {
    if (!supabase || !org) return;
    // Tabs remain mounted together. Supabase reuses channels by name, so each
    // effect must own a separate channel, including during cleanup/remounts.
    const channel = supabase.channel(
      `plant:${org}:${asset || "all"}:${++realtimeSubscriptionId}`,
    );
    for (const [table, key] of [
      ["alerts", "alerts"],
      ["work_orders", "workOrders"],
      ["asset_documents", "documents"],
      ["assets", "assets"],
      ["sensors", "telemetry"],
      ["sensor_readings", "telemetry"],
      ["gateways", "operations"],
      ["measurement_points", "operations"],
      ["sensor_installations", "operations"],
    ] as string[][]) {
      channel.on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table,
          filter:
            asset &&
            [
              "alerts",
              "work_orders",
              "asset_documents",
              "measurement_points",
            ].includes(table)
              ? `asset_id=eq.${asset}`
              : `organization_id=eq.${org}`,
        },
        () => {
          qc.invalidateQueries({ queryKey: [key, org] });
          if (key === "telemetry")
            qc.invalidateQueries({ queryKey: ["trends", org] });
          if (key === "assets")
            qc.invalidateQueries({ queryKey: ["asset", org] });
          if (key === "telemetry" || key === "alerts")
            qc.invalidateQueries({ queryKey: ["insights", org] });
          qc.invalidateQueries({ queryKey: ["operations", org] });
          if (table === "sensors" || table === "gateways")
            qc.invalidateQueries({ queryKey: ["devices", org] });
        },
      );
    }
    channel.subscribe((status) =>
      setConnection(
        status === "SUBSCRIBED"
          ? "Connected"
          : status === "CHANNEL_ERROR" || status === "TIMED_OUT"
            ? "Reconnecting"
            : "Connecting",
      ),
    );
    const foreground = AppState.addEventListener("change", (state) => {
      if (state === "active")
        for (const key of [
          "operations",
          "telemetry",
          "assets",
          "alerts",
          "workOrders",
          "trends",
        ])
          qc.invalidateQueries({ queryKey: [key, org] });
    });
    return () => {
      foreground.remove();
      supabase!.removeChannel(channel);
    };
  }, [org, asset, qc]);
  return connection;
}
