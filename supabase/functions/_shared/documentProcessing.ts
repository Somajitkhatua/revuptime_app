export function chunkPages(pages: string[]) {
  if (!Array.isArray(pages) || !pages.some((p) => typeof p === "string" && p.trim()))
    throw new Error("No readable text was found. Upload a searchable PDF or ask your administrator to enable OCR.");
  const chunks: { chunk_index: number; content: string; page_number: number }[] = [];
  pages.forEach((text, page) => {
    if (typeof text !== "string") return;
    for (let offset = 0; offset < text.length; offset += 1000) {
      const content = text.slice(offset, offset + 1200).trim();
      if (content) chunks.push({ chunk_index: chunks.length, content, page_number: page + 1 });
      if (chunks.length > 400) throw new Error("This document is too large to process. Split it into smaller PDFs and upload again.");
    }
  });
  return chunks;
}
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization,x-client-info,apikey,content-type", "Access-Control-Allow-Methods": "POST,OPTIONS" };
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { ...cors, "Content-Type": "application/json" } });
class RequestError extends Error { constructor(message: string, public status: number) { super(message); } }
const check = (r: any) => { if (r.error) throw new Error("Document storage is temporarily unavailable. Please retry."); return r.data; };
export function createDocumentHandler({ createClient, env, extractPages, waitUntil }: {
  createClient: any; env: (key: string) => string | undefined;
  extractPages: (file: Blob, mime: string) => Promise<string[]>;
  waitUntil?: (task: Promise<unknown>) => void;
}) {
  return async (req: Request) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
    if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
    try {
      const bearer = req.headers.get("Authorization");
      if (!bearer?.startsWith("Bearer ")) throw new RequestError("Sign in to process documents.", 401);
      const db = createClient(env("SUPABASE_URL"), env("SUPABASE_ANON_KEY"), { global: { headers: { Authorization: bearer } }, auth: { persistSession: false } });
      const identity = await db.auth.getUser(), user = identity.data?.user;
      if (identity.error || !user?.email_confirmed_at) throw new RequestError("A verified account is required.", 401);
      const body = await req.json().catch(() => null);
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body?.document_id || "")) throw new RequestError("Select a valid document.", 400);
      const found = await db.from("asset_documents").select("*").eq("id", body.document_id).maybeSingle();
      if (found.error || !found.data) throw new RequestError("Document unavailable in your workspace.", 404);
      const doc = found.data;
      const member = await db.from("organization_members").select("role").eq("organization_id", doc.organization_id).eq("user_id", user.id).eq("status", "active").maybeSingle();
      if (member.error || !member.data || !["owner","admin","manager","technician"].includes(String(member.data.role).toLowerCase())) throw new RequestError("Your account has read-only access.", 403);
      if (!doc.asset_id || doc.storage_bucket !== "asset-documents" || !doc.storage_path?.startsWith(`${doc.organization_id}/${doc.asset_id}/`)) throw new RequestError("This document has an unsupported storage location. Upload the original file again.", 400);
      const server = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });
      const job = crypto.randomUUID();
      const claimed = check(await server.rpc("revuptime_claim_document", { p_document: doc.id, p_organization: doc.organization_id, p_job: job }));
      if (!claimed) return json({ status: doc.metadata?.status || "Queued", message: "This document is already processed or processing. Refresh for its latest status." });
      const process = async () => {
        try {
          const file = check(await server.storage.from("asset-documents").download(doc.storage_path));
          if (!file || file.size > 20 * 1024 * 1024) throw new Error("File unavailable or larger than 20 MB. Upload a smaller file.");
          const pages = await extractPages(file, doc.mime_type || ""), chunks = chunkPages(pages);
          check(await server.rpc("revuptime_finish_document", { p_document: doc.id, p_job: job, p_pages: pages.length, p_chunks: chunks }));
          return { status: "Ready for AI", chunks: chunks.length };
        } catch (error) {
          const message = error instanceof Error ? error.message : "Processing failed. Please retry.";
          check(await server.rpc("revuptime_finish_document", { p_document: doc.id, p_job: job, p_pages: 0, p_chunks: [], p_error: message.slice(0, 300) }));
          return { status: "Failed", error: message };
        }
      };
      if (waitUntil) { waitUntil(process().catch(() => console.error("Document status could not be saved; processing lease will expire."))); return json({ status: "Extracting text" }, 202); }
      return json(await process());
    } catch (error) {
      return json({ error: error instanceof RequestError ? error.message : "Document processing is temporarily unavailable. Your file is saved; please retry." }, error instanceof RequestError ? error.status : 503);
    }
  };
}
