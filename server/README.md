# SaaS AI provider repair

`openrouter.mjs` replaces the existing module with the same name on the SaaS Node server. It retains the `createOpenRouter` and `DEFAULT_MODEL` exports used by `server/ai-service.mjs`. This directory is server code and is not a mobile API-key store or an alternative client-side AI endpoint.

The default free Super model returned HTTP 404 during a synthetic check on 27 October 2026. With the same valid credential, the free Ultra model returned HTTP 200 and a usable answer. The previous implementation retried the default model against itself and did not fall back on 404. The replacement tries an alternate free model for unavailable/capacity/transport failures, keeps bounded deadlines, and does not retry invalid credentials or permit paid fallbacks.

To repair the deployed SaaS API immediately, set `OPENROUTER_MODEL=nvidia/nemotron-3-ultra-550b-a55b:free` in the existing Coolify application's server environment and restart/redeploy it. Keep the provider key in the server's secret environment. Do not add provider credentials to Expo environment variables. Replace the module in the SaaS source for durable free-model failover; optionally set `OPENROUTER_FALLBACK_MODEL=nvidia/nemotron-3-super-120b-a12b:free`.

Do not change `AI_ALLOW_LIVE_DATA`, `AI_ALLOWED_ORGANIZATION_IDS`, or embedding/sharing settings as part of this repair. These remain separate explicit organization permissions. Workspace keyword lookup must continue to work locally when sharing/provider configuration is unavailable.

The production server's SSH port 22 was unreachable from this environment. This module is prepared locally; deployment is not claimed until verified. The installed mobile app uses that same SaaS API, so the current APK can benefit from the server model change without embedding keys or changing its backend origin.
