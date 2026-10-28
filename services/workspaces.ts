import type { SupabaseClient } from "@supabase/supabase-js";
import type { Profile, Role } from "../types/models";

export type Workspace = { id: string; name: string; role: Role };
export const workspacePreferenceKey = (user: string) =>
  `revuptime.workspace:${user}`;

const roles: Record<string, Role> = {
  owner: "Owner",
  admin: "Admin",
  manager: "Maintenance Manager",
  technician: "Technician",
  operator: "Operator",
  viewer: "Viewer",
  engineer: "Engineer",
};

export class WorkspaceAccessError extends Error {}

/** Only the signed-in user's active memberships can supply workspace IDs/roles. */
export async function getMyWorkspaces(
  db: SupabaseClient,
  userId: string,
): Promise<Workspace[]> {
  const identity = await db.auth.getUser();
  if (identity.error || identity.data.user?.id !== userId)
    throw new Error("Sign in again to choose a workspace.");
  const members = await db
    .from("organization_members")
    .select("user_id,organization_id,role,status")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("joined_at", { ascending: true });
  if (members.error) throw members.error;
  const verified = (members.data || []).filter(
    (m) => m.user_id === userId && m.status === "active",
  );
  if (!verified.length) return [];
  const organizations = await db
    .from("organizations")
    .select("id,name")
    .in(
      "id",
      verified.map((m) => m.organization_id),
    );
  if (organizations.error) throw organizations.error;
  return verified.flatMap((member) => {
    const organization = organizations.data?.find(
      (o) => o.id === member.organization_id,
    );
    return organization
      ? [
          {
            id: organization.id,
            name: organization.name,
            role: roles[member.role] || "Viewer",
          },
        ]
      : [];
  });
}

export async function profileInWorkspace(
  db: SupabaseClient,
  profile: Profile,
  organization: string,
): Promise<Profile> {
  const workspace = (await getMyWorkspaces(db, profile.id)).find(
    (w) => w.id === organization,
  );
  if (!workspace)
    throw new WorkspaceAccessError(
      "You do not have an active membership in this workspace.",
    );
  return {
    ...profile,
    organization_id: workspace.id,
    organization_name: workspace.name,
    role: workspace.role,
  };
}
