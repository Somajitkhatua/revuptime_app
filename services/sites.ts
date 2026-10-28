import { Site } from "../types/models";
import { rows } from "./repository";
import { client, isCanonical, isDemo } from "./supabase";
import { mutateDemo, uuid } from "./demo";
import { normalizeRow } from "./canonical";
export async function createSite(
  org: string,
  name: string,
  location: string,
): Promise<Site> {
  if (!org || !name.trim()) throw new Error("Enter a plant name.");
  if (isDemo)
    return mutateDemo((s) => {
      const site = {
        id: uuid(),
        organization_id: org,
        name: name.trim(),
        location: location.trim(),
      };
      s.sites.push(site);
      return site;
    });
  const { data, error } = await client()
    .from("sites")
    .insert({
      organization_id: org,
      name: name.trim(),
      ...(isCanonical
        ? { city: location.trim() }
        : { location: location.trim() }),
    })
    .select()
    .single();
  if (error) throw error;
  return isCanonical ? normalizeRow("sites", data) : data;
}
export const getSites = (org: string) => rows<Site>("sites", "sites", org);
