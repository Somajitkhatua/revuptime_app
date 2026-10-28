# RevUpTime development status — 8 October 2026

## Account integration update — 9 October 2026

Live Supabase configuration is now present. Signup, email verification/link callback, resend, password login/recovery, and server-side verified workspace provisioning are implemented. Canonical schema adapters, transactional work-order RPCs, protected completion/history, Viewer write restrictions, and private upload buckets are deployed. Existing policies were preserved by using restrictive write policies. Live database tests passed and synthetic records were rolled back; the browser registration/code-verification test passed using intercepted mail requests.

SMTP/template/redirect configuration and real inbox delivery still require verification before claiming public signup is ready. AI/document processing, telemetry ingestion, and push dispatch remain service-deployment work. See `SUPABASE_SETUP.md`; the older audit below is retained as historical context.

The Expo app includes the twelve reference screens and supporting upload, history, profile, recovery, and notification pages. Demo workflows cover asset monitoring, alerts, checklist work orders, completion history, documents, and evidence-based sample AI responses. Demo data persists between sessions.

## Fixes from the final local review

- Native demo attachments copy to app document storage rather than retaining temporary picker paths.
- Maintenance forms reject impossible dates, blank numeric values, negative readings, and invalid asset selections.
- Completion checks the record and checklist before uploading photos, and cannot bypass the outcome form through a status update.
- Viewer accounts cannot use write forms or maintenance mutations; write shortcuts are hidden.
- Missing asset and work-order records display a useful state.

## Live deployment remains unfinished

Read-only inspection of the connected Supabase project `rdmpjlaffzudjcchkxuh` found zero Auth users, empty public tables, and no deployed Edge Functions. Its existing schema uses normalized sensor readings, tasks, and chat sessions, lowercase status/role values, and different document/profile fields from this app's fresh-database schema. The existing project was not overwritten or reset. Do not apply `supabase/schema.sql` over it.

Before live deployment, integrate that schema through tested adapters and transactional server functions, establish the first owner account and workspace, deploy the AI/document/push functions with server secrets, and configure trusted telemetry ingestion. The user supplied `mahabahu.behera@revapex.ai` as the first owner email; no invitation or password has been sent or generated.

## Verification

- TypeScript checks and three domain tests passed.
- Both browser journeys passed against the restarted preview: work-order creation/checklist/completion/history, and alert acknowledgement/AI evidence.
- The executable local SQL checks passed tenant isolation, profile protection, atomic completion, duplicate closure, and Viewer permissions.
- Android and iOS Hermes bundles and the web export succeeded in `dist`; the export log is `output/final-export.log`.
- The 15-screen browser review passed with no captured runtime errors or horizontal overflow; updated previews are in `output/remaining-pages.html` and `output/remaining-pages.png`.

Physical Android/iOS validation and EAS signing/release builds remain required. Expo JavaScript exports are not APK/IPA installers. The reported Android remote-update download failure has not been confirmed resolved on the user's phone. A public tunnel was not enabled.

The preview remains a demo until these deployment steps are completed. Dependency advisories must also be reviewed before release.

## Live workflow verification — 9 October 2026

Added plant creation, machine creation and machine editing. Assets expose Add machine; machine details expose Edit machine; Profile > Sites exposes Add plant. These write to the normalized live schema with tenant filtering and existing verified-member RLS.

Fixed storage upload policy column shadowing: the file path must use storage.objects.name, rather than assets.name. Applied migration 20261009102531_fix_mobile_upload_path.sql. Private image upload was verified through the browser against Supabase.

Checklist mutation success now awaits query refresh before re-enabling input. Live browser checks verified machine creation/editing and work-order creation/checklist/completion. Temporary test documents, machine, work order and maintenance event were removed. The test plant was retained because a separate user-created machine named motor now references it.

New machines without assessments show Not assessed; plant score excludes unassessed machines. TypeScript and four domain tests pass; two auth browser tests pass (two demo-only journeys skipped on the live configuration).

