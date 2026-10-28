import { client } from "./supabase";
import { Platform } from "react-native";
import type {
  AnswerMode,
  KnowledgeMessage,
  KnowledgeAnswer,
  IndexProgress,
} from "../types/knowledge";
import { knowledgeBody, runDocumentIndex } from "../utils/knowledge";

// Public application origin only. Provider credentials never belong here.
const origin = (
  process.env.EXPO_PUBLIC_RAG_API_URL || "https://app.revuptime.com"
).replace(/\/$/, "");
export function knowledgeError(status: number, message?: string) {
  if (status === 401)
    return "Your session expired. Sign in again; your question is kept here.";
  if (status === 403)
    return "Your account cannot access this workspace or action. Check your membership and selected scope.";
  if (status === 409)
    return (
      message || "This source has changed. Ask again for its current version."
    );
  if (
    message &&
    /configured AI model is unavailable|AI capacity is temporarily exhausted|AI model.*unavailable|Provider returned error/i.test(
      message,
    )
  )
    return "The AI provider's selected model is temporarily unavailable. Your question is kept. You can search Workspace documents and machine data, or retry after the administrator updates the server model.";
  if (
    message &&
    /OPENROUTER|EMBEDDING_|AI_ALLOW_|API_KEY|environment variable/i.test(
      message,
    )
  )
    return "AI summaries or vectors need server configuration and organization sharing permission. Workspace keyword lookup remains available. Sharing has not been changed.";
  return message || `The workspace request failed (${status}). Please retry.`;
}
export async function knowledgeRequest<T>(
  endpoint: string,
  body: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<T> {
  const controller = new AbortController();
  const cancel = () => controller.abort();
  signal?.addEventListener("abort", cancel);
  const timer = setTimeout(cancel, 125000);
  try {
    if (signal?.aborted) controller.abort();
    const sessionRequest = client().auth.getSession();
    const { data, error } = await new Promise<Awaited<typeof sessionRequest>>(
      (resolve, reject) => {
        const stop = () => reject(new Error("Sign-in check interrupted."));
        if (controller.signal.aborted) return stop();
        controller.signal.addEventListener("abort", stop, { once: true });
        sessionRequest
          .then(resolve, reject)
          .finally(() => controller.signal.removeEventListener("abort", stop));
      },
    );
    if (error || !data.session) throw new Error(knowledgeError(401));
    if (controller.signal.aborted)
      throw new Error("Request cancelled. Your question is kept.");
    const url =
      Platform.OS === "web" && __DEV__
        ? `/api/rag/${endpoint}`
        : `${origin}/api/ai/${endpoint}`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${data.session.access_token}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const result = await response.json().catch(() => null);
    if (!response.ok)
      throw new Error(
        knowledgeError(
          response.status,
          typeof result?.error === "string" ? result.error : undefined,
        ),
      );
    if (!result || typeof result !== "object")
      throw new Error(
        "The workspace response could not be read. Please retry.",
      );
    return result as T;
  } catch (error) {
    if (controller.signal.aborted)
      throw new Error(
        signal?.aborted
          ? "Request cancelled. Your question is kept."
          : "The workspace request timed out. Please retry; your question is kept.",
      );
    if (error instanceof TypeError)
      throw new Error(
        "Cannot reach the workspace server. Check your connection and retry; your question is kept.",
      );
    throw error;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", cancel);
  }
}
export async function askKnowledge(
  org: string,
  question: string,
  mode: AnswerMode,
  messages: KnowledgeMessage[],
  site = "",
  asset = "",
  signal?: AbortSignal,
) {
  const answer = await knowledgeRequest<KnowledgeAnswer>(
    mode === "workspace" ? "knowledge-chat" : "general-chat",
    knowledgeBody(org, question, mode, messages, site, asset),
    signal,
  );
  if (typeof answer.content !== "string" || !Array.isArray(answer.citations))
    throw new Error("The answer could not be read. Please retry.");
  return answer;
}
export const indexKnowledgeDocument = (
  org: string,
  id: string,
  vectorsOnly = false,
  onProgress?: (p: IndexProgress) => void,
  signal?: AbortSignal,
) =>
  runDocumentIndex(knowledgeRequest, org, id, vectorsOnly, onProgress, signal);
