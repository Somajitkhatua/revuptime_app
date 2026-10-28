import { AssetDocument } from "../types/models";
import { rows } from "./repository";
import { client, isDemo, isCanonical } from "./supabase";
import { normalizeRow } from "./canonical";
import { mutateDemo, uuid } from "./demo";
import { Platform } from "react-native";
import { File as NativeFile, Directory, Paths } from "expo-file-system";
import { indexKnowledgeDocument } from "./knowledge";
import { validateKnowledgeFile, KNOWLEDGE_BUCKET } from "../utils/knowledge";
import type { IndexProgress } from "../types/knowledge";
import { documentInScope } from "../utils/documents";
export async function getDocuments(
  org: string,
  asset: string,
): Promise<AssetDocument[]> {
  if (!isCanonical && !isDemo) {
    const docs = await rows<AssetDocument>(
      "asset_documents",
      "documents",
      org,
      asset ? { asset_id: asset } : {},
    );
    return docs.filter((d) => !d.metadata?.archived);
  }
  if (!asset || isDemo) {
    const docs = await rows<AssetDocument>("asset_documents", "documents", org);
    return docs.filter((d) => documentInScope(d, org, asset));
  }
  const machine = await client()
    .from("assets")
    .select("id,site_id")
    .eq("organization_id", org)
    .eq("id", asset)
    .maybeSingle();
  if (machine.error) throw machine.error;
  if (!machine.data)
    throw new Error("This machine is unavailable in the selected workspace.");
  const site = machine.data.site_id || "";
  const shared = `or(asset_id.eq.${asset},asset_id.is.null)`;
  const scope = site
    ? `and(${shared},or(site_id.eq.${site},site_id.is.null))`
    : shared;
  const result = await client()
    .from("asset_documents")
    .select("*")
    .eq("organization_id", org)
    .or(scope)
    .order("uploaded_at", { ascending: false });
  if (result.error) throw result.error;
  return (result.data || [])
    .filter((d) => documentInScope(d, org, asset, site))
    .map((d) =>
      isCanonical ? normalizeRow("asset_documents", d) : d,
    ) as AssetDocument[];
}
export interface UploadFile {
  uri: string;
  name: string;
  mimeType?: string;
  size?: number;
  file?: File;
}
export async function uploadFile(
  org: string,
  asset: string,
  file: UploadFile,
  bucket = "asset-documents",
  limit = 20 * 1024 * 1024,
) {
  if ((file.size || 0) > limit)
    throw new Error(`Maximum file size is ${limit / 1024 / 1024} MB.`);
  if (isDemo) {
    if (Platform.OS !== "web") {
      const directory = new Directory(
        Paths.document,
        "revuptime",
        bucket,
        org,
        asset,
      );
      directory.create({ intermediates: true, idempotent: true });
      const target = new NativeFile(
        directory,
        `${uuid()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`,
      );
      const source = new NativeFile(file.uri);
      if (source.size > limit)
        throw new Error(`Maximum file size is ${limit / 1024 / 1024} MB.`);
      source.copy(target);
      return target.uri;
    }
    const blob = file.file || (await (await fetch(file.uri)).blob());
    if (blob.size > limit)
      throw new Error(`Maximum file size is ${limit / 1024 / 1024} MB.`);
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () =>
        reject(new Error("Unable to read the selected file."));
      reader.readAsDataURL(blob);
    });
  }
  const bytes =
    Platform.OS === "web"
      ? await (
          file.file || (await (await fetch(file.uri)).blob())
        ).arrayBuffer()
      : await new NativeFile(file.uri).arrayBuffer();
  if (bytes.byteLength > limit)
    throw new Error(`Maximum file size is ${limit / 1024 / 1024} MB.`);
  const path = `${org}/${asset}/${uuid()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  const { error } = await client()
    .storage.from(bucket)
    .upload(path, bytes, {
      contentType: file.mimeType || "application/octet-stream",
      upsert: false,
    });
  if (error) throw error;
  return path;
}
export async function uploadDocument(
  org: string,
  input: Pick<
    AssetDocument,
    "asset_id" | "title" | "type" | "manufacturer" | "model" | "version"
  >,
  file: UploadFile,
  options: {
    previous?: AssetDocument;
    siteId?: string;
    onProgress?: (p: IndexProgress) => void;
    signal?: AbortSignal;
  } = {},
) {
  if (!org || !input.title.trim()) throw new Error("Enter a document title.");
  if (!/\.(png|jpe?g|webp)$/i.test(file.name))
    validateKnowledgeFile(file.name, file.size || 0);
  if (options.signal?.aborted) throw new Error("Upload cancelled.");
  const identity = isDemo ? null : await client().auth.getUser();
  if (!isDemo && (identity?.error || !identity?.data.user))
    throw new Error("Sign in again before uploading a document.");
  const previous = options.previous;
  if (previous && previous.organization_id !== org)
    throw new Error("This document belongs to another workspace.");
  // Fetch the current record before replacing; compare its path again at UPDATE.
  let current: Record<string, any> | undefined;
  if (previous && !isDemo) {
    const { data, error } = await client()
      .from("asset_documents")
      .select("*")
      .eq("organization_id", org)
      .eq("id", previous.id)
      .single();
    if (error || !data)
      throw new Error(
        "The current document is unavailable. Refresh and retry.",
      );
    current = data;
  }
  const bucket = isCanonical ? KNOWLEDGE_BUCKET : "asset-documents";
  const path = await uploadFile(
    org,
    input.asset_id || "workspace",
    file,
    bucket,
    15 * 1024 * 1024,
  );
  const doc: AssetDocument = {
    ...input,
    id: previous?.id || uuid(),
    organization_id: org,
    pages: null,
    version: previous
      ? String((Number(current?.version || previous.version) || 1) + 1)
      : "1",
    file_type: file.name.split(".").pop()?.toUpperCase() || "FILE",
    status: "Queued",
    storage_path: path,
    storage_bucket: bucket,
    created_at: new Date().toISOString(),
  };
  if (isDemo)
    return mutateDemo((s) => {
      if (previous)
        s.documents = s.documents.filter((d) => d.id !== previous.id);
      s.documents.unshift(doc);
      return doc;
    });
  const payload = isCanonical
    ? {
        asset_id: input.asset_id || null,
        site_id: options.siteId || current?.site_id || null,
        organization_id: org,
        uploaded_by: identity!.data.user!.id,
        uploaded_at: doc.created_at,
        // Keep the actual filename: the backend chooses extraction by extension.
        name: file.name,
        document_type: input.type,
        mime_type: /\.(markdown|md|txt|csv|tsv|json|log)$/i.test(file.name)
          ? "text/plain"
          : file.mimeType || "application/octet-stream",
        file_size_bytes: file.size || null,
        storage_bucket: bucket,
        storage_path: path,
        version: doc.version,
        metadata: {
          ...current?.metadata,
          title: input.title,
          archived: false,
          index_status: "pending",
          status: "Queued",
          chunks: 0,
          embedding_status: "pending",
          manufacturer: input.manufacturer,
          model: input.model,
          file_type: doc.file_type,
        },
      }
    : { ...doc };
  const mutation = previous
    ? client()
        .from("asset_documents")
        .update(payload)
        .eq("organization_id", org)
        .eq("id", previous.id)
        .eq("storage_path", current!.storage_path)
    : client()
        .from("asset_documents")
        .insert({ ...payload, id: doc.id });
  const { data, error } = await mutation.select().single();
  if (error || !data) {
    await client().storage.from(bucket).remove([path]);
    throw new Error(
      "Could not save the document. It may have changed; refresh and retry.",
    );
  }
  // Saving and indexing are separate: never upload a duplicate after an indexing error.
  const saved = (
    isCanonical ? normalizeRow("asset_documents", data) : data
  ) as AssetDocument;
  try {
    if (/\.(png|jpe?g|webp)$/i.test(file.name))
      options.onProgress?.({
        message:
          "Photo saved. Scanned documents and images require OCR before knowledge indexing.",
      });
    else if (isCanonical)
      await indexKnowledgeDocument(
        org,
        saved.id,
        false,
        options.onProgress,
        options.signal,
      );
    else await retryDocument(saved.id);
  } catch (error) {
    options.onProgress?.({
      paused: true,
      message: `File saved. Indexing paused: ${error instanceof Error ? error.message : "Check your connection."} Open the document and retry indexing.`,
    });
  }
  return saved;
}
export async function documentUrl(doc: AssetDocument) {
  if (isDemo) {
    if (doc.storage_path) return doc.storage_path;
    throw new Error(
      "This is a demo document. Upload a real file to preview it.",
    );
  }
  const { data, error } = await client()
    .storage.from(doc.storage_bucket || "asset-documents")
    .createSignedUrl(doc.storage_path, 300);
  if (error) throw error;
  return data.signedUrl;
}
export async function retryDocument(id: string) {
  const { data, error } = await client().functions.invoke("process-document", {
    body: { document_id: id },
    timeout: 20000,
  });
  if (error)
    throw new Error(
      "Processing could not start. Your file is saved. Check your connection and try again.",
    );
  if (data?.error) throw new Error(data.error);
  return data;
}
