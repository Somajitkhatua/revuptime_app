# SaaS and mobile comparison — 26 October 2026

## Inspection scope

Read-only review; no mobile implementation, database changes, deployments or account changes.

- Opened https://app.revuptime.com in Chrome: live site displays sign-in. No authenticated SaaS session was available in the inspection browser. Current tenant values, enabled entitlements, live device connectivity and actual event delivery were not verified.
- Inspected the deployed public bootstrap and entry bundle `/assets/index-BEL3K8e6.js`. Its published dependencies include `PlantCommand-D4aL4Vco.js`, `pointsApi-CoLyYqFB.js`, `opsApi-BdJkanbt.js`, Settings, Inbox, gateways, alerts and asset workspace modules. Retrieved the public PlantCommand/pointsApi/opsApi code for corroboration. A served module establishes deployment of the code, not successful execution for a particular account.
- Compared current SaaS Dev revision `fc32f5eea174d68e8dcc55d75d88d8d36e2f63c4` with mobile source. Earlier mobile RAG work referenced `8d91c3d9f531f7b462abcc334b91f0a197cbfe2c`.
- Inspected mobile Home, Assets, asset details, readings adapters, realtime/query hooks, navigation, device services, organization settings, notifications and previous RAG validation.

## Main finding

Mobile already reads real database sensor data. The largest gap is that mobile Home does not use the SaaS operational dashboard's health/measurement-point data model. Copying the appearance without aligning these data sources could show different scores and statuses for the same machine.

Mobile `services/canonical.ts` derives health from `assets.metadata.health` and `assets.metadata.health_score`. Home averages these stored scores in `components/PlantHealthPanel.tsx`. The newer SaaS overview uses `page_overview`, backed by health and point data; its asset views use `asset_health`, `point_vitals`, `measurement_points` and sensor installation history. Database definitions and access policies must be inspected before adopting these contracts.

## Feature comparison

| Area | Newer SaaS implementation | Current mobile implementation | Proposed mobile change |
| --- | --- | --- | --- |
| Home | Plant health, open alarms, monitored assets, sensors online, gateways online, work orders; needs-attention queue; ISO distribution; asset table; plant/gateway information | Plant health gauge, Healthy/Warning/Critical counts, two recent open alerts, three open work orders | Operational KPI cards, attention-first queue and links to scoped lists |
| Health | Calculated asset/point status; Act, Watch, Good, Offline/no-data; point driving machine status | Asset metadata scores and classifications | Read canonical computed health; disclose unassessed/unavailable states; map status labels consistently |
| Current readings | Point-based vitals with latest time, freshness and per-point identity | Direct and sensor-linked readings, 30-second polling and realtime invalidation on relevant screens | Keep existing supported readings; add point mapping and per-metric age/quality to the dashboard |
| Freshness | Sensor/gateway reporting status, point freshness, no-current-data distinctions | Timestamp display and a fixed older-than-24-hours warning in asset list; invalid readings generally filtered | Use configured reporting intervals; distinguish last received, last valid, stale, offline and absent data |
| Measurement points | Named points, sensor installation/removal/replacement history, worst point and point trends | Sensors are linked to assets; expanded readings grouped by sensor | Point cards and history while preserving existing sensor-only assets |
| Vibration | ISO 20816-3 zone distribution, configured limits/classification, velocity trend annotations | Velocity/RMS readings and sampled metric charts, no equivalent dashboard zone overview | Reuse SaaS calculation/limits contract; do not classify unknown measurements or imply every velocity axis is true RMS |
| Charts | Point comparisons, daily history and limits, richer condition views | 1H/24H/7D/30D ranges, metric and sensor stream selection, latest/sample-average/max | Add point comparison and limit overlays, broader supported metrics and clear timestamps |
| Devices | Gateway/sensor setup, data points, templates, mapping and diagnostics | Sensor/gateway list, detail, recorded certificates/policies | Reporting health first; guided setup/mapping and diagnostics as a later admin flow |
| Alerts | Dedicated operational destination, rules, assignment and work-order links | Alerts and acknowledgement/detail already exist, but Alerts is hidden from bottom tabs | Prominent Alerts with counts, severity/assignment/due filters, clear action links |
| Work orders | Dedicated daily destination | Create/checklist/complete/history implemented; destination hidden from bottom tabs | Make work orders easy to reach; preserve tested completion workflow |
| Inbox | WhatsApp conversation/inbox and human handoff code | Notifications assembled from alerts/orders; no equivalent conversation inbox | Separate authorized Inbox feature; depends on existing server messaging configuration |
| Documents/AI | Workspace RAG, sources, indexing, library | Recently added matching RAG, versioned replacements, progress/resume and PDF previews | Keep; integrate machine/point context and quick access rather than rebuilding |
| Reports | Reports destination and overview print/download | No equivalent dedicated report destination | Start with measured operational reports; AI summaries remain configuration-dependent |
| Workspace/settings | Organization switching/creation, team/roles, plants/areas, documents, data points, rules, notification settings | Organization/team display, profile and plant settings; fewer management flows | Add role-appropriate settings and organization selection where membership supports it |
| Navigation | Overview, Assets, Alerts, Inbox, Work orders, Reports; setup grouped under Settings | Home, Assets, Devices, RevUpTime AI | Suggested phone navigation: Home, Assets, Alerts, Work orders, More; AI, devices, documents, reports and settings available through More/contextual actions |
| Refresh lifecycle | Shared organization channel for selected tables; visible-page polling; overview refreshes every 120 seconds for readings | Per-screen realtime channels; telemetry polling every 30 seconds; no subscription health surfaced | Show connection state; refetch on reconnect/app foreground; scope subscriptions and avoid duplicate/bursty requests |

