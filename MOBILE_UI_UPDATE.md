# Mobile operational UI update — 26 October 2026

Implemented the approved navy/blue card design locally. No APK/IPA build, cloud build, deployment or publishing was performed. Package version remains 1.0.9 until release is requested.

## Review locally

- Working app: http://localhost:8082/dashboard (use your existing sign-in).
- Offline visual review: `output/mobile-ui-preview.html`, a self-contained HTML file with embedded screenshots.
- Overview image: `output/mobile-ui-board.png`.
- Screenshots: `output/mobile-ui-home.png`, `output/mobile-ui-machine.png`, `output/mobile-ui-alerts.png`, `output/mobile-ui-work.png`.
- Screenshot data is a browser test workspace, not the user's live measurements. The running app uses the signed-in user's existing backend.

## Implemented

- Five daily tabs: Home, Assets, Devices, Work, More. Alerts is available from the top-right bell and Home alert cards. AI remains under More and contextual shortcuts.
- Home: the selected navy health hero and circular score indicator, plant scope, fetch status/refresh, three compact alert/work/sensor cards, attention items and AI/document/work quick actions. All values use scoped workspace data. The concept image’s illustrative weekly improvement is not fabricated.
- SaaS data integration: existing authenticated `page_overview(p_org)` RPC for `asset_health`, `point_vitals`, gateways and daily point readings. Asset lists and machine details map calculated health when available. Missing operational schema is disclosed and existing sensor-only screens remain usable.
- Machine: compact header/status, measurement-point selection, driving point default, velocity/temperature with source time, explicit stale/missing states, configured zones, 24H/7D/30D history, configured threshold overlay, point comparison and sensor installation history. Existing Details, Alarms, Data Explorer, Timeline, Documents, AI and maintenance actions remain.
- Alerts: severity cards, measurement/limit disclosures, search/status/severity filters, scoped gateway alerts, drill-through to existing acknowledgement and work-order actions. The adapter now reads direct SaaS value/unit/threshold fields as well as legacy evidence and does not invent zero values when absent.
- Work: assigned/all/completed filters, search and active/status filters, priority/status cards, checklist progress, due/overdue calendar dates, assignee labels and existing work creation/completion routes. Cancelled/closed work is excluded from active lists.
- More: AI, Documents, Reports, authorized Inbox, Devices, Measurement points, Alert rules, Organization/team, Plants, Notifications and Help.
- Reports: current operational summary, selected-plant health, measured daily point trends and native/web system sharing of the summary. Chart period does not mislabel current counts as historical totals.
- Inbox: authorized read-only synced conversation list, unread filter and message history. Reading does not silently mark conversations read. Reply/assignment controls open the existing SaaS Inbox.
- Operational settings: point/limit/sensor inspection and role-checked alert-rule enable/disable controls; advanced point, device and vibration setup opens the existing SaaS tools.
- Device list: current reporting status and last-seen information, links to existing details/certificates/policies and SaaS setup.
- Refresh: 30-second overview polling, realtime invalidation for gateway/point/installation and existing data changes, app-foreground refresh, scope-correct realtime filters.

## Validation

- `npm run typecheck`: passed.
- `npm test`: 40 passed.
- `npx playwright test`: 12 passed; 2 demo-only journeys skipped because the preview is configured for live-account mode.
- New 390px browser journey verifies six KPI values, computed health overriding an old metadata score, scoped authenticated requests, point/zone rendering, sensor history, checklist progress, five-tab navigation, Reports and Inbox, refreshed measurement values, no unintended database writes and no runtime/text-node errors.
- Existing browser tests pass for accounts, permission recovery, assets/multi-axis data, profile changes, RAG upload/replacement/citations/PDF zoom, cancellation/retry and maintenance AI drafts.
- Live backend schema was inspected read-only: `page_overview` and `point_daily` exist, permit authenticated callers and use SECURITY INVOKER; `asset_health` and `point_vitals` are security-invoker views. No schema, RLS, production records, sharing permissions or credentials were changed.
- Browser workflows use intercepted authenticated fixtures; real cross-account and physical-device acceptance remain separate checks. No signed APK was generated, as requested.

## Limits retained for review

This delivers the phone UI and connected daily operational screens. Advanced gateway provisioning, sensor installation/replacement mutations, organization switching, team invitation/role editing and sending Inbox messages remain in the SaaS tools; they are linked explicitly rather than represented as working native forms. Existing mobile profile/plant/document/work-order functionality remains available. AI provider availability, WhatsApp delivery and device push were not newly claimed or configured.

## Main changed files

`app/(tabs)/dashboard.tsx`, `app/(tabs)/alerts.tsx`, `app/(tabs)/work-orders.tsx`, `app/(tabs)/_layout.tsx`, `app/(tabs)/more.tsx`, `app/(tabs)/devices.tsx`, `app/asset/[id].tsx`, `app/alert/[id].tsx`, `app/reports.tsx`, `app/inbox.tsx`, `app/settings/operations.tsx`, `components/OperationsUI.tsx`, `components/OperationalCards.tsx`, `components/MachineOperations.tsx`, `components/MainNavigation.tsx`, `components/DashboardHeader.tsx`, `components/ui.tsx`, `hooks/queries.ts`, `hooks/devices.ts`, `services/operations.ts`, `services/inbox.ts`, `services/canonical.ts`, `types/models.ts`, `types/operations.ts`, `utils/operations.ts`, `constants/navigation.ts`, `tsconfig.json`, `package.json`, `tests/operations.test.ts` and updated/new browser regression tests.

## Selected Home design revision

Applied the first selected Home reference with a white header, navy gradient health card, score ring, condition counts, compact metrics, attention items and quick actions. Devices replaces Alerts in both shared bottom navigation implementations; the top-right Alerts bell includes the current scoped open-alert count. The status-bar colors follow the Home header. `output/home-ui-preview.html` is the updated self-contained Home review file at 390px and 320px. No app installer or deployment was produced.
