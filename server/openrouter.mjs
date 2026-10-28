// Server-only replacement for the existing SaaS server/openrouter.mjs module.
// Read provider keys from the server environment; never import this in the app.
export const DEFAULT_MODEL = "nvidia/nemotron-3-super-120b-a12b:free";
export const ULTRA_MODEL = "nvidia/nemotron-3-ultra-550b-a55b:free";
const failure = (status, message) =>
  Object.assign(new Error(message), { status });
const retryable = new Set([404, 408, 410, 429, 500, 502, 503, 504]);

export function createOpenRouter(
  env,
  {
    sendFetch = fetch,
    pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  } = {},
) {
  return async (messages) => {
    if (!env.OPENROUTER_API_KEY)
      throw failure(
        503,
        "The AI provider is not configured. Workspace source excerpts remain available.",
      );
    const primary = env.OPENROUTER_MODEL || DEFAULT_MODEL;
    if (!primary.endsWith(":free") && env.AI_ALLOW_PAID_MODELS !== "true")
      throw failure(503, "Paid models require explicit server configuration.");
    const alternate =
      env.OPENROUTER_FALLBACK_MODEL ||
      (primary === DEFAULT_MODEL ? ULTRA_MODEL : DEFAULT_MODEL);
    // Fallbacks must be explicitly free, even if a paid primary was authorized.
    if (!alternate.endsWith(":free"))
      throw failure(503, "The fallback model must be a free model.");
    const models = [...new Set([primary, alternate])];
    for (let index = 0; index < models.length; index++) {
      const model = models[index];
      const canRetry = index < models.length - 1;
      let response, result;
      try {
        response = await sendFetch(
          "https://openrouter.ai/api/v1/chat/completions",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
              "Content-Type": "application/json",
              "HTTP-Referer": env.APP_ORIGIN || "https://app.revuptime.com",
              "X-Title": "RevUpTime",
            },
            body: JSON.stringify({
              model,
              messages,
              max_tokens: 2048,
              temperature: 0.2,
              provider: { allow_fallbacks: true },
              reasoning: { effort: "low", exclude: true },
            }),
            signal: AbortSignal.timeout(40000),
          },
        );
        result = await response.json().catch((error) => {
          if (["TimeoutError", "AbortError"].includes(error?.name)) throw error;
          return null;
        });
      } catch (error) {
        if (canRetry) {
          await pause(1000);
          continue;
        }
        throw ["TimeoutError", "AbortError"].includes(error?.name)
          ? failure(
              504,
              "The AI provider is taking too long. Your question is kept; please retry shortly.",
            )
          : failure(
              502,
              "Could not connect to the AI provider. Please retry shortly.",
            );
      }
      if (!response.ok || result?.error) {
        const code = Number(result?.error?.code) || response.status;
        if (retryable.has(code) && canRetry) {
          await pause(1000);
          continue;
        }
        if ([401, 403].includes(code))
          throw failure(
            503,
            "The AI provider credentials need administrator attention. Workspace source excerpts remain available.",
          );
        throw code === 429
          ? failure(
              429,
              "AI capacity is temporarily exhausted. Please retry later.",
            )
          : failure(
              502,
              "The configured AI models are temporarily unavailable. Only free fallback models were attempted.",
            );
      }
      const content = result?.choices?.[0]?.message?.content;
      if (
        typeof content !== "string" ||
        !content.trim() ||
        content.length > 24000
      ) {
        if (canRetry) {
          await pause(1000);
          continue;
        }
        throw failure(
          502,
          "The AI provider returned an incomplete response. Your question is kept.",
        );
      }
      return {
        content: content.trim(),
        model,
        tokens_used: Math.min(
          100000,
          Math.max(0, Number(result.usage?.total_tokens) || 0),
        ),
        engine: "openrouter",
      };
    }
  };
}
