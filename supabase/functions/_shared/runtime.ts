import { createClient } from "npm:@supabase/supabase-js@2.117.2";
export const cors = {
  "Access-Control-Allow-Origin": Deno.env.get("APP_ORIGIN") || "*",
  "Access-Control-Allow-Headers":
    "authorization,x-client-info,apikey,content-type",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
};
export const json = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
export async function authenticate(req: Request) {
  const bearer = req.headers.get("Authorization");
  if (!bearer?.startsWith("Bearer ")) throw new Error("Unauthorized");
  const url = Deno.env.get("SUPABASE_URL")!,
    key = Deno.env.get("SUPABASE_ANON_KEY")!;
  const db = createClient(url, key, {
    global: { headers: { Authorization: bearer } },
    auth: { persistSession: false },
  });
  const {
    data: { user },
    error,
  } = await db.auth.getUser();
  if (error || !user) throw new Error("Unauthorized");
  const { data: profile, error: pe } = await db
    .from("profiles")
    .select("organization_id")
    .eq("id", user.id)
    .single();
  if (pe || !profile) throw new Error("Organization membership required");
  return { db, user, org: profile.organization_id as string };
}
export function admin() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );
}
export async function aiRequest(urlKey: string, body: unknown) {
  const url = Deno.env.get(urlKey),
    key = Deno.env.get("AI_API_KEY");
  if (!url || !key)
    throw new Error(`Configure ${urlKey} and AI_API_KEY on the server.`);
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(60000),
  });
  if (!response.ok) throw new Error("AI provider request failed.");
  return response.json();
}
export async function embedding(text: string) {
  const result = await aiRequest("AI_EMBEDDINGS_URL", {
    model: Deno.env.get("AI_EMBEDDING_MODEL"),
    input: text,
    dimensions: 1536,
  });
  const vector = result.data?.[0]?.embedding;
  if (!Array.isArray(vector) || vector.length !== 1536)
    throw new Error("Expected a 1536-dimensional embedding.");
  return vector as number[];
}
export function assertResult(result: { error: unknown }) {
  if (result.error) throw result.error;
}
