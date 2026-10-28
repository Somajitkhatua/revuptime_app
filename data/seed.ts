import { DemoState, Asset, Reading } from "../types/models";
export const DEMO_ORG = "00000000-0000-4000-8000-000000000001";
export const DEMO_SITE = "00000000-0000-4000-8000-000000000002";
export const DEMO_USER = "00000000-0000-4000-8000-000000000003";
export const assetId = (n: number) =>
  `00000000-0000-4000-8000-${String(n + 10).padStart(12, "0")}`;
const date = new Date("2026-10-07T05:12:00Z");
export function createSeed(): DemoState {
  const specs = [
    ["Motor M-01", "Main Conveyor Motor", "Motor", 96, "Healthy"],
    ["Motor M-07", "Cooling Tower Motor", "Motor", 43, "Critical"],
    ["Pump P-04", "Cooling Water Pump", "Pump", 68, "Warning"],
    ["Fan F-02", "ID Fan", "Fan", 91, "Healthy"],
    ["Gearbox GB-01", "Main Drive Gearbox", "Gearbox", 88, "Healthy"],
  ] as const;
  const assets: Asset[] = specs.map((s, i) => ({
    id: assetId(i),
    organization_id: DEMO_ORG,
    site_id: DEMO_SITE,
    name: s[0],
    description: s[1],
    type: s[2],
    health_score: s[3],
    health: s[4],
    status: "Running",
    manufacturer: i === 2 ? "Kirloskar" : "ABB",
    model: "M3BP",
    serial_number: `SN-${4077 + i}`,
    power: 75,
    rpm: 1480,
    location: i === 1 ? "Cooling Tower-1" : "Production Line A",
    installed_at: "2023-03-12",
  }));
  const readings: Reading[] = assets.flatMap((a, ai) =>
    Array.from({ length: 169 }, (_, i) => {
      const t = i / 168;
      const v =
        ai === 1
          ? 3.8 + t * 3.5 + Math.sin(i * 0.6) * 0.24
          : ai === 2
            ? 3.1 + t * 1.2 + Math.sin(i * 0.5) * 0.15
            : 1.8 + Math.sin(i * 0.5) * 0.3;
      return {
        id: `reading-${ai}-${i}`,
        organization_id: DEMO_ORG,
        asset_id: a.id,
        recorded_at: new Date(
          date.getTime() - (168 - i) * 3600000,
        ).toISOString(),
        x_rms: i === 168 && ai === 1 ? 7.3 : +v.toFixed(2),
        y_rms: ai === 1 ? 4.1 : 2.1,
        z_rms: ai === 1 ? 3.2 : 1.6,
        temperature:
          ai === 1
            ? +(53 + t * 8).toFixed(1)
            : ai === 2
              ? +(59 + t * 9).toFixed(1)
              : 44,
        rpm: 1480,
      };
    }),
  );
  const tasks = [
    "Check vibration reading",
    "Check mounting bolts",
    "Inspect lubrication",
    "Check coupling alignment",
    "Check bearing temperature",
    "Record final vibration",
  ];
  return {
    sites: [
      {
        id: DEMO_SITE,
        organization_id: DEMO_ORG,
        name: "Rourkela Plant",
        location: "Odisha, India",
      },
      {
        id: "00000000-0000-4000-8000-000000000004",
        organization_id: DEMO_ORG,
        name: "Jamshedpur Plant",
        location: "Jharkhand, India",
      },
    ],
    assets,
    readings,
    alerts: [
      {
        id: "00000000-0000-4000-8000-000000000030",
        organization_id: DEMO_ORG,
        asset_id: assetId(1),
        title: "High radial vibration",
        severity: "Critical",
        status: "Open",
        value: 7.3,
        unit: "mm/s",
        threshold: 4.5,
        detected_at: date.toISOString(),
      },
      {
        id: "00000000-0000-4000-8000-000000000031",
        organization_id: DEMO_ORG,
        asset_id: assetId(2),
        title: "Temperature rising",
        severity: "Warning",
        status: "Open",
        value: 68,
        unit: "°C",
        threshold: 65,
        detected_at: "2026-10-07T03:51:00Z",
      },
      {
        id: "00000000-0000-4000-8000-000000000032",
        organization_id: DEMO_ORG,
        asset_id: assetId(4),
        title: "Abnormal vibration pattern",
        severity: "High",
        status: "Acknowledged",
        value: 5.6,
        unit: "mm/s",
        threshold: 4.5,
        detected_at: "2026-10-06T12:10:00Z",
      },
      {
        id: "00000000-0000-4000-8000-000000000033",
        organization_id: DEMO_ORG,
        asset_id: assetId(3),
        title: "Sensor offline — connection restored",
        severity: "Info",
        status: "Resolved",
        value: 0,
        unit: "",
        threshold: 0,
        detected_at: "2026-10-06T10:10:00Z",
      },
    ],
    workOrders: [
      {
        id: "00000000-0000-4000-8000-000000000040",
        organization_id: DEMO_ORG,
        asset_id: assetId(1),
        number: "WO-2026-0047",
        title: "Inspect drive-end bearing",
        priority: "High",
        status: "Open",
        assigned_to: DEMO_USER,
        due_date: "2026-10-07",
        created_at: date.toISOString(),
        notes: "Inspect bearing condition after increased radial vibration.",
        tasks: tasks.map((title, i) => ({
          id: `task-47-${i}`,
          title,
          completed: i < 2,
        })),
      },
      {
        id: "00000000-0000-4000-8000-000000000041",
        organization_id: DEMO_ORG,
        asset_id: assetId(2),
        number: "WO-2026-0045",
        title: "Check pump alignment",
        priority: "Medium",
        status: "In Progress",
        assigned_to: DEMO_USER,
        due_date: "2026-10-08",
        created_at: date.toISOString(),
        notes: "Verify coupling alignment and temperature.",
        tasks: tasks
          .slice(0, 4)
          .map((title, i) => ({
            id: `task-45-${i}`,
            title,
            completed: i === 0,
          })),
      },
    ],
    documents: [
      ["ABB Motor Manual", "OEM Manual", 103],
      ["Motor Datasheet", "Datasheet", 4],
      ["Maintenance SOP", "SOP", 12],
      ["Electrical Drawing", "Drawing", 2],
      ["Nameplate Photo", "Nameplate", 1],
    ].map((d, i) => ({
      id: `00000000-0000-4000-8000-${String(50 + i).padStart(12, "0")}`,
      organization_id: DEMO_ORG,
      asset_id: assetId(1),
      title: String(d[0]),
      type: String(d[1]),
      pages: Number(d[2]),
      file_type: i === 4 ? "JPG" : "PDF",
      status: "Ready for AI",
      storage_path: "",
      manufacturer: "ABB",
      model: "M3BP",
      version: "1.0",
      created_at: date.toISOString(),
    })),
    maintenance: [
      {
        id: "event-1",
        organization_id: DEMO_ORG,
        asset_id: assetId(1),
        work_order_id: "WO-2026-0034",
        title: "Bearing lubrication",
        technician: "Rajesh Kumar",
        occurred_at: "2026-09-12T08:00:00Z",
        root_cause: "Lubrication issue",
        before_vibration: 5.8,
        after_vibration: 3.1,
      },
      {
        id: "event-2",
        organization_id: DEMO_ORG,
        asset_id: assetId(1),
        work_order_id: "WO-2026-0019",
        title: "Coupling alignment",
        technician: "Rajesh Kumar",
        occurred_at: "2026-06-17T08:00:00Z",
        root_cause: "Misalignment",
        before_vibration: 6.2,
        after_vibration: 2.8,
      },
    ],
    messages: [],
  };
}
