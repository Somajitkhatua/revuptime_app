import { MaintenanceEvent } from "../types/models";
import { rows } from "./repository";
export const getMaintenance = (org: string, asset: string) =>
  rows<MaintenanceEvent>("maintenance_events", "maintenance", org, {
    asset_id: asset,
  });
