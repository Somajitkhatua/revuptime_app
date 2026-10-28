> Reliability update 1.0.9 (22 October 2026): see `RELEASE_READINESS.md` for shipped changes, verification and remaining service/device requirements. The connected database uses the canonical schema; legacy fresh-database setup below is historical and must not be applied to it.

# RevUpTime

Expo / React Native / TypeScript industrial maintenance application. Runs on iOS, Android, and web, with five navigation tabs and every requested detail/form route.

## Run

```sh
npm ci
npm start
# Browser preview with the local maintenance AI backend
npm run dev
# Browser preview only (does not start the local AI backend)
npm run web
```

Leave both Supabase variables unset to use the **Explore demo workspace** button. Demo actions, alerts, work orders, checklist changes, history, and chat persist in AsyncStorage. The demo dataset has five machines and 169 hourly samples per machine covering seven days. Plant health is calculated from those machines (77%), rather than displaying the illustrative 53-machine summary from the brief.

The phone app is the primary target; the web preview expands to a two-column monitoring dashboard. Charts use react-native-gifted-charts. PDFs and images use the native document/image pickers; nameplates use the camera workflow.

## Open on iOS and Android with Expo Go

Run `npm run go` to start the SDK 55 Expo Go server on port 8083. Connect the phone and computer to the same Wi-Fi. Scan the terminal QR using Expo Go on Android or the Camera on iPhone, then choose Sign In to enter the sample workspace. The browser preview can continue independently on port 8082.

Install the matching Expo Go version from https://expo.dev/go?platform=android&device=true&sdkVersion=55. For physical iPhones, follow https://expo.dev/go?platform=ios&device=true&sdkVersion=55; Expo currently directs SDK 55 users to TestFlight/EAS Go. `npx eas-cli@latest go --sdk-version 55.0.0` requires the user's Expo/Apple team access. No cloud build or signing credentials have been provisioned here.

If the network isolates devices, stop the LAN server and run `npm run go:tunnel` (requires internet and Expo's tunnel dependency). A running PC is required for the Expo Go preview. This is separate from an installed APK/IPA release.

The Expo Go runtime skips remote-notification setup to avoid unsupported native push calls. Device push needs a development build. Camera/photo/file permissions are requested only when used. Bottom navigation respects the device's bottom safe area. Physical phone testing is still required; native compilation and manifest checks are not device tests.

## Connect Supabase

**Existing connected project:** live signup, verification, workspace provisioning, and canonical data adapters now connect to the existing project. See `SUPABASE_SETUP.md` for email delivery and verification setup. The fresh-database instructions below must not be applied over that existing schema.

1. Create a Supabase project. Run `supabase/schema.sql` in its SQL editor on a fresh database. This script has not been applied to any remote project.
2. Invite an account through Supabase Auth. Public signup is intentionally absent. Provision an organization, profile, organization_members row, and site through your trusted administrative service or SQL editor. Roles are stored in membership rows, never user-editable metadata.
3. To load sample server data, replace the user UUID placeholder in `supabase/seed.sql` with that existing Auth user's UUID, then run the seed. The SQL seed includes feature windows used by AI; sample document metadata is queued and must be replaced with actual uploaded files.
4. Copy `.env.example` to `.env` and set the project URL and publishable key. Restart Metro. The mobile client never receives a service-role key or AI provider key.
5. Deploy `asset-ai` and `process-document` Edge Functions with the Supabase CLI. Set their server-only secrets from `supabase/functions.env.example`.
6. Configure `revuptime://forgot-password` in Supabase Auth redirect URLs. For web recovery, change the redirect target to your deployed web origin. Native recovery consumes access and refresh tokens from the callback URL.

Service clients use explicit organization filters in addition to RLS. Composite foreign keys prevent references to another tenant's assets, sites, alerts, and work orders. Membership is provisioned only by trusted servers. RLS makes Viewer read-only for maintenance data. Future granular role rules can build on `private.can_write`. Profiles can only update their own name/push token; clients cannot change organization or role.

Realtime invalidates React Query caches for tenant alerts and work orders. Asset details subscribe to readings only for that selected asset. Historical chart requests use bounded time ranges and server sampling across the full selected period for the canonical schema. Samples retain scalar extrema and period endpoints; displayed averages describe samples. AI Insights separately disclose their bounded recent-record window. Large deployments should add feature-window chart downsampling and telemetry partitioning.

## AI and document processing

The canonical server AI endpoint gathers bounded recent telemetry with explicit truncation disclosure, active alerts, sensor and rule metadata, maintenance events, and up to six matching text passages from processed manuals. It sends summarized context, not raw telemetry history, to the configured AI provider. Responses must include all five evidence sections; document references are checked against retrieved document IDs and pages. Messages are saved with the authenticated user and tenant.

Configure an AI provider with OpenAI-compatible chat-completions and embedding endpoints and a 1,536-dimensional embedding model. The model names and endpoint URLs are deployment choices; none are hard-coded. API keys remain server-only. Requests have a 60-second timeout and a basic user rate limit; add an atomic distributed quota before large-scale deployment.

PDF extraction uses unpdf; page-aware chunks retain source page numbers. Image extraction uses your configured OCR endpoint (`POST multipart file`, response `{text: string}` or `{pages: [{text: string}]}`). Scanned PDFs need OCR preprocessing. The synchronous processor has a 400-chunk limit; move indexing to a durable queue for large manuals. It atomically claims uploads and marks failures; retries are available on document details. UI status polling and Realtime reflect actual processing stages. Demo uploads stay Queued and do not fabricate embeddings.

## Mobile release

Set `EXPO_PUBLIC_EAS_PROJECT_ID` and configure EAS. Build using the provided `eas.json`. Camera/photos and push permissions are requested on demand. Push registration requires a physical device, configured Supabase, and an EAS development/production build. Deploy `dispatch-notification` and configure INSERT database webhooks for alerts/work_orders using a server-only x-webhook-secret matching PUSH_WEBHOOK_SECRET. The dispatcher targets organization members (or the assigned technician) and sends through Expo Push. Add delivery receipts and durable retry/deduplication for production operations. Stored Expo tokens are available in profiles. Notification payloads support `alert_id` and `work_order_id` deep links. The app does not connect directly to MQTT; your trusted ingestion service writes telemetry and feature windows.

## Verification

```sh
npm run typecheck
npm test
npm run test:e2e
npm run export
```

Browser tests use Chrome and a local server at port 8082. They cover creating a work order, all checklist tasks, completion, persisted maintenance history, alert acknowledgement, and AI evidence. Native bundle export confirms JavaScript compilation for iOS and Android; camera, device push, recovery deep links, and native layouts still need physical-device QA.

Deployment is not production-certified without configuring and testing a live Supabase project, testing tenant separation against two real accounts, deploying ingestion/indexing/push services, and validating on devices. Dependency audit results are saved in `output/npm-audit.json`; review Expo tooling advisories before release.

