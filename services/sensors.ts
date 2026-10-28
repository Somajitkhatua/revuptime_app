import { client, isDemo } from "./supabase";
export async function getSensors(org: string, asset: string) {
  if (isDemo)
    return [
      {
        id: "demo-sensor",
        asset_id: asset,
        name: "Tri-axis vibration sensor",
        status: "Online",
      },
    ];
  const { data, error } = await client()
    .from("sensors")
    .select("*")
    .eq("organization_id", org)
    .eq("asset_id", asset);
  if (error) throw error;
  return data;
}
