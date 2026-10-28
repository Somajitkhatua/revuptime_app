import test from "node:test";
import assert from "node:assert/strict";
import {
  getMyWorkspaces,
  profileInWorkspace,
  workspacePreferenceKey,
  WorkspaceAccessError,
} from "../services/workspaces";
import { documentInScope, documentMatchesCategory } from "../utils/documents";
import { normalizeRow } from "../services/canonical";
import type { Profile } from "../types/models";

const profile: Profile = {
  id: "self",
  name: "Account",
  email: "qa@example.invalid",
  organization_id: "first",
  role: "Owner",
};
function fixture(identity = "self") {
  const filters: unknown[] = [];
  const members = [
    {
      user_id: "self",
      organization_id: "first",
      role: "owner",
      status: "active",
    },
    {
      user_id: "self",
      organization_id: "second",
      role: "viewer",
      status: "active",
    },
    {
      user_id: "other",
      organization_id: "foreign",
      role: "owner",
      status: "active",
    },
    {
      user_id: "self",
      organization_id: "revoked",
      role: "owner",
      status: "inactive",
    },
  ];
  const db: any = {
    auth: {
      getUser: async () => ({
        data: { user: { id: identity, user_metadata: { role: "owner" } } },
      }),
    },
    from: (table: string) => {
      const data =
        table === "organization_members"
          ? members
          : ["first", "second", "foreign", "revoked"].map((id) => ({
              id,
              name: `${id} workspace`,
            }));
      const q: any = {
        select: () => q,
        order: () => q,
        eq: (key: string, value: string) => {
          filters.push([table, key, value]);
          return q;
        },
        in: (key: string, value: string[]) => {
          filters.push([table, key, value]);
          return q;
        },
        then: (resolve: any, reject: any) =>
          Promise.resolve({ data, error: null }).then(resolve, reject),
      };
      return q;
    },
  };
  return { db, filters };
}

test("workspace choices use only the verified user's active memberships and roles", async () => {
  const f = fixture();
  const list = await getMyWorkspaces(f.db, "self");
  assert.deepEqual(
    list.map((w) => [w.id, w.role]),
    [
      ["first", "Owner"],
      ["second", "Viewer"],
    ],
  );
  assert.ok(
    f.filters.some(
      (f) =>
        JSON.stringify(f) ===
        JSON.stringify(["organization_members", "user_id", "self"]),
    ),
  );
  assert.ok(
    f.filters.some(
      (f) =>
        JSON.stringify(f) ===
        JSON.stringify(["organization_members", "status", "active"]),
    ),
  );
});

test("a workspace preference cannot grant foreign or revoked membership or retain an old owner role", async () => {
  const f = fixture();
  const selected = await profileInWorkspace(f.db, profile, "second");
  assert.equal(selected.organization_id, "second");
  assert.equal(selected.role, "Viewer");
  for (const id of ["foreign", "revoked", "arbitrary"])
    await assert.rejects(
      () => profileInWorkspace(f.db, profile, id),
      WorkspaceAccessError,
    );
  assert.notEqual(
    workspacePreferenceKey("self"),
    workspacePreferenceKey("other"),
  );
});

test("workspace listing rejects a mismatched signed-in identity before any membership query", async () => {
  const f = fixture("other");
  await assert.rejects(() => getMyWorkspaces(f.db, "self"), /Sign in again/);
  assert.deepEqual(f.filters, []);
});

test("machine documents include shared workspace and plant manuals without exposing other scopes", () => {
  const base = { organization_id: "org", asset_id: null, site_id: null };
  assert.equal(documentInScope(base, "org", "machine", "plant"), true);
  assert.equal(
    documentInScope({ ...base, site_id: "plant" }, "org", "machine", "plant"),
    true,
  );
  assert.equal(
    documentInScope(
      { ...base, asset_id: "machine", site_id: "plant" },
      "org",
      "machine",
      "plant",
    ),
    true,
  );
  for (const change of [
    { organization_id: "other" },
    { site_id: "other" },
    { asset_id: "other" },
    { metadata: { archived: true } },
  ])
    assert.equal(
      documentInScope({ ...base, ...change }, "org", "machine", "plant"),
      false,
    );
});

test("SaaS document categories and unindexed legacy files render accurately", () => {
  for (const type of ["manual", "Manual", "user_manual", "Service Manual"])
    assert.equal(documentMatchesCategory(type, "Manuals"), true);
  assert.equal(documentMatchesCategory("datasheet", "Datasheets"), true);
  assert.equal(documentMatchesCategory("procedure", "SOP"), true);
  const doc = normalizeRow("asset_documents", {
    name: "old-manual.pdf",
    document_type: "manual",
    metadata: { title: "Bearing guide" },
  });
  assert.equal(doc.title, "Bearing guide");
  assert.equal(doc.filename, "old-manual.pdf");
  assert.equal(doc.status, "Not indexed");
});