Pending production integrations: custom SMTP and redirect/domain setup, canonical AI/document processing deployment and provider secrets, sensor ingestion, push dispatch and Android credentials, and physical-device/APK verification. Core data forms are available; not every external-service option is operational.

## APK assistant repair — 9 October 2026

The first corrected APK build 83099878-3a0f-46a8-bb3b-939fa95b8692 finished successfully. Its assistant endpoint had not been deployed. User explicitly chose stored-data summaries instead of model-generated AI.

Deployed authenticated asset-summary and backward-compatible asset-ai endpoints. Both authenticate the user with getUser and use the caller's RLS-scoped database client. Summaries use canonical readings, alerts, maintenance and document metadata. Responses disclose missing data and identify themselves as saved-record summaries, not model answers. No document text extraction, generated diagnosis or inferred trend is claimed. Summary requests are bounded to 2,000 characters and ten saved user messages per minute (best-effort application rate limit).

Applied private_machine_chat migration: restrictive policies preserve membership checks while requiring a caller-owned session and consistent machine/site/workspace. Live chat response and persistence after reload were verified in a mobile-sized browser; main routes produced zero page errors. Fixed Android file uploads to read native files via expo-file-system File.arrayBuffer rather than unsupported React Native Blob.arrayBuffer. Historical health charts no longer fabricate scores from vibration in live mode; custom trend dates validate actual calendar dates.

Bumped Android versionCode to 2 and app version to 1.0.1 for the replacement APK. TypeScript, four domain tests, and Android/iOS/web exports passed. Physical-device camera/file-upload behavior still requires testing on the user's phone; no Android device was attached during these checks. External SMTP, processing services, sensor ingestion and push dispatch remain pending.

Replacement build 6af8cecf-a5f9-4080-98c7-e817036fb907 finished successfully. Signed Android APK v1.0.1 (versionCode 2): https://expo.dev/artifacts/eas/PcHYzKpDatSEYXf-qjSPIbBgp_lNuIitJSEi-wMvX2M.apk

Confirmed a fresh live chat POST returned 200 and cleared the composer; the legacy asset-ai endpoint used by the installed prior APK also returned a stored-data summary. Anonymous requests and unavailable machines were rejected. Authentication browser regression tests passed (two); demo-only journeys were skipped (two). The replacement APK still needs installation and phone-specific validation by the user.

## Assignment and Profile fixes — 9 October 2026

Removed an invalid organization_members-to-profiles foreign-key join (PGRST200). Assignee lookup now reads active workspace member IDs and loads permitted profiles separately, excluding Viewer accounts. The live picker showed Somajit Khatua; creating a work order with this assignee saved and displayed correctly, and its temporary test row was deleted.

Profile actions now open visible, scrollable modal panels with Close settings and Android back dismissal. Organization/site query failures and push registration failures are visible in the panel. Add plant and View notifications dismiss the panel before navigation. Help opens an actionable troubleshooting guide. Language accurately shows English as the only supported language. Push registration does not claim server delivery is enabled.

Version 1.0.2 / Android versionCode 3 was submitted as build a812f065-b755-43a1-b5dc-a684cfa21e35. TypeScript and Android/iOS/web exports passed; all five Profile panels opened in a mobile-sized browser test. New team-member assignments need real registered members in this workspace; no fabricated accounts were created.

Build a812f065-b755-43a1-b5dc-a684cfa21e35 finished successfully: APK 1.0.2 (versionCode 3), https://expo.dev/artifacts/eas/oV55V6Im8HxCbkYYYicn3OQqCAX4qOXLLTjOEfkAvkk.apk . Final browser checks also passed Help troubleshooting display, Notifications navigation, and Sites → Add plant navigation. Physical phone installation remains user verification.

## Separate Profile settings pages — 12 October 2026

