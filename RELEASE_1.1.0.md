# RevUpTime 1.1.0 — Android release preparation

Prepared 27 October 2026. Android versionCode 11; package remains `com.revuptime.mobile`.

## Included updates

- Approved navy circular mark and blue pulse/arrow launcher icon on white, with an Android adaptive foreground padded for launcher masks. App display name remains RevUpTime.
- Latest approved Home design and header logo, Devices bottom tab, and top-right Alerts entry.
- Existing operational dashboard, calculated machine health, point readings/history, alerts, work orders, reports and synced read-only Inbox updates.
- Existing workspace RAG, document upload/replacement/indexing, cited local excerpts, saved citations and PDF previews.
- Existing authentication, account recovery and unrelated mobile functionality are retained.

## Files changed for this release

- `assets/branding/launcher-mark.png`: approved symbol extracted using the built-in image tool. Original approved mockup remains in the Codex generated-images folder.
- `assets/branding/app-icon.png`: 1024x1024 opaque app icon.
- `assets/branding/adaptive-icon.png`: 1024x1024 transparent Android foreground; meaningful alpha bounds x222–801, y254–777.
- `assets/branding/favicon.png`: 48x48 web icon.
- `app.json`: icons, version 1.1.0 and versionCode 11.
- `package.json`, `package-lock.json`: matching package version.
- `eas.json`: explicit existing HTTPS RAG origin for installed builds; existing preview APK profile and signing identity retained.
- `scripts/build-app-icons.cjs`: reproducible platform icon resizing and composition.
- `scripts/stage-android-release.cjs`: verifies staged mobile files byte-for-byte; excludes local environment files and provider secrets.

## Validation

- `npm run typecheck`: passed.
- `npm test`: 40 passed.
- `npx playwright test`: 12 passed; 2 demo-only journeys skipped in live-account configuration. Browser API workflows use fixtures rather than live production writes.
- Android release Hermes bundle export: passed, 1,588 modules, under `output/release-1.1.0-android`.
- Launcher assets inspected visually; sizes verified; legacy app icon has zero nonopaque pixels.
- 137 mobile/configuration assets staged and checked against originals. Hash manifest: `output/release-1.1.0-staging.json`.

## Build status

The user explicitly approved uploading the mobile source code to Expo account `bahu007` and building the signed Android APK, selecting **Approve source upload to Expo and build APK**. The signed build finished successfully on 27 October 2026 at 12:50 PM IST using the existing `preview` APK profile and remote Android keystore. No Play Store submission was performed.

- Build: `3ebab63c-6ae7-4a8b-a302-08304bb5cdcc`.
- Expo confirmed app version **1.1.0** and Android build **11**.
- Download: https://expo.dev/artifacts/eas/2fk8wURgxtiQl36DJSjfEFoClOx0A7e9zWTwKpZZyRY.apk
- Build page: https://expo.dev/accounts/bahu007/projects/revuptime/builds/3ebab63c-6ae7-4a8b-a302-08304bb5cdcc
- Result metadata: `output/release-1.1.0-build-result.json`.
- Installation QR: `output/revuptime-1.1.0-apk-install-qr.png`.
- Self-contained installation page: `output/revuptime-1.1.0-install.html`.

The APK can be installed over the existing app using Android's Update action. The phone does not need Expo Go or a connection to the development computer.

Downloaded artifact verification passed: all 1,384 archive entries passed CRC checks, Android executable/manifest/compiled launcher resources are present, and embedded configuration confirms `com.revuptime.mobile`, version 1.1.0 and versionCode 11. The local installer is `output/RevUpTime-1.1.0.apk` (116,603,336 bytes). SHA-256: `2eb5ced7ef2a9d2e9304897b57277855d6c0f3fcf71049581ac9d7f2d26a0e1c`. Full results are in `output/release-1.1.0-apk-verification.json`.

## Backend and device limits

The installed app uses the existing authenticated HTTPS backend; local development AI URLs are guarded by `__DEV__`. No provider credentials are embedded and no sharing permissions were enabled. Live AI/vector generation, push delivery and physical-device acceptance are not newly verified by this release. Advanced provisioning, team administration and Inbox sending retain their existing SaaS links. See `RAG_MOBILE.md` and `MOBILE_UI_UPDATE.md` for detailed behavior and limits.
