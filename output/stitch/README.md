# RevUpTime login design

Generated in Stitch from the user's supplied industrial maintenance mockup, then implemented natively in `app/login.tsx`.

- Project: https://stitch.withgoogle.com/projects/17913116553095616498
- Design screen: 14f0b659057b4959aec12bfb3b88a775
- Background image screen: f32a7867e2fb4c6ba2029d8438932da4
- Exported source: login.html
- App background: assets/industrial-login.jpg

The native implementation uses the generated background locally, keeps the supplied reference's circular pulse logo and centered wordmark, and retains the existing authentication, recovery and demo handlers. It adapts spacing for short devices and supports scrolling when the keyboard opens.

## Dashboard (screen 2)

- Design screen: 0743a8e4adc34134a6ec8fe2cfb638f8
- Daylight image screen: 5f9c6e27530b4e0cb06b28f2722bf5d0
- Exported source: dashboard.html
- App photo: assets/plant-dashboard.jpg

The dashboard follows the compact mobile mockup with a navy brand bar, rounded main sheet, plant selector, health gauge, refinery photo, health counts, alert rows, and work orders. Values are calculated from the selected plant's dataset rather than the illustrative 53-asset numbers in the design.

## Assets (screen 3)

- Stitch design screen: 5b2e0fb0d8da4324a9b8043eee85c877
- Exported source: assets.html
- Product thumbnails: assets/machines/

Implemented with the shared IndustrialPage shell, reusable health chips and AssetListRow. Search, health filters, equipment-type filter, sorting, and details navigation use real demo asset records. Critical machines receive a blue attention border.

## Asset detail (screen 4)

- Stitch design screen: d0ee84442d8a4990ae7e8b9917d72688
- Motor image screen: bdebf0cf1b754f96b39ebe7e01db839e
- Exported source: asset-detail.html
- Motor image: assets/machines/motor-detail.png

Implemented natively with the shared IndustrialPage shell, motor hero, compact specifications, latest reading rows, five working detail tabs, and bottom navigation. The generated design's unsupported failure-time and confidence predictions were omitted; the existing evidence-based AI flow is retained. All displayed sample values come from the synthetic demo seed.

## Remaining screens (5–12) and utility pages

The remaining native screens follow the supplied mockup and the project's existing Stitch design: trends, alerts, alert detail, work orders, work order detail, completion, documents, and AI chat. Supporting create/upload/history/document/profile/notification/recovery pages share the same rounded sheet and compact form components.

The additional multi-screen Stitch generation timed out after 300 seconds. Read-only recovery did not provide new screen identifiers, so no new Stitch export is claimed here. The working app implementations and their actual browser screenshots are available in output/page-5.png through output/page-19.png, plus output/remaining-pages.html and output/remaining-pages.png.

Shared MonitoringRows and DetailTabs keep list and detail styles consistent. Action footers remain visible for alert and work order controls, and the AI composer stays above the main navigation. Existing mutations, validation, citations, document uploads, and role restrictions are retained.