Replaced Profile modal panels with dedicated routes: /settings/organization, /settings/sites, /settings/notifications, /settings/language and /settings/help. Each uses the existing mobile Screen layout and back navigation. Organization shows workspace/account/role details and assignable members; Sites lists plant details with selection and Add plant; Notifications includes in-app navigation and device registration; Language states current English support; Help includes troubleshooting details.

Live browser verification passed navigation from Profile to all five routes and Back to Profile from each, with zero captured page errors. TypeScript checks passed after Expo regenerated route types. Submitted APK 1.0.3 / Android versionCode 4 as build 6a08d7fb-ccfc-4807-a087-316b2f83ca19.

APK 1.0.3 build 6a08d7fb-ccfc-4807-a087-316b2f83ca19 finished successfully. Download: https://expo.dev/artifacts/eas/BaC_MhtUtsLMihJy7b53PRo55JeEgOb9Jdfx37o6MhU.apk . Android, iOS and web exports passed. Phone installation remains user verification.

## Devices menu and version verification — 12 October 2026

Added an expandable Dashboard Devices option with View devices, Certificates and Policies routes. Device inventory reads the authenticated workspace's sensors and gateways, supports search/type filtering and opens device details. Certificate pages display recorded public certificate metadata; policy pages display recorded protocol/sampling configuration and do not claim hardware provisioning or enforcement. Empty inventories and absent certificate records are explicit. No fabricated hardware was registered.

Profile now displays the version bundled from app.json; package/package-lock versions match 1.0.4. The initial candidate build de50f5b9-16a7-47c4-88fe-e7e6ce5c444c was cancelled to correct the version label. Replacement APK 1.0.4 / Android versionCode 5 is build 41127e2c-1a87-4213-8011-fdb925b8440a.

TypeScript passed. Live mobile-sized browser checks passed Devices/Certificates/Policies navigation, inventory empty-state loading, five separate settings routes and Back navigation, and exact Profile version 1.0.4. Zero page errors captured. Native/web export passed before the final version-label correction; the replacement APK build verifies final native bundling.

Replacement build 41127e2c-1a87-4213-8011-fdb925b8440a finished successfully. Signed APK 1.0.4 / Android versionCode 5: https://expo.dev/artifacts/eas/fpvWu_pCcs8pUROCEh5B9ohO18m2l-sf7qfEtNgrmGk.apk . No USB-connected phone was available to inspect the previously installed app version. Confirm Profile displays App version 1.0.4 after installation.

## Devices bottom navigation — 12 October 2026

Moved Devices into the main tab bar between Assets and Alerts; removed the expandable Dashboard Devices buttons. The Devices screen is now app/(tabs)/devices.tsx; app/devices/index.tsx was removed to avoid duplicate root routes. MainNavigation on detail/settings pages includes Devices and highlights device routes. Devices remains reachable from Certificates/Policies using the bottom bar.

Version 1.0.5 / Android versionCode 6 submitted as build 430e927b-83cc-4651-b14c-7e0e6af84864. TypeScript passed. Focused browser navigation regression passed with mocked authentication/data; it verifies the Devices tab, absence of dashboard buttons and duplicate navigation bars, Certificates navigation, and returning to Home. Live login attempts with the previously supplied password did not reach Dashboard during this check; no account credentials were changed.

Visual review found the six-tab Work Orders label truncating on a 390px screen. Shortened only its visible navigation label to Orders; full Work Orders page title remains. Initial build 430e927b-83cc-4651-b14c-7e0e6af84864 was cancelled and replaced with build 00ee2906-e4ba-4512-9299-203c2b1d6d61. Focused navigation regression passed again, and output/devices-tab-navigation.png confirms all six labels fit: Home, Assets, Devices, Alerts, Orders, AI.

## Grouped device management and simplified navigation — 12 October 2026

Created DeviceSections: a shared Devices/Certificates/Policies section selector with clear active state and icons across all three pages. Removed stacked certificate/policy buttons from inventory. Device management remains a recorded-data view; no certificate provisioning or hardware policy deployment was added.

