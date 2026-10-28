import { requestAssistant } from "./assistantRequest";
import { ChatMessage, Evidence } from "../types/models";
import { rows } from "./repository";
import { isDemo, isCanonical } from "./supabase";
import { demo, mutateDemo, uuid } from "./demo";
export const getMessages = async (org: string, asset: string) =>
  (
    await rows<ChatMessage>("chat_messages", "messages", org, {
      asset_id: asset,
    })
  ).sort((a, b) => a.created_at.localeCompare(b.created_at));
export async function askAI(
  org: string,
  asset: string,
  question: string,
  sessionId?: string,
  action: "chat" | "draft" = "chat",
) {
  if (!org || !asset)
    throw new Error("Select a machine before sending a question.");
  if (!question.trim()) throw new Error("Enter a question.");
  if (question.length > 2000)
    throw new Error("Keep your question below 2,000 characters.");
  if (!isDemo) {
    const data = await requestAssistant(
      { asset_id: asset, question, session_id: sessionId, action },
      isCanonical ? "asset-summary" : "asset-ai",
    );
    if (
      !data?.id ||
      typeof data.content !== "string" ||
      data.role !== "assistant"
    )
      throw new Error(
        "The assistant returned an unreadable answer. Please retry.",
      );
    return data as ChatMessage;
  }
  const s = await demo(),
    a = s.assets.find((x) => x.id === asset)!;
  const readings = s.readings.filter((r) => r.asset_id === asset);
  const latest = readings.at(-1)!;
  if (!a || !latest)
    throw new Error(
      "No sensor readings are available for this machine yet. Connect telemetry before requesting a condition review.",
    );
  const avg = readings.reduce((n, r) => n + r.x_rms, 0) / readings.length;
  const increase = Math.round((latest.x_rms / avg - 1) * 100);
  const history = s.maintenance.filter((x) => x.asset_id === asset);
  const doc = s.documents.find(
    (d) => d.asset_id === asset && d.type === "OEM Manual",
  );
  const evidence: Evidence[] = [
    {
      kind: "Live sensor evidence",
      text: `Current X-axis RMS is ${latest.x_rms} mm/s. Temperature is ${latest.temperature}°C. Health score is ${a.health_score}%. Reading recorded ${new Date(latest.recorded_at).toLocaleString()}.`,
      sources: [{ label: "Latest sensor reading" }],
    },
    {
      kind: "Historical trend",
      text: `RMS is ${increase}% above the sampled 7-day average of ${avg.toFixed(1)} mm/s. ${a.health === "Critical" ? "An increasing trend warrants inspection." : "Continue monitoring against established thresholds."}`,
      sources: [{ label: "Sensor data — last 7 days" }],
    },
    {
      kind: "OEM/RAG evidence",
      text: doc
        ? "Demo manual excerpt: inspect bearing lubrication, mounting bolts, and coupling alignment. This illustrative source is not a verified OEM instruction."
        : "No processed OEM manual is available for this asset. Upload a manual for verified document evidence.",
      sources: doc
        ? [
            {
              label: "Demo ABB Motor Manual — page 47",
              document_id: doc.id,
              page: 47,
            },
          ]
        : [],
    },
    {
      kind: "Maintenance-history evidence",
      text: history.length
        ? `Most recent recorded maintenance: ${history[0].title}. Vibration decreased from ${history[0].before_vibration} to ${history[0].after_vibration} mm/s.`
        : "No maintenance events recorded for this machine.",
      sources: history.length ? [{ label: history[0].work_order_id }] : [],
    },
    {
      kind: "AI recommendation",
      text:
        a.health === "Critical"
          ? "Arrange a qualified inspection of the drive-end bearing, lubrication, alignment, and mounting. Bearing degradation is a possibility, not a diagnosis. Follow plant isolation procedures before work."
          : "Review the machine trend and thresholds, verify sensor mounting, and record a baseline during the next inspection.",
    },
  ];
  const now = new Date().toISOString();
  const response: ChatMessage = {
    id: uuid(),
    organization_id: org,
    asset_id: asset,
    role: "assistant",
    content: `Condition review · ${a.name}`,
    evidence,
    created_at: now,
  };
  await mutateDemo((d) => {
    d.messages.push(
      {
        id: uuid(),
        organization_id: org,
        asset_id: asset,
        role: "user",
        content: question,
        created_at: now,
      },
      response,
    );
  });
  return response;
}
