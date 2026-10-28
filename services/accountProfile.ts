import type { SupabaseClient } from "@supabase/supabase-js";
import type { Profile, Role } from "../types/models";

export async function getAccountProfile(
  db: SupabaseClient,
  userId: string,
): Promise<Profile> {
  const session = await db.auth.getSession();
  if (
    session.error ||
    !session.data.session?.access_token ||
    session.data.session.user.id !== userId
  )
    throw new Error("Sign in again to load your account.");
  const rpc = await db
    .rpc("revuptime_account_profile")
    .setHeader("Authorization", `Bearer ${session.data.session.access_token}`);
  if (!rpc.error) {
    if (!rpc.data || rpc.data.id !== userId)
      throw new Error("Verified account profile is unavailable.");
    return rpc.data as Profile;
  }
  // Only recover an unavailable function grant, never a business/access denial.
  if (
    rpc.error.code !== "42501" ||
    !/permission denied for (function (?:revuptime_account_profile|account_profile)|schema revuptime_private)\b/i.test(
      rpc.error.message,
    )
  )
    throw rpc.error;

  const identity = await db.auth.getUser();
  if (identity.error || identity.data.user?.id !== userId)
    throw new Error("Sign in again to load your account.");
  const user = identity.data.user;
  if (!user.email_confirmed_at)
    throw new Error("Verify your email before continuing.");

  const profile = await db
    .from("profiles")
    .select("id,full_name,email,status")
    .eq("id", userId)
    .maybeSingle();
  if (profile.error) throw profile.error;
  if (!profile.data || profile.data.id !== userId)
    throw new Error(
      "Your account profile is not set up. Contact your administrator.",
    );
  if (profile.data.status !== "active")
    throw new Error("Account is inactive. Contact your administrator.");
  const membership = await db
    .from("organization_members")
    .select("user_id,organization_id,role,status")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("joined_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (membership.error) throw membership.error;
  const member = membership.data;
  if (
    !member?.organization_id ||
    member.user_id !== userId ||
    member.status !== "active"
  )
    throw new Error(
      "No active workspace membership is available. Contact your administrator.",
    );
  const roles: Record<string, Role> = {
    owner: "Owner",
    admin: "Admin",
    manager: "Maintenance Manager",
    technician: "Technician",
    operator: "Operator",
    viewer: "Viewer",
    engineer: "Engineer",
  };
  return {
    id: userId,
    name: profile.data.full_name?.trim() || user.email || "Account",
    email: user.email || profile.data.email || "",
    organization_id: member.organization_id,
    role: roles[member.role] || "Viewer",
  };
}
