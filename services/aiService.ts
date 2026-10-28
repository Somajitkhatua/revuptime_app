import { requestAssistant } from "./assistantRequest";
import { isDemo } from "./supabase";
import { askAI, getMessages } from "./ai";
import { getDocuments } from "./documents";
import { ChatMessage, Evidence } from "../types/models";
export interface Measurement {
  metric: string;
  sensor_id: string | null;
  unit: string;
  count: number;
  latest: { value: number; timestamp: string };
  average: number;
  minimum: number;
  maximum: number;
  change: number | null;
  change_percent: number | null;
  stale: boolean;
}
export interface MachineInsights {
  asset: { id: string; name: string };
  measurements: Measurement[];
  alerts: { id: string; title: string; status: string; severity: string }[];
  alert_count?: number;
  sensors: { id: string; name: string; status: string }[];
  evidence: Evidence[];
  provider_configured: boolean;
  rag: { available: boolean; reason: string };
  window: { truncated: boolean; returned: number; total: number };
}
export const sendChatMessage = askAI;
export const getChatHistory = getMessages;
export const getMachineDocuments = getDocuments;
export const createWorkOrderDraft = (
  org: string,
  asset: string,
  question: string,
  sessionId?: string,
) => askAI(org, asset, question, sessionId, "draft");
export async function getMachineInsights(
  asset: string,
): Promise<MachineInsights> {
  if (isDemo)
    throw new Error(
      "Live insights require a registered account. Demo readings are illustrative.",
    );
  const data = await requestAssistant({ asset_id: asset, action: "insights" });
  if (
    !data?.asset?.id ||
    !data.asset.name ||
    !Array.isArray(data.measurements) ||
    !Array.isArray(data.alerts) ||
    !Array.isArray(data.sensors) ||
    !data.rag ||
    !data.window
  )
    throw new Error("The insights response could not be read. Please retry.");
  return data;
}