Bottom navigation now exposes only Home, Assets, Devices and AI. Alerts and work-orders tab routes remain available but are hidden from the bar via href:null. Dashboard bell now opens Alerts; Profile includes Work Orders as a separate navigation action. Detail/settings MainNavigation also uses the four-item bar.

TypeScript passed. Mocked-auth browser regression passed section switching, return to Devices/Home, removal of Orders from the bar, dashboard bell → Alerts, and Profile → Work Orders. Visual review of output/grouped-devices-page.png and output/devices-tab-navigation.png confirmed the grouped device selector and four-item bar fit the mobile viewport. Version 1.0.6 / Android versionCode 7 prepared for the replacement APK.

Submitted replacement APK build aa420221-ca54-4cac-be67-95ca76a5ae11 for version 1.0.6 / versionCode 7 after the navigation checks and visual review passed.

Build aa420221-ca54-4cac-be67-95ca76a5ae11 finished successfully. Signed APK 1.0.6 / Android versionCode 7: https://expo.dev/artifacts/eas/8GlRPYh2Tii1p9VymbSo0R9egxJy9cDnwJC7wdDcl8w.apk . Install over the existing app; Profile should display App version 1.0.6. Physical-phone validation remains user verification.

## Profile photos and expanded asset details — 13 October 2026

Prepared version 1.0.7 / Android versionCode 8. Profile supports gallery photo selection, private owner-scoped uploads and signed image display in Profile and Dashboard. Organization now has workspace details, real team members, counts and plant/machine navigation. Assets include Overview, Details, Alarms, Data Explorer, Timeline and Documents, with location and installation date/time; missing measurements remain explicit.

Applied profile_photos_asset_installation to the connected Supabase project: private profile-photos bucket, owner-only object policies, profiles.avatar_path and assets.installation_datetime. Transactional authenticated database checks verified own-photo access, cross-user denial and installation timestamp writes; all test changes were rolled back.

TypeScript passed again on 13 October. Previous verification of this update passed five domain tests, browser regression (four passed, two demo-only skipped), focused photo/settings/asset checks and Android/iOS/web export. Organization and asset timeline screenshots were visually reviewed. Physical-phone gallery and installation validation remain pending.

Submitted APK 1.0.7 / versionCode 8 as Expo build d9346735-a4c8-41d7-83d5-09b9f307e614. Build is in progress; artifact readiness must be confirmed before distribution.

Build d9346735-a4c8-41d7-83d5-09b9f307e614 finished successfully. Signed APK 1.0.7 / Android versionCode 8: https://expo.dev/artifacts/eas/iwr4FwbZ0eaJWJeSHI9reYdfbCIKmLz66HcWbqz0l_s.apk . Install over the existing app and confirm Profile displays App version 1.0.7. Physical-phone validation remains pending.

## OpenRouter maintenance assistant — 13 October 2026

Prepared version 1.0.8 / Android versionCode 9. Extended the existing asset-summary implementation and asset-ai alias with authenticated OpenRouter chat using server-only OPENROUTER_API_KEY and default nvidia/nemotron-3-ultra-550b-a55b:free. Added plant/machine selection, persistent conversations, new conversation/history, timestamps, native Markdown formatting, explicit retry, machine Insights and editable work-order drafts. Existing work-order form remains the only place to confirm/save a draft; Viewer access is denied server-side.

Measurements are calculated before model explanation: seven-day telemetry, separate sensor/unit streams, real zero values, missing/bad-quality rejection, averages/ranges/changes, supported explicit rule indicators, sensor status and active alerts. Asset pages now preserve latest stored readings with metric timestamps and recorded units rather than hiding data older than 24 hours. Removed unsupported fixed thresholds and the hard-coded bearing fault suggestion. The shared measurement helper lives in utils so it is included in the EAS archive.

Manual-specific questions explicitly report unavailable retrieval and have no fabricated citations. The live project has no indexed chunks or vector-match RPC; canonical indexing/embeddings/retrieval remain documented dependencies in AI_INTEGRATION.md. The legacy document processor was not deployed.

