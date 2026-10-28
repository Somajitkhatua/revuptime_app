import { test } from "node:test";
import assert from "node:assert/strict";
import { chunkPages, createDocumentHandler } from "../supabase/functions/_shared/documentProcessing";
import { verifiedPassages } from "../supabase/functions/_shared/manualEvidence";
import { userError } from "../utils/userError";
import { canEditMaintenance } from "../utils/permissions";
import { chartIndices } from "../utils/chartSampling";

test("chart rendering retains endpoints and spikes while excluding invalid values", () => {
  const values = Array.from({ length: 2000 }, () => 2);
  values[1001] = 99;
  values[1002] = 0;
  values[19] = NaN;
  const selected = chartIndices(values);
  for (const index of [0, 1001, 1002, 1999]) assert.ok(selected.includes(index));
  assert.ok(!selected.includes(19));
  assert.ok(selected.length <= 70);
});

test("write controls match canonical database roles", () => {
  for (const role of ["Viewer", "Operator", "Engineer"] as const) assert.equal(canEditMaintenance({ role }), false);
  for (const role of ["Owner", "Admin", "Maintenance Manager", "Technician"] as const) assert.equal(canEditMaintenance({ role }), true);
  assert.equal(canEditMaintenance(null), false);
});

test("document chunks preserve page numbers, reject unreadable text and bound processing work", () => {
  const chunks = chunkPages(["First page", "", "x".repeat(1500)]);
  assert.deepEqual(chunks.map((c) => c.page_number), [1, 3, 3]);
  assert.equal(chunks[1].content.length, 1200);
  assert.deepEqual(chunks.map((c) => c.chunk_index), [0, 1, 2]);
  assert.throws(() => chunkPages([" "]), /searchable PDF/);
  assert.throws(() => chunkPages(["x".repeat(401000)]), /too large/);
});
test("manual evidence excludes other documents, archived files and invalid pages", () => {
  const result = verifiedPassages([
    { document_id: "ok", page_number: 2, content: "Verified" },
    { document_id: "foreign", page_number: 1, content: "Foreign" },
    { document_id: "archived", page_number: 1, content: "Archived" },
    { document_id: "ok", page_number: 0, content: "Invalid" },
  ], [{ id: "ok", name: "Manual", metadata: { status: "Ready for AI" } }, { id: "archived", metadata: { status: "Ready for AI", archived: true } }]);
  assert.equal(result.length, 1);
  assert.equal(result[0].page, 2);
});
test("document worker rejects missing sessions, foreign documents and Viewers before privileged access", async () => {
  for (const scenario of ["missing", "foreign", "viewer", "owner"] as const) {
    let privileged = 0;
    const writes: any[] = [];
    const handler = createDocumentHandler({
      env: (key) => key,
      extractPages: async () => ["Verified instructions"],
      createClient: (_url: string, key: string) => {
        if (key === "SUPABASE_SERVICE_ROLE_KEY") {
          privileged++;
          return {
            rpc: async (name: string, params: any) => { writes.push({ name, params }); return { data: name.includes("claim") ? { id: "doc" } : true }; },
            storage: { from: () => ({ download: async () => ({ data: new Blob(["test"]) }) }) },
          };
        }
        return { auth: { getUser: async () => ({ data: { user: { id: "user", email_confirmed_at: "2026-10-22" } } }) },
          from: (table: string) => {
            const q: any = { select: () => q, eq: () => q, maybeSingle: async () => ({ data: table === "asset_documents" ? scenario === "foreign" ? null : { id: "doc", organization_id: "org", asset_id: "asset", storage_bucket: "asset-documents", storage_path: "org/asset/manual.pdf", mime_type: "application/pdf" } : { role: scenario === "viewer" ? "viewer" : "owner" } }) };
            return q;
          } };
      },
    });
    const result = await handler(new Request("http://test/doc", { method: "POST", headers: scenario === "missing" ? {} : { Authorization: "Bearer fixture" }, body: JSON.stringify({ document_id: "10000000-0000-4000-8000-000000000001" }) }));
    assert.equal(result.status, { missing: 401, foreign: 404, viewer: 403, owner: 200 }[scenario]);
    assert.equal(privileged, scenario === "owner" ? 1 : 0);
    if (scenario === "owner") {
      assert.equal((await result.json()).status, "Ready for AI");
      assert.equal(writes[1].params.p_chunks[0].page_number, 1);
    }
  }
});
test("friendly errors keep validation guidance and hide database internals", () => {
  assert.equal(userError(new Error("Enter a title.")), "Enter a title.");
  assert.match(userError({ message: "permission denied for table profiles" }), /administrator/);
  assert.match(userError(new TypeError("Failed to fetch")), /internet connection/);
  assert.doesNotMatch(userError({ message: "column secret does not exist" }), /secret|column/);
});
