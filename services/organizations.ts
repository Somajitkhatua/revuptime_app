import { client, isDemo, isCanonical } from "./supabase";
export async function getOrganization(org: string) {
  if (isDemo) return { id: org, name: "RevUpTime Demo" };
  const { data, error } = await client()
    .from("organizations")
    .select("*")
    .eq("id", org)
    .single();
  if (error) throw error;
  return data;
}
export async function getTeamMembers(
  org: string,
): Promise<{ id: string; name: string; role?: string }[]> {
  if (isDemo)
    return [
      { id: "00000000-0000-4000-8000-000000000003", name: "Rajesh Kumar", role: "technician" },
    ];
  if (isCanonical) {
    const { data, error } = await client()
      .from("organization_members")
      .select("user_id,role")
      .eq("organization_id", org)
      .eq("status", "active");
    if (error) throw error;
    const members = data || [];
    if (!members.length) return [];
    const profiles = await client()
      .from("profiles")
      .select("id,full_name")
      .in(
        "id",
        members.map((m) => m.user_id),
      );
    if (profiles.error) throw profiles.error;
    return members.map((m) => ({
      id: m.user_id,
      role: m.role,
      name:
        profiles.data?.find((p) => p.id === m.user_id)?.full_name ||
        `Team member (${m.user_id.slice(0, 8)})`,
    }));
  }
  const { data, error } = await client()
    .from("profiles")
    .select("id,name")
    .eq("organization_id", org);
  if (error) throw error;
  return data;
}
export async function getTechnicians(org: string) {
  return (await getTeamMembers(org)).filter(
    (m) => ["owner", "admin", "manager", "maintenance manager", "technician"].includes((m.role || "").toLowerCase()),
  );
}
