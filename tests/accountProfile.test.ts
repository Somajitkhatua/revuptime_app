import { test } from "node:test";
import assert from "node:assert/strict";
import { getAccountProfile } from "../services/accountProfile";
function fixture(
  options: {
    missingSession?: boolean;
    unverified?: boolean;
    inactive?: boolean;
    noMembership?: boolean;
    businessDenial?: boolean;
    rpcSuccess?: boolean;
  } = {},
) {
  const filters: any[] = [];
  let authorization = "";
  const db: any = {
    auth: {
      getSession: async () => ({
        data: {
          session: options.missingSession
            ? null
            : { access_token: "verified-session-token", user: { id: "user" } },
        },
      }),
      getUser: async () => ({
        data: {
          user: {
            id: "user",
            email: "user@example.invalid",
            email_confirmed_at: options.unverified ? null : "2026-10-15",
            user_metadata: { role: "owner" },
          },
        },
      }),
    },
    rpc: () => ({
      setHeader: (name: string, value: string) => {
        authorization = value;
        return Promise.resolve(
          options.rpcSuccess
            ? {
                data: {
                  id: "user",
                  name: "Account",
                  organization_id: "org",
                  role: "Viewer",
                },
              }
            : {
                error: {
                  code: "42501",
                  message: options.businessDenial
                    ? "Account is inactive. Contact your administrator."
                    : "permission denied for function revuptime_account_profile",
                },
              },
        );
      },
    }),
    from: (table: string) => {
      const q: any = {
        select: () => q,
        eq: (key: string, value: string) => {
          filters.push([table, key, value]);
          return q;
        },
        order: () => q,
        limit: () => q,
        maybeSingle: async () => ({
          data:
            table === "profiles"
              ? {
                  id: "user",
                  full_name: "Account",
                  status: options.inactive ? "inactive" : "active",
                }
              : options.noMembership
                ? null
                : {
                    user_id: "user",
                    organization_id: "org",
                    role: "viewer",
                    status: "active",
                  },
        }),
      };
      return q;
    },
  };
  return {
    db,
    filters,
    get authorization() {
      return authorization;
    },
  };
}
test("profile RPC uses the signed-in token and never runs anonymously", async () => {
  const f = fixture({ rpcSuccess: true });
  assert.equal((await getAccountProfile(f.db, "user")).role, "Viewer");
  assert.equal(f.authorization, "Bearer verified-session-token");
  assert.equal(f.filters.length, 0);
  const absent = fixture({ missingSession: true });
  await assert.rejects(
    () => getAccountProfile(absent.db, "user"),
    /Sign in again/,
  );
  assert.equal(absent.authorization, "");
});
test("denied function grant uses verified own profile and active membership without trusting metadata roles", async () => {
  const f = fixture();
  const result = await getAccountProfile(f.db, "user");
  assert.equal(result.role, "Viewer");
  assert.equal(result.organization_id, "org");
  assert.ok(
    f.filters.some(
      ([table, key, value]) =>
        table === "profiles" && key === "id" && value === "user",
    ),
  );
  assert.ok(
    f.filters.some(
      ([table, key, value]) =>
        table === "organization_members" &&
        key === "user_id" &&
        value === "user",
    ),
  );
  assert.ok(
    f.filters.some(
      ([table, key, value]) =>
        table === "organization_members" &&
        key === "status" &&
        value === "active",
    ),
  );
});
test("profile fallback rejects unverified, inactive and membership-less accounts", async () => {
  for (const [options, message] of [
    [{ unverified: true }, /Verify your email/],
    [{ inactive: true }, /Account is inactive/],
    [{ noMembership: true }, /No active workspace/],
  ] as const) {
    const f = fixture(options);
    await assert.rejects(() => getAccountProfile(f.db, "user"), message);
  }
});
test("business permission denials are preserved without falling back", async () => {
  const f = fixture({ businessDenial: true });
  await assert.rejects(
    () => getAccountProfile(f.db, "user"),
    (error: any) => error.message.includes("Account is inactive"),
  );
  assert.equal(f.filters.length, 0);
});
