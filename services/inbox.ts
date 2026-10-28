import { client, isDemo } from "./supabase";
export async function getInbox(org: string) {
  if (isDemo) return [];
  const { data, error } = await client()
    .from("wa_conversations")
    .select(
      "id,contact_name,contact_phone,mode,status,last_message_at,last_message_preview,unread_count,assigned_to,handover_reason",
    )
    .eq("organization_id", org)
    .order("last_message_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return data || [];
}
export async function getInboxMessages(org: string, conversation: string) {
  const { data, error } = await client()
    .from("wa_messages")
    .select("id,direction,body,status,created_at,sender_type,type")
    .eq("organization_id", org)
    .eq("conversation_id", conversation)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return (data || []).reverse();
}