## Important accuracy and performance considerations

1. A database-backed value is not automatically a current/live value. Preserve source timestamp, valid quality, units and sensor/point identity.
2. The mobile list currently labels selected RMS metrics. Some newer raw velocity fields are visible only in expanded readings. The compact card should display the actual available measurement without inventing an RMS interpretation.
3. Mobile's merged latest reading can contain different per-metric timestamps. A single latest timestamp can overstate the freshness of older values; show age for each relevant measurement.
4. Mobile filters non-good/non-valid readings and does not explain rejected latest samples to the user. A proposed quality indicator should distinguish bad latest input from the last valid historical value.
5. Asset rows each request telemetry and assigned sensors. At larger SaaS scale, prefer the existing aggregated overview/point data contracts with appropriate pagination rather than multiplying per-asset queries.
6. Newer SaaS dashboards are not continuously streaming every reading: the inspected overview uses events for alerts/gateways plus a visible-page 120-second fallback refresh for readings. Define the mobile freshness expectation explicitly and validate it against real ingestion cadence.
7. Health scores/ISO zones are configured operational indicators, not an independently verified diagnosis. Missing limits, stale data and unmapped points must stay explicit.
8. Retain organization/site isolation and backend role enforcement; do not port administrator-only setup actions into every user's daily screen.

## Recommended implementation sequence, pending user instruction

1. **Align readings and health:** inspect backend contracts read-only, select the SaaS health/point sources, map mobile types, validate timestamps/units/quality and organization scope. Compare the same machine and plant in both applications.
2. **Operational Home:** six KPI cards, highest-priority issues, machine status/reading cards, sensor/gateway reporting counts, last-refresh/connection status and scoped drill-down.
3. **Machine workflow:** measurement points, live/stale states, configured vibration zones, sensor history, trends and comparison; retain existing maintenance/documents/AI routes.
4. **Daily navigation:** prominent Alerts and Work orders, badges and role-appropriate More menu. Keep charts and setup adapted for phone interaction rather than shrinking desktop tables.
5. **Additional SaaS sections:** Inbox/WhatsApp, reports, team administration, gateway/data-point setup and notification configuration in separate reviewed increments.

## Live acceptance still required

Review a signed-in SaaS dashboard and mobile account side by side for the same organization/site/asset. Confirm a real new reading appears with the same value, unit and timestamp; observe stale/offline transitions; compare health/zone calculations; verify scoped counts, alert changes and role restrictions. No live authenticated reading comparison was performed during this review.
