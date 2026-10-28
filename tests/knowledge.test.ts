import test from "node:test";
import assert from "node:assert/strict";
import {
  conversationKey,
  knowledgeBody,
  validateKnowledgeFile,
  DOCUMENT_LIMIT,
  runDocumentIndex,
} from "../utils/knowledge";
import type { KnowledgeRequest } from "../utils/knowledge";
import type { KnowledgeMessage } from "../types/knowledge";

test("file types and 15 MB boundary match workspace extraction", () => {
  for (const ext of [
    "pdf",
    "docx",
    "txt",
    "md",
    "markdown",
    "csv",
    "tsv",
    "json",
    "log",
  ])
    validateKnowledgeFile(`manual.${ext}`, DOCUMENT_LIMIT);
  assert.throws(
    () => validateKnowledgeFile("large.pdf", DOCUMENT_LIMIT + 1),
    /15 MB/,
  );
  assert.throws(() => validateKnowledgeFile("legacy.doc", 100), /OCR/);
});
test("chat sends eight bounded history messages and keeps general mode free of workspace scope", () => {
  const messages: KnowledgeMessage[] = Array.from({ length: 12 }, (_, i) => ({
    id: String(i),
    role: i % 2 ? "assistant" : "user",
    content: "x".repeat(4100),
    created_at: "today",
  }));
  const workspace = knowledgeBody(
    "org",
    " current value? ",
    "workspace",
    messages,
    "site",
    "asset",
  );
  assert.equal(workspace.question, "current value?");
  assert.equal(workspace.history.length, 8);
  assert.equal(workspace.history[0].content.length, 4000);
  assert.equal(workspace.asset_id, "asset");
  const general = knowledgeBody("org", "hello", "general", [], "site", "asset");
  assert.equal("asset_id" in general, false);
  assert.equal("site_id" in general, false);
  assert.throws(() => knowledgeBody("org", "x".repeat(4001), "workspace", []));
  assert.notEqual(
    conversationKey("u", "o", "workspace"),
    conversationKey("u", "o", "general"),
  );
  assert.notEqual(
    conversationKey("u", "o", "workspace"),
    conversationKey("other", "o", "workspace"),
  );
  assert.notEqual(
    conversationKey("u", "o", "workspace"),
    conversationKey("u", "other", "workspace"),
  );
});
test("index calls successive checkpointed batches until zero", async () => {
  const calls: string[] = [];
  let remaining = 90;
  const request: KnowledgeRequest = async <T>(
    endpoint: string,
    body: Record<string, unknown>,
  ) => {
    calls.push(endpoint);
    assert.equal(body.organization_id, "org");
    assert.equal(body.document_id, "doc");
    return (
      endpoint === "documents/index"
        ? { embedding_pending: true, chunks: 90, message: "Indexed" }
        : { remaining: Math.max(0, (remaining -= 40)), message: "Vector batch" }
    ) as T;
  };
  assert.equal((await runDocumentIndex(request, "org", "doc")).remaining, 0);
  assert.deepEqual(calls, [
    "documents/index",
    "documents/embed",
    "documents/embed",
    "documents/embed",
  ]);
});
test("no provider configuration stops after keyword indexing", async () => {
  const calls: string[] = [];
  const request: KnowledgeRequest = async <T>(endpoint: string) => {
    calls.push(endpoint);
    return { embedding_pending: false, message: "Keyword ready" } as T;
  };
  assert.equal(
    (await runDocumentIndex(request, "org", "doc")).message,
    "Keyword ready",
  );
  assert.deepEqual(calls, ["documents/index"]);
});
test("interrupted vector batches retain keyword readiness and resume without reindexing", async () => {
  let fail = true;
  const calls: string[] = [];
  const request: KnowledgeRequest = async <T>(endpoint: string) => {
    calls.push(endpoint);
    if (endpoint === "documents/index")
      return { embedding_pending: true, message: "Text ready" } as T;
    if (fail) throw new Error("network");
    return { remaining: 0, message: "Complete" } as T;
  };
  assert.equal((await runDocumentIndex(request, "org", "doc")).paused, true);
  fail = false;
  assert.equal(
    (await runDocumentIndex(request, "org", "doc", true)).remaining,
    0,
  );
  assert.deepEqual(calls, [
    "documents/index",
    "documents/embed",
    "documents/embed",
  ]);
});
test("non-progressing vector batches stop rather than loop", async () => {
  let count = 0;
  const request: KnowledgeRequest = async <T>() => {
    count++;
    return { remaining: 20, message: "Stalled" } as T;
  };
  assert.equal(
    (await runDocumentIndex(request, "org", "doc", true)).paused,
    true,
  );
  assert.equal(count, 2);
});
