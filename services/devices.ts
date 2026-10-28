import { client, isDemo } from "./supabase";
export interface DeviceRecord {
  id: string;
  name: string;
  kind: "Sensor" | "Gateway";
  status: string;
  serial_number?: string;
  manufacturer?: string;
  model?: string;
  protocol?: string;
  sensor_type?: string;
  measurement_type?: string;
  unit?: string;
  sampling_interval_seconds?: number;
  last_seen_at?: string;
  metadata?: Record<string, any>;
  configuration?: Record<string, any>;
}
export async function getDevices(org: string): Promise<DeviceRecord[]> {
  if (isDemo) return [];
  const results = await Promise.all([
    client()
      .from("sensors")
      .select(
        "id,name,status,serial_number,manufacturer,model,sensor_type,measurement_type,unit,sampling_interval_seconds,configuration",
      )
      .eq("organization_id", org),
    client()
      .from("gateways")
      .select(
        "id,name,status,serial_number,manufacturer,model,protocol,last_seen_at,metadata",
      )
      .eq("organization_id", org),
  ]);
  for (const r of results) if (r.error) throw r.error;
  return [
    ...(results[0].data || []).map((d) => ({ ...d, kind: "Sensor" as const })),
    ...(results[1].data || []).map((d) => ({ ...d, kind: "Gateway" as const })),
  ];
}
