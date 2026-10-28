import { Asset } from "../types/models";
export function formatInstallation(
  asset: Pick<Asset, "installed_at" | "installation_datetime">,
) {
  if (asset.installation_datetime)
    return new Date(asset.installation_datetime).toLocaleString();
  if (!asset.installed_at) return "Not provided";
  const value = /^\d{4}-\d{2}-\d{2}$/.test(asset.installed_at)
    ? `${asset.installed_at}T12:00:00`
    : asset.installed_at;
  return new Date(value).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
