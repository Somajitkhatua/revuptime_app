import type { Profile } from "../types/models";
/** Match the live database's can_write role list. */
export function canEditMaintenance(profile: Pick<Profile, "role"> | null | undefined) {
  return !!profile && ["Owner", "Admin", "Maintenance Manager", "Technician"].includes(profile.role);
}
