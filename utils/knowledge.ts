import type {
  AnswerMode,
  KnowledgeMessage,
  IndexProgress,
} from "../types/knowledge";
export const DOCUMENT_LIMIT = 15 * 1024 * 1024;
export const KNOWLEDGE_BUCKET = "revuptime-documents";
export const supportedDocument = (name: string) =>
  /\.(pdf|docx|txt|md|markdown|csv|tsv|json|log)$/i.test(name);
export function validateKnowledgeFile(name: string, size: number) {
  if (!supportedDocument(name))
    throw new Error(
      "Choose PDF, DOCX, TXT, Markdown, CSV, TSV, JSON or log files. Scanned documents require OCR first.",
    );
  if (size > DOCUMENT_LIMIT) throw new Error("Maximum document size is 15 MB.");
  if (!Number.isFinite(size) || size < 0)
    throw new Error("The file size could not be read.");
}
export function knowledgeHistory(messages: KnowledgeMessage[]) {
  return messages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .slice(-8)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 4000) }));
}
export function conversationKey(user: string, org: string, mode: AnswerMode) {
  return `revuptime.knowledge.v1:${user}:${org}:${mode}`;
}
export function knowledgeBody(
  org: string,
  question: string,
  mode: AnswerMode,
  messages: KnowledgeMessage[],
  site = "",
  asset = "",
) {
  if (!org) throw new Error("Sign in to a workspace first.");
  if (!question.trim() || question.trim().length > 4000)
    throw new Error("Ask a question between 1 and 4,000 characters.");
  return {
    organization_id: org,
    question: question.trim(),
    history: knowledgeHistory(messages),
    ...(mode === "workspace"
      ? {
          ...(site ? { site_id: site } : {}),
          ...(asset ? { asset_id: asset } : {}),
        }
      : {}),
  };
}
export type KnowledgeRequest = <T>(
  endpoint: string,
  body: Record<string, unknown>,
  signal?: AbortSignal,
) => Promise<T>;
export async function runDocumentIndex(
  request: KnowledgeRequest,
  org: string,
  id: string,
  vectorsOnly = false,
  onProgress?: (progress: IndexProgress) => void,
  signal?: AbortSignal,
): Promise<IndexProgress> {
  const body = { organization_id: org, document_id: id };
  let result = await request<IndexProgress>(
    vectorsOnly ? "documents/embed" : "documents/index",
    body,
    signal,
  );
  onProgress?.(result);
  if (!vectorsOnly && !result.embedding_pending) return result;
  try {
    // At most 600 chunks, 40 per batch. Stop a non-progressing server safely.
    for (let batch = 0; batch < 16; batch++) {
      if (signal?.aborted)
        throw new Error("Indexing paused. Resume vectors to continue.");
      if (result.remaining === 0) return result;
      const previous = result.remaining;
      result = {
        ...result,
        ...(await request<IndexProgress>("documents/embed", body, signal)),
      };
      onProgress?.(result);
      if (result.remaining === 0) return result;
      if (
        typeof result.remaining !== "number" ||
        (previous !== undefined && result.remaining >= previous)
      )
        break;
    }
    result = {
      ...result,
      paused: true,
      message:
        "Text indexed. Some vectors remain; use Resume vectors to continue.",
    };
  } catch {
    result = {
      ...result,
      paused: true,
      message:
        "Text indexed and available for keyword retrieval. Vectors paused; use Resume vectors when connected and server configuration is ready.",
    };
  }
  onProgress?.(result);
  return result;
}
