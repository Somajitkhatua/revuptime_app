# RevUpTime maintenance assistant

## Local development without deployment (15 October 2026)

`npm run ai:local` starts the existing authenticated assistant handler as a Node server on `http://127.0.0.1:8787`. It uses `.env` for the existing public Supabase settings and `.env.ai.local` for server-only `OPENROUTER_API_KEY` and `OPENROUTER_MODEL`. The secret file is ignored by Git, excluded by `.easignore`, and is not an Expo-loaded environment file. Never place the provider key in `.env.local` or an `EXPO_PUBLIC_` variable.

`.env.local` contains only `EXPO_PUBLIC_AI_API_URL=http://127.0.0.1:8787`. The development app sends its Supabase session token to this local handler. Production bundles ignore this development URL. Removing this public URL restores the existing deployed-function transport. No remote configuration/deployment or APK build is required for local testing.

On web, local assistant requests use `/api/local-ai/asset-summary` on the app's own origin. Metro proxies these requests to the loopback backend on port 8787, preserving authentication. This avoids a separate browser connection to a second loopback origin in embedded previews. Native previews continue to use the configured public development URL directly.

Start both the browser app and authenticated AI backend together with `npm run dev`. Stop existing servers on ports 8082 and 8787 first. Closing this command stops both services. Starting only `npm run web` does not start the AI backend and causes local assistant requests to fail.

The local configuration uses the requested `OPENROUTER_MODEL=nvidia/nemotron-3-ultra-550b-a55b:free`. This free model remains subject to provider availability, timeouts and rate limits; no paid fallback is configured. The local `/health` endpoint reports the active model without exposing credentials.

Alternatively, use two PowerShell terminals in this project:

```powershell
# Terminal 1: authenticated local AI backend
npm run ai:local
```

```powershell
# Terminal 2: restart Expo after changing the local URL
npm run web -- --port 8082
```

Sign in at http://localhost:8082 and open RevUpTime AI. The backend still enforces the existing Supabase verification, workspace/asset access and private chat policies. Its `/health` endpoint reports only readiness, never credentials. There is no fake response mode or authentication bypass.

For a phone preview, set server-only `AI_LOCAL_HOST=0.0.0.0`, use the PC's reachable LAN IP in the public AI URL, and restart both processes; `127.0.0.1` on a phone refers to the phone itself. Keep the server confined to a trusted development network. Replace any key shared in chat in OpenRouter and update only `.env.ai.local`, then restart the local server.

The existing Expo project and authenticated `asset-summary` function now support OpenRouter. `asset-ai` remains an alias to the same implementation, not a second AI backend. The default model is `nvidia/nemotron-3-ultra-550b-a55b:free`.

## Enable model responses

1. Open https://supabase.com/dashboard/project/rdmpjlaffzudjcchkxuh/functions/secrets .
2. Add the server secret `OPENROUTER_API_KEY` using your OpenRouter key. Do not put this key in `.env`, `eas.json`, an `EXPO_PUBLIC_` variable, or mobile code.
3. Optionally set server secret `OPENROUTER_MODEL` to the exact model above. Do not configure a paid fallback without reviewing its cost.
4. Sign in with a verified RevUpTime account, open an asset's AI Insights, and ask the assistant a question. Insights are available without the provider key; model requests report a configuration error when it is missing. Adding the secret requires no new APK.

Supabase secrets documentation: https://supabase.com/docs/guides/functions/secrets . OpenRouter request and error documentation: https://openrouter.ai/docs/api_reference/overview and https://openrouter.ai/docs/api_reference/errors-and-debugging . A free model can still be rate limited or temporarily unavailable.

## Data and access

All requests validate the Supabase session and verified email, read the asset under the caller's RLS permissions, and check active organization membership. Conversation IDs must belong to that user, asset and organization. Existing restrictive chat policies keep conversations private. No service-role key is used by this assistant.

The backend retrieves seven days of actual telemetry (latest 1,000 records; truncation disclosed), up to 20 active alerts with total count, sensor status, configured asset rules, ten maintenance events and 50 document records. It separates sensor IDs and units, preserves real zero values, rejects missing/nonfinite/bad-quality measurements, and computes count, average, range and first-to-latest changes. A change is not a diagnosis. Only explicit metric/operator/threshold/unit rules are evaluated; unknown formats are not interpreted as thresholds. Old timestamps and missing measurements are explicit. Latest asset readings can be older than 24 hours and display their recorded times rather than disappearing silently.

`services/aiService.ts` exposes `sendChatMessage`, `getChatHistory`, `getMachineInsights`, `getMachineDocuments` and `createWorkOrderDraft`. Request actions are `chat`, `insights` and `draft`. Failed provider calls do not save a successful answer; there is no automatic provider retry that could duplicate a charge. Older APKs without an action retain labelled stored summaries when a provider key is absent.

The model receives selected authorized records through OpenRouter, never provider credentials or unrelated machines. Document names, records and prior messages are treated as untrusted context. Returned explanatory text still requires engineering review; measured values displayed in Insights come from the backend calculation.

## Manual Q&A — updated 22 October 2026

The canonical `process-document` function now extracts searchable PDFs and saves page-preserving chunks. It authenticates the verified user, checks active workspace membership and write permissions, then claims a five-minute processing lease. A service-only completion RPC replaces chunks and marks the document ready in one transaction. Stale workers cannot overwrite a newer job. The client can retry queued, failed and stalled jobs without uploading the file again.

Retrieval uses the existing Postgres text-search route, now limited to ready, unarchived documents in the authorized organization and selected machine. Up to six matching passages are supplied to the model with real page numbers. The native evidence links open the original document. Unmatched manual requests remain explicit; structured references to unreturned pages are rejected. This is text retrieval; no paid embedding provider or vector-indexing dependency was added.

Image uploads and scanned PDFs require the administrator's server-only `OCR_URL` and `OCR_API_KEY`. Files remain available to open when text recognition is not configured. PDFs larger than 20 MB or more than 400 chunks must be split. Background workers are bounded by Edge Function limits; jobs interrupted before completion become retryable after five minutes.

Deployed: `asset-summary` version 8, `asset-ai` version 5, `process-document` version 1. All retain JWT verification and perform application-level access checks. Production model credentials and actual phone delivery still require live verification; a working local provider does not prove that a remote secret exists.

## Work-order approval

Selecting **Create Work Order with AI** generates and validates an editable title, description and priority. **Review Work Order Draft** opens the existing work-order form. No work order is saved, assigned or executed by the AI endpoint. Only the user's **Create Work Order** action writes it through the existing service, with normal permission checks and query refresh. Viewer accounts cannot generate/save drafts.

## Run this existing app

From this project directory in PowerShell:

```powershell
npm install
npm run typecheck
npm test
npx expo start --go --tunnel --port 8083
```

Scan the terminal QR in an Expo Go version compatible with SDK 55. LAN alternative: `npm run go` on a reachable network. Browser preview: `npm run web -- --port 8082`. Standalone APKs do not require Expo Go. Android/iOS physical-device checks and a real OpenRouter request require the configured server key and remain distinct from fixture-based automated tests.
