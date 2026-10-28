import { client } from "./supabase";
import { Platform } from "react-native";

// This setting is a development server URL, never an AI provider credential.
const localUrl = __DEV__
  ? Platform.OS === "web" && process.env.EXPO_PUBLIC_AI_API_URL
    ? "/api/local-ai"
    : process.env.EXPO_PUBLIC_AI_API_URL?.replace(/\/$/, "")
  : undefined;
export async function requestAssistant(
  body: Record<string, unknown>,
  functionName = "asset-summary",
) {
  if (!localUrl) {
    const result = await client().functions.invoke(functionName, {
      body,
      timeout: 75000,
    });
    if (result.error) {
      let message =
        "Unable to reach the assistant. Check your connection and retry.";
      try {
        const details = await result.error.context?.json();
        message = details?.error || details?.message || message;
      } catch {}
      throw new Error(
        typeof message === "string"
          ? message
          : "The assistant request failed. Please retry.",
      );
    }
    return result.data;
  }
  const { data, error } = await client().auth.getSession();
  if (error || !data.session?.access_token)
    throw new Error("Sign in again to use the assistant.");
  const controller = new AbortController(),
    timer = setTimeout(() => controller.abort(), 75000);
  try {
    const response = await fetch(`${localUrl}/${functionName}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${data.session.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const result = await response.json().catch(() => null);
    if (!response.ok)
      throw new Error(
        typeof result?.error === "string"
          ? result.error
          : `Assistant request failed (${response.status}).`,
      );
    if (!result)
      throw new Error("The assistant returned an unreadable response.");
    return result;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError")
      throw new Error("The assistant took too long to respond. Please retry.");
    if (error instanceof TypeError)
      throw new Error(
        "Cannot reach the local AI server. Start npm run ai:local on your PC and retry.",
      );
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
