import { test, expect, type Page } from "@playwright/test";
const user = "10000000-0000-4000-8000-000000000001",
  org = "10000000-0000-4000-8000-000000000002",
  site = "10000000-0000-4000-8000-000000000003",
  asset = "10000000-0000-4000-8000-000000000004";
const png =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2nL8AAAAASUVORK5CYII=";
async function workspace(page: Page) {
  const encode = (v: unknown) =>
    Buffer.from(JSON.stringify(v)).toString("base64url");
  const session = {
    access_token: `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ sub: user, role: "authenticated", aud: "authenticated", exp: Math.floor(Date.now() / 1000) + 3600 })}.test`,
    refresh_token: "test",
    token_type: "bearer",
    expires_in: 3600,
    user: {
      id: user,
      email: "qa@example.invalid",
      email_confirmed_at: new Date().toISOString(),
      aud: "authenticated",
      role: "authenticated",
      app_metadata: {},
      user_metadata: {},
    },
  };
  const state = {
    documents: [] as any[],
    bodies: [] as any[],
    remaining: 50,
    indexCalls: 0,
    vectorCalls: 0,
    fail: 0,
    value: 4.2,
    timestamp: "2026-10-24T10:00:00Z",
    previews: [] as any[],
  };
  await page.route(/https:\/\/[^/]+\.supabase\.co\//, async (route) => {
    const request = route.request(),
      url = new URL(request.url()),
      path = url.pathname;
    if (path.endsWith("/token")) return route.fulfill({ json: session });
    if (path.endsWith("/user")) return route.fulfill({ json: session.user });
    if (path.endsWith("/revuptime_account_profile"))
      return route.fulfill({
        json: {
          id: user,
          organization_id: org,
          name: "QA Owner",
          email: session.user.email,
          role: "Owner",
        },
      });
    if (path.endsWith("/sites"))
      return route.fulfill({
        json: [{ id: site, organization_id: org, name: "Main plant" }],
      });
    if (path.endsWith("/assets"))
      return route.fulfill({
        json: [
          {
            id: asset,
            organization_id: org,
            site_id: site,
            name: "Pump A",
            asset_type: "Pump",
            status: "active",
            metadata: {},
          },
        ],
      });
    if (path.includes("/storage/v1/object/revuptime-documents/"))
      return route.fulfill({ json: { Key: path } });
    if (path.endsWith("/asset_documents")) {
      expect(
        url.searchParams.get("organization_id") ||
          (request.postDataJSON()?.organization_id && `eq.${org}`),
      ).toBe(`eq.${org}`);
      if (request.method() === "POST") {
        const d = request.postDataJSON();
        state.documents.push(d);
        return route.fulfill({ json: d });
      }
      if (request.method() === "PATCH") {
        const d = state.documents.find(
          (d) => `eq.${d.id}` === url.searchParams.get("id"),
        );
        expect(url.searchParams.get("storage_path")).toBe(
          `eq.${d.storage_path}`,
        );
        Object.assign(d, request.postDataJSON());
        return route.fulfill({ json: d });
      }
      const selected = state.documents.filter(
        (d) =>
          !url.searchParams.get("id") ||
          url.searchParams.get("id") === `eq.${d.id}`,
      );
      return route.fulfill({
        json: request.headers().accept?.includes("vnd.pgrst.object")
          ? selected[0]
          : selected,
      });
    }
    return route.fulfill({ json: [] });
  });
  await page.route("**/api/rag/**", async (route) => {
    const req = route.request(),
      endpoint = new URL(req.url()).pathname.split("/api/rag/")[1],
      body = req.postDataJSON();
    expect(req.headers().authorization).toBe(`Bearer ${session.access_token}`);
    expect(body.organization_id).toBe(org);
    if (endpoint === "documents/index") {
      state.indexCalls++;
      state.remaining = 50;
      const d = state.documents.find((d) => d.id === body.document_id);
      d.metadata = {
        ...d.metadata,
        index_status: "ready",
        status: "Ready for AI",
        chunks: 50,
        indexed_source_path: d.storage_path,
      };
      return route.fulfill({
        json: { embedding_pending: true, chunks: 50, message: "Text indexed" },
      });
    }
    if (endpoint === "documents/embed") {
      state.vectorCalls++;
      state.remaining = Math.max(0, state.remaining - 40);
      return route.fulfill({
        json: {
          remaining: state.remaining,
          message: state.remaining
            ? "Vectors in progress"
            : "Document indexed and vectorized",
        },
      });
    }
    if (endpoint === "documents/page") {
      state.previews.push(body);
      const d = state.documents[0];
      if (body.source_path !== d.storage_path)
        return route.fulfill({
          status: 409,
          json: {
            error:
              "This file has been replaced since the answer was generated. Ask the question again to view the current version.",
          },
        });
      return route.fulfill({ json: { image: png } });
    }
    state.bodies.push({ endpoint, ...body });
    if (state.fail)
      return route.fulfill({
        status: state.fail,
        json: { error: "Not allowed" },
      });
    if (endpoint === "general-chat")
      return route.fulfill({
        status: 503,
        json: { error: "Configure OPENROUTER_API_KEY" },
      });
    const d = state.documents[0];
    const measurement = /reading/i.test(body.question);
    const excerpt = measurement
      ? `Value: ${state.value} mm/s · Quality: good · Recorded at: ${state.timestamp} · Null axes are unavailable`
      : `Use ISO VG ${d?.version === "2" ? "68" : "46"}. Installation dimensions are in the drawing.`;
    const source = measurement
      ? {
          table: "sensor_readings",
          id: "sensor-reading",
          label: `Pump A · sensor · ${state.timestamp}`,
          recorded_at: state.timestamp,
          excerpt,
        }
      : {
          table: "asset_documents",
          id: d?.id,
          label: `${d?.name} · v${d?.version} · page 1 · chunk 1`,
          version: d?.version,
          page_number: 1,
          source_path: d?.storage_path,
          mime_type: "application/pdf",
          excerpt,
          preview_recommended: /dimension/i.test(body.question),
        };
    return route.fulfill({
      json: {
        content: `Source excerpts from your workspace — no AI-written summary. ${excerpt} [S1]`,
        citations: [{ ...source, source_id: "S1" }],
        response_mode: "source_excerpts",
        engine: "local-retrieval",
      },
    });
  });
  await page.goto("/login");
  await page
    .getByLabel("Email address", { exact: true })
    .fill(session.user.email);
  await page.getByLabel("Password", { exact: true }).fill("test-password");
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await expect(page).toHaveURL(/dashboard$/);
  return state;
}
async function ask(page: Page, question: string) {
  await page.getByLabel("Ask a question", { exact: true }).fill(question);
  await page
    .getByRole("button", { name: "Send question", exact: true })
    .click();
  await expect(page.getByLabel("Ask a question", { exact: true })).toHaveValue(
    "",
  );
}
test("document upload, replacement, cited excerpts, fresh readings and PDF zoom", async ({
  page,
}) => {
  const state = await workspace(page);
  await page.goto(`/document/upload?assetId=${asset}`);
  let chooser = page.waitForEvent("filechooser");
  await page
    .getByRole("button", { name: "Select document", exact: true })
    .click();
  await (
    await chooser
  ).setFiles({
    name: "pump.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("test PDF fixture"),
  });
  await page
    .getByRole("button", { name: "Upload Document", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Open saved document" }),
  ).toBeVisible();
  expect(state.indexCalls).toBe(1);
  expect(state.vectorCalls).toBe(2);
  expect(state.documents).toHaveLength(1);
  const id = state.documents[0].id,
    oldPath = state.documents[0].storage_path;
  await page.goto("/ai");
  await expect(
    page.getByRole("button", { name: "Answer from", exact: true }),
  ).toContainText("Workspace documents and machine data");
  await ask(page, "What lubricant does Pump A need?");
  await expect(
    page.getByText("Source excerpts · no AI-written summary", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText(/ISO VG 46/).first()).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Chat history", exact: true }).click();
  await page
    .getByText("What lubricant does Pump A need?", { exact: true })
    .last()
    .click();
  await expect(page.getByText(/ISO VG 46/).first()).toBeVisible();
  await page.goto(`/document/upload?assetId=${asset}&replaceId=${id}`);
  chooser = page.waitForEvent("filechooser");
  await page
    .getByRole("button", { name: "Select document", exact: true })
    .click();
  await (
    await chooser
  ).setFiles({
    name: "pump-new.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("updated test PDF"),
  });
  await page
    .getByRole("button", { name: "Replace Document", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Open saved document" }),
  ).toBeVisible();
  expect(state.documents).toHaveLength(1);
  expect(state.documents[0].id).toBe(id);
  expect(state.documents[0].version).toBe("2");
  expect(state.documents[0].storage_path).not.toBe(oldPath);
  await page.goto("/ai");
  await page.getByRole("button", { name: "Chat history", exact: true }).click();
  await page
    .getByText("What lubricant does Pump A need?", { exact: true })
    .last()
    .click();
  await page.getByRole("button", { name: /S1.*pump.pdf/ }).click();
  await page
    .getByRole("button", { name: "View cited PDF page 1", exact: true })
    .click();
  await expect(
    page.getByText(/This file has been replaced since the answer/),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "New conversation", exact: true })
    .click();
  await ask(page, "What are the installation dimensions and lubricant?");
  await expect(page.getByText(/ISO VG 68/).first()).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Zoom drawing", exact: true }),
  ).toBeVisible();
  expect(state.previews.at(-1)).toMatchObject({
    organization_id: org,
    document_id: id,
    page_number: 1,
    source_path: state.documents[0].storage_path,
  });
  await page.getByRole("button", { name: "Zoom drawing", exact: true }).click();
  await page.getByRole("button", { name: "+", exact: true }).click();
  await expect(page.getByText(/150%/)).toBeVisible();
  await page
    .getByRole("button", { name: "Close preview", exact: true })
    .click();
  await ask(page, "What is the latest reading?");
  await expect(page.getByText(/Value: 4.2/).first()).toBeVisible();
  state.value = 7.6;
  state.timestamp = "2026-10-24T11:00:00Z";
  await ask(page, "Check the reading again");
  await expect(
    page.getByText(/Value: 7.6.*2026-10-24T11:00:00Z/).first(),
  ).toBeVisible();
  await page.screenshot({ path: "output/rag-mobile-chat.png", fullPage: true });
});
test("denied/expired sessions keep question; general history is separate and config errors are readable", async ({
  page,
}) => {
  const state = await workspace(page);
  await page.goto("/ai");
  for (const status of [403, 401]) {
    state.fail = status;
    await page
      .getByLabel("Ask a question", { exact: true })
      .fill("Do not lose my question");
    await page
      .getByRole("button", { name: "Send question", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Retry question", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByLabel("Ask a question", { exact: true }),
    ).toHaveValue("Do not lose my question");
  }
  state.fail = 0;
  await page.getByRole("button", { name: "Answer from", exact: true }).click();
  await page.getByText("General AI", { exact: true }).last().click();
  await page
    .getByRole("button", { name: "Send question", exact: true })
    .click();
  await expect(
    page.getByText(/AI summaries or vectors need server configuration/),
  ).toBeVisible();
  const general = state.bodies.at(-1);
  expect(general.endpoint).toBe("general-chat");
  expect(general.history).toEqual([]);
  expect(general.site_id).toBeUndefined();
  expect(general.asset_id).toBeUndefined();
  await expect(
    page.getByText("Configure OPENROUTER_API_KEY", { exact: true }),
  ).toHaveCount(0);
});

test("network interruption and cancellation retain the unsent question", async ({
  page,
}) => {
  await workspace(page);
  await page.goto("/ai");
  await page.route("**/api/rag/knowledge-chat", (route) =>
    route.abort("failed"),
  );
  await page
    .getByLabel("Ask a question", { exact: true })
    .fill("Keep this question");
  await page
    .getByRole("button", { name: "Send question", exact: true })
    .click();
  await expect(
    page.getByText(/Cannot reach the workspace server/),
  ).toBeVisible();
  await expect(page.getByLabel("Ask a question", { exact: true })).toHaveValue(
    "Keep this question",
  );
  await page.unroute("**/api/rag/knowledge-chat");
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/rag/knowledge-chat", async (route) => {
    await gate;
    await route
      .fulfill({ json: { content: "late", citations: [] } })
      .catch(() => {});
  });
  await page
    .getByRole("button", { name: "Retry question", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Cancel request", exact: true })
    .click();
  await expect(
    page.getByText(/Request cancelled. Your question is kept/),
  ).toBeVisible();
  release();
  await expect(page.getByLabel("Ask a question", { exact: true })).toHaveValue(
    "Keep this question",
  );
  await expect(page.getByText("late", { exact: true })).toHaveCount(0);
});
