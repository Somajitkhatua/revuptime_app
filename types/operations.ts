export interface PointVital {
  organization_id: string;
  asset_id: string;
  point_id: string;
  point_name: string;
  sensor_id?: string;
  sensor_name?: string;
  gateway_id?: string;
  position?: string;
  latest_at?: string;
  fresh: boolean;
  velocity: number | null;
  temperature: number | null;
  acceleration?: number | null;
  displacement?: number | null;
  score: number | null;
  status: string;
  zone?: string | null;
  graded?: boolean;
  zone_ab?: number;
  zone_bc?: number;
  zone_cd?: number;
  limit_set_name?: string;
}
export interface AssetHealth {
  organization_id: string;
  asset_id: string;
  score: number | null;
  status: string;
  points: number;
  points_reporting?: number;
  sensors?: number;
  latest_at?: string;
  driven_by_point_id?: string;
  driven_by_point_name?: string;
}
export interface OperationalGateway {
  id: string;
  organization_id: string;
  site_id?: string;
  name: string;
  status: string;
  last_seen_at?: string;
}
export interface PointDay {
  point_id: string;
  day: string;
  v_max: number | null;
  temp_avg?: number | null;
  samples?: number;
}
export interface OperationsOverview {
  available: boolean;
  health: AssetHealth[];
  points: PointVital[];
  gateways: OperationalGateway[];
  daily: PointDay[];
  loadedAt: number;
}
