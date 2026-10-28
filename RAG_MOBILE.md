# Mobile workspace knowledge — 24 October 2026

Implemented against `mahabahubehera-dev/app.revuptime.com`, branch `Dev`, exact commit `8d91c3d9f531f7b462abcc334b91f0a197cbfe2c`. The reference checkout is in `output/rag-web-reference`; it is excluded from the mobile TypeScript project and Metro watches.

## Using the feature

Open RevUpTime AI. The default answer mode is **Workspace documents and machine data**. Choose all plants/machines or a narrower scope. **View workspace documents** opens the document list; authorized users can upload workspace-wide or machine-specific documents. A replacement starts from the document detail page.

Uploads support PDF, DOCX, TXT, Markdown (`.md`/`.markdown`), CSV, TSV, JSON and log files, up to 15 MB. Existing camera/photo attachments remain available; images and scanned PDFs require OCR before knowledge indexing. Text Markdown/data formats are sent as `text/plain` so the reference extractor also accepts `.markdown`.

Saving calls `documents/index`. If the server reports `embedding_pending`, successive `documents/embed` requests continue until `remaining` is zero. Progress appears on the upload/detail screen. Interrupted batches keep their server checkpoints; **Resume vectors** continues without uploading or reindexing. These requests run while the screen is open, rather than as a background worker. Text indexing can be retried independently if the saved upload's indexing failed.

Replacement uses the same document ID, increments the current numeric version, uploads a unique new storage path and sets `index_status: pending`. The update compares the previous storage path to prevent overwriting a simultaneous replacement. The reference backend excludes pending and superseded content. The original storage object is retained.

The app sends the signed-in session Bearer token to the existing backend. Workspace requests contain organization, question, optional site/asset scope and at most eight bounded user/assistant messages. General requests use their separate endpoint and exclude workspace scope. Conversation history and citation snapshots are stored on this device under account/organization/mode-specific keys. Existing maintenance conversations and work-order drafts remain available through **Maintenance assistant and work-order drafts**.

Sources expose original labels, IDs, document versions/pages/chunks, timestamps and excerpts. Measurement quality, missing axes and freshness disclosures are displayed as returned, without converting missing readings to zero. PDF previews send the citation's original `source_path` to `documents/page`; recommended previews open automatically. The full-screen preview supports zoom buttons, scroll/pan and iOS pinch zoom. Replaced-file HTTP 409 messages ask the user to ask again for the current version.

## Configuration

The mobile public setting `EXPO_PUBLIC_RAG_API_URL` is the web application's origin without `/api/ai`; default: `https://app.revuptime.com`. Native builds use that origin directly. The Expo development web preview proxies `/api/rag/*` to the same backend through Metro. This is separate from the older `EXPO_PUBLIC_AI_API_URL` maintenance assistant setting.

Use the same Supabase project and canonical schema as the web backend. The private bucket is **`revuptime-documents`**, matching the backend's enforced bucket and organization-prefixed paths. Existing documents in the earlier `asset-documents` bucket remain viewable. Replace an earlier file with the same file to move its current version into the supported bucket and enable workspace indexing/page previews; the detail page explains this requirement. No bulk migration, policy changes or backend deployment was performed.

Local document retrieval needs the existing authenticated backend, database/storage policies, text extraction dependencies and retrieval RPCs. Chunking (1,800 characters, 250-character overlap), keyword retrieval, current-file checks and fresh per-question machine queries stay on the reference backend.

Optional server-only settings, as described in the web repository's `RAG-SETUP.md`:

- AI-written summaries: `OPENROUTER_API_KEY`, an allowed `OPENROUTER_MODEL`, `AI_ALLOW_LIVE_DATA=true`, and explicit organization authorization in `AI_ALLOWED_ORGANIZATION_IDS`.
- Semantic vectors: additionally `AI_ALLOW_EMBEDDINGS=true`, `EMBEDDING_API_KEY`, and `EMBEDDING_MODEL`.
- General AI uses the backend's configured provider/model and its existing free-model restriction.

No provider keys belong in `EXPO_PUBLIC_*` variables. No credentials or sharing permissions were changed. Without AI configuration or sharing permission, the backend returns cited source excerpts, which the app explicitly labels **no AI-written summary**. Provider configuration errors are translated into readable guidance.

## Validation

- `npm run typecheck`: passed.
- `npm test`: 35 passed, including the new file-limit, bounded-history, isolation and resumable-indexing tests.
- `npx playwright test`: 11 passed, 2 demo-only tests skipped under the configured live-account mode. Browser API responses were intercepted; these are not live provider or database tests.
- Mobile-width browser journeys cover authenticated upload/indexing, successive vector batches, stable-ID/versioned replacement, old PDF citation rejection, citation history after reload, fresh changed reading values/timestamps, local excerpts, drawing preview/zoom, denied and expired sessions, general-mode isolation/configuration guidance, network failure, cancellation and question retention. Existing maintenance chat/drafts, assets, accounts, profiles and navigation also pass.
- The exact reference backend's 24 selected tests passed using its isolated locked dependencies. They cover actual DOCX extraction and PDF rendering; organization membership denial; scoped/current-file retrieval; replacement failures; fresh sensor reads and quality/unavailable axes; no-credential/no-sharing excerpt fallback; valid citations; resumable vector checkpoints; and chunk overlap. Database/provider calls in these tests are fixtures, not live services.
- The deployed `https://app.revuptime.com/api/ai/knowledge-chat` endpoint was checked without credentials and returned HTTP 401. No authenticated production uploads, machine writes or provider requests were performed.
- Android/iOS Hermes bundles and web export generated with `npm run export -- --output-dir output/rag-export --max-workers 1`. An initial parallel attempt exceeded system memory; the one-worker build passed. These are compiled bundles, not a newly signed APK/IPA or physical-device acceptance tests.

Live AI-written answers, paid/provider vector generation and cross-organization access with two real accounts remain unverified. Sign in with authorized test accounts to perform live acceptance after confirming backend configuration. Physical Android/iOS upload pickers, keyboard interaction and drawing gestures still need device testing.

## Changed files

| Files | Purpose |
| --- | --- |
| `app/(tabs)/ai.tsx` | Default workspace chat, separate general mode, scoped local history, cancel/retry |
| `services/knowledge.ts`, `utils/knowledge.ts`, `types/knowledge.ts` | Authenticated API contract, deadlines, messages/sources, file rules, vector batching |
| `components/KnowledgeSources.tsx` | Expandable citation snapshots and private PDF preview/zoom |
| `services/documents.ts`, `services/canonical.ts`, `types/models.ts` | Private workspace uploads, replacements, indexing, bucket/status metadata |
| `app/document/upload.tsx`, `app/document/[id].tsx` | Upload/replace, progress, resume/index controls, OCR guidance |
| `app/asset/documents.tsx`, `hooks/queries.ts` | Workspace-wide document browsing and machine document lists |
| `components/MaintenanceChat.tsx`, `app/maintenance-chat.tsx` | Preserve existing maintenance chat/draft behavior on its own route |
| `metro.config.cjs`, `.env.example`, `tsconfig.json` | Public backend origin/proxy and isolated reference checkout |
| `tests/knowledge.test.ts`, `tests/e2e/knowledge.spec.ts`, `package.json` | New RAG checks and inclusion in the normal logic suite |
| `tests/e2e/ai.spec.ts`, `tests/e2e/profile-assets.spec.ts` | Existing regression checks adapted to the maintenance route and document indexing endpoint |
| `RAG_MOBILE.md` | Configuration, behavior and validation record |

Dashboard metric calculations were not changed. No new mobile dependencies were added.
