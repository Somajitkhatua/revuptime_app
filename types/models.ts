export type Role =
  | "Owner"
  | "Admin"
  | "Plant Manager"
  | "Maintenance Manager"
  | "Engineer"
  | "Technician"
  | "Operator"
  | "Viewer";
export type Health = "Healthy" | "Warning" | "Critical" | "Not assessed";
export type Severity = "Critical" | "High" | "Warning" | "Info";
export type AlertStatus = "Open" | "Acknowledged" | "Resolved";
export type WorkStatus = "Open" | "In Progress" | "Completed";
export interface TenantRow {
  id: string;
  organization_id: string;
}
export interface Site extends TenantRow {
  name: string;
  location: string;
}
export interface Asset extends TenantRow {
  asset_code?: string;
  site_id: string;
  name: string;
  description: string;
  type: string;
  health: Health;
  health_score: number;
  status: string;
  manufacturer: string;
  model: string;
  serial_number: string;
  power: number;
  rpm: number;
  location: string;
  installed_at: string;
  installation_datetime?: string | null;
  created_at?: string;
  image_url?: string;
}
export interface Reading extends TenantRow {
  sensor_name?: string;
  sensor_readings?: Reading[];
  overall_rms?: number;
  metric_units?: Record<string, string>;
  metric_timestamps?: Record<string, string>;
  sensor_id?: string;
  available_metrics?: string[];
  asset_id: string;
  recorded_at: string;
  x_rms: number;
  y_rms: number;
  z_rms: number;
  temperature: number;
  rpm: number;
}
export interface FeatureWindow extends TenantRow {
  asset_id: string;
  window_start: string;
  window_end: string;
  rms_average: number;
  rms_max: number;
  temperature_average: number;
  anomaly_score: number;
}
export interface AssetAlert extends TenantRow {
  site_id?: string;
  sensor_id?: string;
  gateway_id?: string;
  point_id?: string;
  description?: string;
  asset_id: string;
  title: string;
  severity: Severity;
  status: AlertStatus;
  value: number;
  unit: string;
  threshold: number;
  detected_at: string;
  resolved_at?: string;
}
export interface Task {
  id: string;
  title: string;
  completed: boolean;
}
export interface WorkOrder extends TenantRow {
  site_id?: string;
  raw_status?: string;
  asset_id: string;
  number: string;
  title: string;
  priority: "High" | "Medium" | "Low";
  status: WorkStatus;
  assigned_to: string | null;
  due_date: string;
  created_at: string;
  completed_at?: string;
  tasks: Task[];
  notes: string;
  alert_id?: string;
  result?: Completion;
}
export interface Completion {
  root_cause: string;
  action_taken: string;
  parts_replaced: string;
  downtime_minutes: number;
  final_vibration: number;
  notes: string;
  photos: string[];
}
export interface MaintenanceEvent extends TenantRow {
  asset_id: string;
  work_order_id: string;
  title: string;
  technician: string;
  occurred_at: string;
  root_cause: string;
  before_vibration: number;
  after_vibration: number;
  result?: Completion;
}
export type DocumentStatus =
  | "Not indexed"
  | "Uploading"
  | "Extracting text"
  | "Chunking"
  | "Creating embeddings"
  | "Ready for AI"
  | "Failed"
  | "Queued";
export interface AssetDocument extends TenantRow {
  filename?: string;
  storage_bucket?: string;
  mime_type?: string;
  site_id?: string | null;
  metadata?: Record<string, any>;
  processing_error?: string;
  processing_started_at?: string;
  asset_id: string;
  title: string;
  type: string;
  pages: number | null;
  file_type: string;
  status: DocumentStatus;
  storage_path: string;
  manufacturer: string;
  model: string;
  version: string;
  created_at: string;
}
export interface Evidence {
  kind:
    | "Live sensor evidence"
    | "Historical trend"
    | "OEM/RAG evidence"
    | "Maintenance-history evidence"
    | "AI recommendation";
  text: string;
  sources?: { label: string; document_id?: string; page?: number }[];
}
export interface ChatMessage extends TenantRow {
  session_id?: string;
  draft?: {
    title: string;
    description: string;
    priority: "High" | "Medium" | "Low";
  };
  asset_id: string;
  role: "user" | "assistant";
  content: string;
  evidence?: Evidence[];
  created_at: string;
}
export interface Profile {
  organization_name?: string;
  avatar_path?: string | null;
  avatar_url?: string;
  id: string;
  name: string;
  organization_id: string;
  role: Role;
  email: string;
}
export interface DemoState {
  sites: Site[];
  assets: Asset[];
  readings: Reading[];
  alerts: AssetAlert[];
  workOrders: WorkOrder[];
  documents: AssetDocument[];
  maintenance: MaintenanceEvent[];
  messages: ChatMessage[];
}
