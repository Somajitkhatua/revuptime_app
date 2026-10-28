import { client, isDemo, isCanonical } from "./supabase";
import { normalizeRow } from "./canonical";
import { demo } from "./demo";
import { DemoState } from "../types/models";
export async function rows<T>(
  table: string,
  collection: keyof DemoState,
  org: string,
  filters: Record<string, string> = {},
): Promise<T[]> {
  if (isDemo) {
    const result = await demo();
    return (result[collection] as unknown as Record<string, unknown>[]).filter(
      (r) =>
        r.organization_id === org &&
        Object.entries(filters).every(([k, v]) => r[k] === v),
    ) as T[];
  }
  const selection =
    isCanonical && table === "work_orders"
      ? "*,work_order_tasks(*)"
      : isCanonical && table === "chat_messages"
        ? "*,chat_sessions!inner(organization_id,asset_id,user_id)"
        : "*";
  let q = client()
    .from(table)
    .select(selection)
    .eq(
      table === "chat_messages" && isCanonical
        ? "chat_sessions.organization_id"
        : "organization_id",
      org,
    );
  if (table === "chat_messages" && isCanonical) {
    const { data } = await client().auth.getUser();
    q = q.eq("chat_sessions.user_id", data.user!.id);
  }
  for (const [k, v] of Object.entries(filters))
    q = q.eq(
      table === "chat_messages" && isCanonical ? `chat_sessions.${k}` : k,
      v,
    );
  const { data, error } = await q;
  if (error) throw error;
  return (isCanonical ? data?.map((r) => normalizeRow(table, r)) : data) as T[];
}
export async function update<T>(
  table: string,
  org: string,
  id: string,
  value: Record<string, unknown>,
): Promise<T> {
  const { data, error } = await client()
    .from(table)
    .update(value)
    .eq("organization_id", org)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as T;
}