Verification: TypeScript passed; 11 domain/backend tests passed; browser suite 5 passed and 2 demo-only skipped. Tests cover authorization, missing credentials, provider rate limits/network errors, history/follow-up, manual unavailability and draft review without work-order writes. A malformed insights response regression was fixed and the asset/profile flow passed again. Final Android/iOS/web export passed (output/ai-integration-export.log). Deployed endpoints reject missing/invalid sessions with 401 and support OPTIONS. Existing chat restrictive policies were inspected; advisor retains only the pre-existing leaked-password-protection warning.

Supabase deployment: asset-summary version 7, asset-ai version 4, both verify_jwt true. Actual model responses cannot be declared verified without the server key and a live authenticated provider request. Physical Android/iOS testing remains pending. APK 1.0.8 submitted as Expo build d0bd6e02-5e8d-4e89-9b2f-3d816eb78f8a; confirm completion before distributing its artifact.

Recovered disk space by removing generated exports, an old local bundle/duplicate tool ZIP, and the verified Metro cache. Task temporary build storage is D:\RevUpTimeBuildTemp. No application source or account data was deleted.

APK build d0bd6e02-5e8d-4e89-9b2f-3d816eb78f8a finished successfully. Signed APK 1.0.8 / versionCode 9: https://expo.dev/artifacts/eas/cPBpoYuA2S3GYaDjhoOW2AI7LNuk2aJW2O2fvMUKzqg.apk . This installer includes the AI integration; actual OpenRouter responses still require server credentials and live verification. A read-only follow-up confirmed zero temporary chat verification sessions remained after the transactional check's transport interruption.

## Local-only AI activation — 15 October 2026

The reported "AI has not been enabled for this workspace" was the backend's missing provider-key response. Added a local Node HTTP adapter around the existing authenticated assistant handler (npm run ai:local, loopback port 8787). The provider credential is in ignored .env.ai.local, read only by Node; .env.local contains only the development API URL. services/assistantRequest.ts routes development chat/insights to the local server with the existing Supabase session token; production keeps the deployed-function route. No remote secret/configuration change, deployment, version bump or APK build was performed.

Live verification: OpenRouter key accepted (200), requested free model listed, and an actual model request returned the expected verification response (200). Local server /health is ready and configured (200), unauthenticated requests rejected (401), preflight succeeds (200). Checked the served browser bundle: local endpoint present; provider credential absent. No credential values were logged in verification output.

TypeScript and 11 backend/domain tests passed. Asset/profile browser regression passed. Chat browser regression passed against the local transport after the initial cold Metro compile exceeded the first test's timeout; it verifies session-token forwarding, retry/history and draft review without saving a work order. Browser and local AI server are running at localhost:8082 and 127.0.0.1:8787 respectively. The user's live signed-in machine-specific conversation still requires their login in the preview; tests used isolated fixture accounts/data. The supplied key was shared in chat and should be replaced by its owner, updating only the server secret file and restarting the local server.

## Local login profile-permission recovery — 15 October 2026

Reported error: permission denied for function revuptime_account_profile. Read-only database checks showed authenticated EXECUTE on the public/private functions, private schema USAGE, and a verified authenticated account; anonymous EXECUTE remains denied. No database permissions or account data were changed.

Local profile loading now requires the matching signed-in session and explicitly sends its bearer token to the RPC. For only the specific function/schema permission failure, it can load an existing verified account via RLS-protected own-profile and active-membership queries. It preserves inactive/unverified/business-denial checks, does not provision workspaces or assign roles, and derives permissions from membership records rather than editable metadata. Unknown roles fall back to Viewer.

Verification: TypeScript passed; all 15 domain/backend/account tests passed. Four browser authentication tests passed, including the exact denied-function response recovering to Dashboard for an existing verified member, and inactive membership remaining on Login. These are isolated fixture-based sign-ins; the user's actual password was not tested or changed. Restarted the local preview on port 8082; the existing local AI backend remains on 8787. No APK, deployment or remote configuration write was performed.

