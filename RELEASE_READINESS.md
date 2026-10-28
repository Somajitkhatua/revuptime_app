# RevUpTime 1.0.9 — 22 October 2026

Android versionCode: 10. This update improves reliability and recovery; it is not a claim of zero defects or production certification.

## Implemented

- Includes the existing local login permission recovery, clock-skew handling, session refresh-loop fix and bounded AI response-body timeout in the next APK.
- Shared screen/form errors translate transport and database failures into useful guidance. A route error boundary offers recovery. Initial account loading stops showing an indefinite spinner after 20 seconds and allows sign-in recovery.
- Write controls match the live database's Owner/Admin/Manager/Technician role list. Operator, Engineer and Viewer accounts no longer see actions the database rejects.
- Canonical charts sample the entire selected period on the server. Scalar peaks and endpoints survive both server and visual sampling. Averages are labelled as sample averages. Latest readings are selected per sensor/metric/unit rather than from a fixed 100-row slice; zero values remain valid. Missing temperature values are not plotted as zero.
- Document uploads start the canonical processor. Queued, failed and stalled jobs can be retried without uploading duplicate files. Readable PDFs produce page-preserving chunks; status completion and chunk replacement are atomic. Five-minute processing leases prevent simultaneous or stale workers from overwriting a newer job.
- AI retrieves up to six matching passages from ready, unarchived documents for the selected workspace and machine. Evidence links include original page numbers. Missing passages remain explicit, and structured references to unreturned pages are rejected. Text retrieval does not require an embedding provider.
- Notification taps are handled after login, including cold launches. Browser/Expo Go previews describe push availability instead of offering an unsupported registration action. Registration verifies the signed-in identity and confirms the profile write.
- Headers allow wrapping actions; timestamps use the device's timezone. Android uses keyboard resize. Unused microphone permission is disabled in the app configuration.
- Metro excludes temporary test/output folders. Browser tests start and wait for the preview server. Expo is updated to the compatible 55.0.32 patch. Production builds inherit the canonical backend environment explicitly.

## Approved live backend changes

Migration `reliability_telemetry_document_processing` was applied after explicit approval. Source: `supabase/reliability-update.sql`.

Deployed with JWT verification enabled: `asset-summary` version 8, `asset-ai` version 5, `process-document` version 1. Each function also checks the authenticated user and workspace access. The document worker RPCs are restricted to service_role; chart/search functions retain table RLS through SECURITY INVOKER. Document chunk writes now enforce verified write membership for Viewers and other read-only roles.

No existing application records were migrated, deleted or reprocessed. Synthetic verification records were rolled back.

## Verification

- TypeScript passed.
- All 24 logic/backend tests passed, including processing authorization, page preservation, invalid citations, chart spikes and role controls.
- Browser suite: 7 passed, 2 demo-only workflows skipped under the live configuration. A focused follow-up also passed document retry after a simulated 503 with no duplicate document writes.
- Android, iOS and web exports passed after the final app/dependency changes (`output/reliability-export.log`).
- Transactional database checks passed before and after deployment: full chart-window coverage, scalar peak preservation, slow sensor visibility, zero values, workspace isolation, worker leases, manual search and Viewer write protection (`scripts/verify-reliability.sql`).
- All three deployed endpoints reject unauthenticated requests with HTTP 401.
- The updated handler completed one actual free-provider request using synthetic machine records (HTTP 200, usable answer, about 6.4 seconds). This checks the local server credential, not the remote project secret.
- The local preview is running on port 8082 and authenticated local AI on loopback port 8787.
- Phone-width screenshots reviewed: `output/ai-work-order-draft.png`, `output/document-processing-ready.png`.
- Dependency tree resolves successfully (`npm ls --depth=0`). Compatible dependency fixes were applied without forced major upgrades. The audit still reports 31 advisories (10 moderate, 21 high); these require compatibility review and are not represented as resolved.

## Remaining requirements

- **Production AI:** verify that a valid server-only `OPENROUTER_API_KEY` is configured on the deployed project and make an authenticated request from the installed app. Local AI success does not prove the remote secret exists. No provider credentials were copied into mobile code or changed remotely in this update.
- **OCR:** images and scanned PDFs need server-only `OCR_URL` and `OCR_API_KEY`. Searchable PDFs work through the new processor; unreadable files keep their original download and show an actionable processing message.
- **Push delivery:** canonical compatibility fixes are prepared in the dispatcher source, but it is not deployed or wired to webhooks in this update. Server webhook secret/configuration, delivery receipts, durable retries/deduplication and physical-phone delivery tests remain required. In-app alerts remain available.
- **Hardware:** certificate/policy pages display recorded device metadata. Provisioning hardware, renewing device certificates, deploying policies and configuring trusted sensor ingestion require the actual device infrastructure and credentials; these actions were not fabricated.
- **Accounts:** real inbox verification/reset delivery and cross-device session recovery still need live acceptance testing. Supabase's existing leaked-password-protection warning remains; account settings were not changed.
- **Release:** physical Android/iOS validation of camera, gallery, notifications, keyboard, small screens and interrupted connectivity remains necessary. JavaScript exports are not device tests. No app-store publishing was performed.

The signed Android APK finished successfully: version 1.0.9 / versionCode 10, build `e8dbf287-0e61-4245-9b97-c4db84c2dc19`. Final metadata is saved in `output/reliability-build-result.json`.

Download: https://expo.dev/artifacts/eas/L8ELtyEDKcBO_xE-peBGCQu-DyxCXI8jfQ6dhJEeXcg.apk

The build upload used a temporary staging directory outside the project after correcting the initial self-copy error. The original package and signing credentials are preserved for upgrading the existing installation. Confirm Profile shows 1.0.9 after installing.
