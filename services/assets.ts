import { Asset } from "../types/models";
import { rows } from "./repository";
import { client, isCanonical, isDemo } from "./supabase";
import { mutateDemo, uuid } from "./demo";
import { normalizeRow } from "./canonical";
import { installationTimestamp } from "../utils/validation";
export type AssetInput = Pick<
  Asset,
  | "name"
  | "site_id"
  | "type"
  | "description"
  | "manufacturer"
  | "model"
  | "serial_number"
  | "location"
  | "installed_at"
> & { installed_time: string };
export async function saveAsset(
  org: string,
  input: AssetInput,
  id?: string,
): Promise<Asset> {
  if (
    !org ||
    !input.name.trim() ||
    !input.site_id ||
    !["Motor", "Pump", "Fan", "Gearbox", "Other"].includes(input.type)
  )
    throw new Error("Enter a machine name, type, and plant.");
  const installed = installationTimestamp(
    input.installed_at,
    input.installed_time,
  );
  const sites = await rows<any>("sites", "sites", org, { id: input.site_id });
  if (!sites.length) throw new Error("Plant not found in your workspace.");
  const clean = Object.fromEntries(
    Object.entries(input).map(([k, v]) => [k, v.trim()]),
  ) as AssetInput;
  if (isDemo)
    return mutateDemo((s) => {
      if (id) {
        const asset = s.assets.find(
          (a) => a.id === id && a.organization_id === org,
        );
        if (!asset) throw new Error("Machine not found.");
        Object.assign(asset, clean, { installation_datetime: installed });
        return asset;
      }
      const asset: Asset = {
        ...clean,
        id: uuid(),
        organization_id: org,
        health: "Not assessed",
        health_score: 0,
        status: "active",
        power: 0,
        rpm: 0,
        installation_datetime: installed,
        created_at: new Date().toISOString(),
      };
      s.assets.push(asset);
      return asset;
    });
  const { installed_time: _time, ...legacyFields } = clean;
  const payload = isCanonical
    ? {
        name: clean.name,
        site_id: clean.site_id,
        asset_type: clean.type,
        description: clean.description,
        manufacturer: clean.manufacturer,
        model: clean.model,
        serial_number: clean.serial_number,
        location: clean.location,
        installation_date: clean.installed_at || null,
        installation_datetime: installed,
      }
    : legacyFields;
  const query = id
    ? client()
        .from("assets")
        .update(payload)
        .eq("organization_id", org)
        .eq("id", id)
    : client()
        .from("assets")
        .insert({ ...payload, organization_id: org });
  const { data, error } = await query.select().single();
  if (error) throw error;
  return isCanonical ? normalizeRow("assets", data) : data;
}
export async function getAssets(org: string, site?: string): Promise<Asset[]> {
  if (!org) return [];
  if (isDemo) return rows<Asset>("assets", "assets", org, site ? { site_id: site } : {});
  const assets: Asset[] = [];
  for (let offset = 0; ; offset += 500) {
    let query = client().from("assets").select("*").eq("organization_id", org).order("id").range(offset, offset + 499);
    if (site) query = query.eq("site_id", site);
    const { data, error } = await query;
    if (error) throw error;
    assets.push(...(isCanonical ? (data || []).map((row) => normalizeRow("assets", row)) : data || []));
    if (!data || data.length < 500) return assets;
  }
}
export async function getAsset(org: string, id: string) {
  const a = await rows<Asset>("assets", "assets", org, { id });
  if (!a[0]) throw new Error("Asset not found or access denied.");
  return a[0];
}
