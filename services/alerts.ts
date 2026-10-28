import { AssetAlert, AlertStatus } from "../types/models";
import { rows, update } from "./repository";
import { isDemo, isCanonical } from "./supabase";
import { mutateDemo } from "./demo";
export const getAlerts = (org: string, asset?: string) =>
  rows<AssetAlert>("alerts", "alerts", org, asset ? { asset_id: asset } : {});
export async function setAlertStatus(
  org: string,
  id: string,
  status: AlertStatus,
) {
  if (isDemo)
    return mutateDemo((s) => {
      const a = s.alerts.find((x) => x.id === id && x.organization_id === org);
      if (!a) throw new Error("Alert not found.");
      a.status = status;
      if (status === "Resolved") a.resolved_at = new Date().toISOString();
      return a;
    });
  return update<AssetAlert>("alerts", org, id, {
    status: isCanonical ? status.toLowerCase() : status,
    ...(status === "Resolved" ? { resolved_at: new Date().toISOString() } : {}),
  });
}