## Live sign-in refresh loop and AI response completion — 15 October 2026

Live API checks succeeded with the user's previously supplied current credentials and showed correct profile grants, but real browser sign-in revealed repeated token refresh/profile reloads, then refresh-rate-limit and permission errors. Session timing confirmed a 3,600-second JWT appeared expired on this PC because its clock was approximately 3.5 hours ahead of the authentication server.

Local fix: normalize only the refresh-scheduling expires_at metadata of fresh successful Auth HTTP responses using their server-supplied expires_in. Signed JWTs, refresh tokens, server verification, stored old sessions and the machine clock are not altered. AppProvider no longer reloads profiles for TOKEN_REFRESHED notifications, preventing recursive refresh/profile work; stale boot errors are generation-guarded. Real browser login then reached Dashboard with one token request.

AI diagnosis: read-only actual-machine insights returned 200 with provider configured, and browser read-only insights/CORS also returned 200. The single approved real-machine chat attempt timed out and no matching private test chat was found saved. It was not repeated. Further diagnostics used entirely synthetic in-memory machine records. Disabled unnecessary hidden reasoning for the configured free model and bounded both provider fetch and response-body reading with an explicit aborting deadline; malformed bodies receive a clear error. Full synthetic-context request to the real configured provider then completed with a usable answer (200) in about 10 seconds. No paid fallback or model change was introduced.

Verification: TypeScript and all 17 domain/backend/account tests passed, including a stalled-response-body timeout test. Three targeted browser tests passed: skewed-clock permission recovery without repeated token requests, inactive-membership rejection, and synthetic chat/history/retry/draft review. Real user login passed; actual machine insights passed; final model answer verification used synthetic data. scripts/verify-ai-synthetic.ts is an explicitly invoked diagnostic, not an automatic test or public auth bypass. The local AI backend was restarted on 8787; local preview is on 8082. No APK, remote deployment, database grant or password change was performed.

## Reliability update — 22 October 2026

Prepared app 1.0.9 / Android versionCode 10 and applied the explicitly approved canonical migration `reliability_telemetry_document_processing`. Deployed asset-summary v8, asset-ai v5 and process-document v1 with JWT verification. Full-period chart sampling, per-stream latest measurements, page-preserving PDF processing with atomic leases/completion, tenant-scoped text passage retrieval, friendly recovery states and database-aligned edit permissions are implemented. The APK includes the prior local login/session/AI-timeout fixes. Notification cold-launch handling, browser capability guidance, keyboard layout, device-local timestamps and compatible Expo 55.0.32 patch are included.

Verification: TypeScript passed; 24 tests passed; browser suite 7 passed, 2 demo-only skipped. A focused follow-up verified document retry after 503 without duplicate uploads. Android/iOS/web export passed. Synthetic transactional database checks passed both before and after migration with all fixtures rolled back. Unauthenticated deployed endpoints return 401. Production bundle credential check passed. See RELEASE_READINESS.md for remaining real-device/service configuration requirements and unresolved dependency advisories.

An Expo APK build was explicitly approved. The first older-CLI attempt stalled before creating a build and was stopped; retry with EAS CLI 25.3.0 is tracked in output/reliability-build.json. Confirm the artifact is finished before distribution. No app-store submission was requested or performed.

APK 1.0.9 / versionCode 10 accepted by Expo as build e8dbf287-0e61-4245-9b97-c4db84c2dc19. Approved source upload completed; compilation/signing remain in progress. Build page: https://expo.dev/accounts/bahu007/projects/revuptime/builds/e8dbf287-0e61-4245-9b97-c4db84c2dc19 . Local app preview and authenticated AI are running; synthetic-provider verification completed successfully (200, usable answer, approximately 6.4 seconds).

