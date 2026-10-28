// Adapt the existing normalized Supabase schema to the screen models.
import { documentTypeLabel } from "../utils/documents";
export function normalizeRow(table: string, row: any): any {
  const meta = row.metadata || {};
  if (table === "sites")
    return {
      ...row,
      location: [row.city, row.state, row.country].filter(Boolean).join(", "),
    };
  if (table === "assets")
    return {
      ...row,
      type: row.asset_type || "Other",
      asset_code: row.asset_code || "",
      description: row.description || "",
      manufacturer: row.manufacturer || "",
      model: row.model || "",
      location: row.location || "",
      health: meta.health || "Not assessed",
      health_score: meta.health_score ?? 0,
      power:
        row.rated_power_kw != null
          ? Number(row.rated_power_kw)
          : (meta.power ?? 0),
      rpm: meta.rpm ?? 0,
      installed_at: row.installation_date,
      image_url: meta.image_url,
    };
  if (table === "alerts")
    return {
      ...row,
      severity:
        {
          critical: "Critical",
          high: "High",
          warning: "Warning",
          info: "Info",
        }[row.severity as string] || "Info",
      status:
        row.status === "acknowledged"
          ? "Acknowledged"
          : ["resolved", "dismissed"].includes(row.status)
            ? "Resolved"
            : "Open",
      value: row.value ?? row.evidence?.value,
      unit: row.unit || row.evidence?.unit || "",
      threshold: row.threshold ?? row.evidence?.threshold,
    };
  if (table === "work_orders")
    return {
      ...row,
      number: row.work_order_number,
      raw_status: row.status,
      priority: ["critical", "urgent", "high"].includes(row.priority)
        ? "High"
        : row.priority === "medium"
          ? "Medium"
          : "Low",
      status:
        row.status === "completed"
          ? "Completed"
          : ["in_progress", "on_hold"].includes(row.status)
            ? "In Progress"
            : "Open",
      due_date: row.scheduled_end?.slice(0, 10) || "",
      notes: row.description || "",
      tasks: (row.work_order_tasks || [])
        .sort((a: any, b: any) => a.task_number - b.task_number)
        .map((t: any) => ({
          id: t.id,
          title: t.title,
          completed: t.status === "completed",
        })),
      result: row.completion_notes ? tryJSON(row.completion_notes) : undefined,
    };
  if (table === "maintenance_events")
    return {
      ...row,
      technician: row.profiles?.full_name || "Technician",
      occurred_at: row.completed_at || row.created_at,
      before_vibration: row.outcome?.before_vibration ?? 0,
      after_vibration: row.outcome?.final_vibration ?? 0,
      result: row.outcome,
    };
  if (table === "asset_documents")
    return {
      ...row,
      title: meta.title || row.name,
      filename: row.name,
      type: documentTypeLabel(row.document_type),
      asset_id: row.asset_id || "",
      pages: meta.pages ?? null,
      file_type:
        meta.file_type ||
        row.mime_type?.split("/").at(-1)?.toUpperCase() ||
        "FILE",
      status:
        meta.index_status === "pending"
          ? "Queued"
          : meta.index_status === "indexing"
            ? "Chunking"
            : meta.index_status === "ready"
              ? "Ready for AI"
              : meta.index_status === "failed"
                ? "Failed"
                : meta.status || "Not indexed",
      processing_error: meta.processing_error || undefined,
      processing_started_at: meta.processing_started_at || undefined,
      manufacturer: meta.manufacturer || "",
      model: meta.model || "",
      created_at: row.uploaded_at,
    };
  if (table === "chat_messages")
    return {
      ...row,
      organization_id: row.chat_sessions.organization_id,
      asset_id: row.chat_sessions.asset_id,
      evidence: meta.evidence || [],
      draft: meta.draft,
    };
  return row;
}
function tryJSON(value: string) {
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}