APK build e8dbf287-0e61-4245-9b97-c4db84c2dc19 FINISHED successfully. Signed Android 1.0.9 / versionCode 10: https://expo.dev/artifacts/eas/L8ELtyEDKcBO_xE-peBGCQu-DyxCXI8jfQ6dhJEeXcg.apk . Final build metadata: output/reliability-build-result.json. The upload staging self-copy error was corrected using a temporary directory outside the project. Physical-phone acceptance and the remaining service/security setup in RELEASE_READINESS.md are still required; no zero-defect claim is made.

## Local Assets data display — 22 October 2026

Local preview only, per user instruction; no APK build or backend/data mutation. Read-only Supabase inspection found multi-axis readings with null sensor_readings.asset_id but a valid same-workspace sensors.asset_id assignment for MotorPump. The local telemetry adapter now follows that assignment with explicit organization/sensor/null-asset filters, reads dedicated temperature_c/vx/vy/vz columns and registered units/RMS configuration, and preserves zero values. Historical unassigned rows are paginated when requested within a chart period. Existing asset-linked RPC results remain supported. v_max is not mislabelled as overall RMS.

The Assets board now shows asset code, plant/location, operational status and latest available readings with timestamp/staleness. Plant selection includes All plants and no longer silently chooses the first site. Search includes code/manufacturer/model/location; Not assessed is filterable. Canonical rated power now reads rated_power_kw, including MotorPump's stored 15 kW. Health is not invented from sensor readings. Workspace-scoped realtime invalidation and 30-second polling refresh assets/telemetry locally.

Verification: TypeScript and 27 tests passed. Two focused browser flows passed: board fields/scoped linked queries/zero values/staleness/code search/plant filtering/rated power, and existing profile/asset/document flow. Fixtures reproduce the read-only observed field shape and values; they do not sign into a real user's browser session. Screenshot output/asset-board-local.png is the isolated local layout check. The user must sign in at http://localhost:8082/assets to review their own live workspace. The existing APK remains unchanged at 1.0.9 and does not contain these later local-only changes.

## Local error recovery and complete sensor display — 22 October 2026

Continued local-only work. The user's exact visible error text was requested but has not been supplied; read-only log inspection found API timeout entries. The Assets latest-reading path now uses ordinary workspace/asset/sensor-scoped table reads rather than depending on revuptime_latest_readings. History can recover a missing/denied chart function via paginated, RLS-protected table reads; ordinary table authorization/network failures remain visible and are not bypassed. Failed telemetry polling pauses until retry. Added an explicit Refresh assets and readings control, and paginated asset listing to avoid the first response-page limit.

Added View all readings to each asset and a shared detailed reading panel on machine Overview. It groups each sensor separately and displays temperature, confirmed RMS velocity (or generic velocity when RMS is not confirmed), maximum axis velocity, displacement and acceleration channels, zeros, units and per-measurement timestamps. Unknown displacement/acceleration units remain explicitly 'unit not recorded'; no physical units or health assessments were invented. v_max remains separate from overall RMS. Data Explorer now includes these channels and defaults to seven days so the stored 16 October samples can be found. Asset Details also exposes the stored asset code. All data remains restricted to the signed-in workspace; records were not merged across organizations.

Verification: TypeScript and 29 tests passed. Both focused browser flows passed, including simulated denied summary/chart functions, direct sensor/table scopes, all stored raw channels, missing-unit labels, no browser page errors, filtering/search and zero live writes. Screenshot output/asset-readings-expanded-local.png is an isolated fixture layout check reproducing the observed schema/values, not proof of the user's authenticated browser session. No APK build, remote function deployment, schema change or data mutation was performed.

Visible local UI error identified and fixed: the expanded/retry buttons were nested inside the asset card's navigation button, producing React's '<button> cannot contain a nested <button>' console error and development overlay. Restructured AssetListRow as a noninteractive card with a separate navigation header and sibling controls. The regression now checks console nesting diagnostics and actual button nesting, in addition to page exceptions. TypeScript and the focused board/history test pass after the fix. Supabase was not modified.
