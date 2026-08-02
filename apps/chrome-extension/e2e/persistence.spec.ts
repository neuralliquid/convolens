import { createHmac } from "node:crypto";
import { createServer, type Server } from "node:http";
import { spawn, type ChildProcess } from "node:child_process";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import {
  chromium,
  expect,
  test,
  type BrowserContext,
  type Page,
} from "@playwright/test";

const repositoryRoot = resolve(import.meta.dirname, "../../..");
const extensionPath = resolve(import.meta.dirname, "..");
const apiEntry = resolve(repositoryRoot, "apps/api/dist/index.js");
const fixturePath = resolve(import.meta.dirname, "fixtures/whatsapp-web.html");
const apiOrigin = "http://localhost:3001";
const jwtSecret = "fixture-secret-that-is-at-least-thirty-two-characters";

function base64url(value: string): string {
  return Buffer.from(value).toString("base64url");
}

function fixtureToken(id: string, email: string): string {
  const header = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = base64url(
    JSON.stringify({
      id,
      email,
      role: "user",
      exp: Math.floor(Date.now() / 1000) + 3_600,
    }),
  );
  const signature = createHmac("sha256", jwtSecret)
    .update(`${header}.${payload}`)
    .digest("base64url");
  return `${header}.${payload}.${signature}`;
}

async function waitForReady(child: ChildProcess): Promise<void> {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null)
      throw new Error(`Fixture API exited with ${child.exitCode}`);
    try {
      const response = await fetch(`${apiOrigin}/ready`);
      if (response.ok) return;
    } catch {
      // The process is still starting.
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 250));
  }
  throw new Error("Fixture API did not become ready");
}

async function startApi(
  databasePath: string,
  artifactRoot: string,
): Promise<ChildProcess> {
  const child = spawn(process.execPath, [apiEntry], {
    cwd: repositoryRoot,
    env: {
      ...process.env,
      NODE_ENV: "test",
      PORT: "3001",
      JWT_SECRET: jwtSecret,
      DB_TYPE: "sqlite",
      DATABASE_PATH: databasePath,
      DB_SYNCHRONIZE: "true",
      DB_MIGRATIONS_RUN: "false",
      STORAGE_PROVIDER: "local",
      UPLOAD_DIR: artifactRoot,
      FRONTEND_URL: "https://convolens.neuralliquid.ai",
      BATON_BASE_URL: "http://127.0.0.1:3002",
      BATON_DEFAULT_PROJECT_ID: "11111111-1111-4111-8111-111111111111",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  try {
    await waitForReady(child);
    return child;
  } catch (error) {
    await stopApi(child);
    throw error;
  }
}

async function startBatonStub(): Promise<{
  server: Server;
  created: () => number;
}> {
  const tasks: Array<{ id: string; context: string }> = [];
  const server = createServer((request, response) => {
    if (request.headers.authorization !== "Bearer fixture-mystira-token") {
      response.writeHead(401, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ error: "Unauthorized" }));
      return;
    }
    if (request.method === "GET" && request.url?.startsWith("/api/tasks")) {
      const search =
        new URL(request.url, "http://127.0.0.1").searchParams.get("search") ||
        "";
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end(
        JSON.stringify(tasks.filter((task) => task.context.includes(search))),
      );
      return;
    }
    if (request.method === "POST" && request.url === "/api/tasks") {
      let body = "";
      request.on("data", (chunk) => {
        body += chunk;
      });
      request.on("end", () => {
        const payload = JSON.parse(body) as { context: string };
        const task = {
          id: `fixture-task-${tasks.length + 1}`,
          context: payload.context,
        };
        tasks.push(task);
        response.writeHead(201, { "Content-Type": "application/json" });
        response.end(JSON.stringify(task));
      });
      return;
    }
    response.writeHead(404).end();
  });
  await new Promise<void>((resolvePromise) =>
    server.listen(3002, "127.0.0.1", resolvePromise),
  );
  return { server, created: () => tasks.length };
}

async function stopApi(child: ChildProcess | undefined): Promise<void> {
  if (!child || child.exitCode !== null) return;
  const exited = new Promise<void>((resolvePromise) =>
    child.once("exit", () => resolvePromise()),
  );
  child.kill("SIGTERM");
  await Promise.race([
    exited,
    new Promise<void>((resolvePromise) =>
      setTimeout(() => {
        if (child.exitCode === null) child.kill("SIGKILL");
        resolvePromise();
      }, 5_000),
    ),
  ]);
}

async function reviewLoadedMessages(page: Page): Promise<void> {
  const toggle = page.locator("#ws-launcher-toggle");
  if ((await toggle.getAttribute("aria-expanded")) !== "true")
    await toggle.click();
  await page.locator("#ws-extract-btn").click();
  await expect(page.locator("#ws-status-text")).toHaveText(
    "6 loaded messages ready for review.",
    { timeout: 15_000 },
  );
}

test("persists a reviewed extension capture across duplicate, restart, isolation, and deletion", async ({}, testInfo) => {
  const root = await mkdtemp(
    resolve(tmpdir(), "convolens-persistence-fixture-"),
  );
  const profileDir = resolve(root, "profile");
  const databasePath = resolve(root, "intake.sqlite");
  const artifactRoot = resolve(root, "artifacts");
  const ownerToken = fixtureToken("fixture-owner-a", "owner-a@example.test");
  const otherToken = fixtureToken("fixture-owner-b", "owner-b@example.test");
  let api: ChildProcess | undefined;
  let context: BrowserContext | undefined;
  let baton: Awaited<ReturnType<typeof startBatonStub>> | undefined;
  try {
    baton = await startBatonStub();
    api = await startApi(databasePath, artifactRoot);
    const fixtureHtml = await readFile(fixturePath, "utf8");
    context = await chromium.launchPersistentContext(profileDir, {
      channel: "chromium",
      headless: false,
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
        "--host-resolver-rules=MAP convolens.neuralliquid.ai ~NOTFOUND, MAP nl-prod-convolens-api.calmmoss-612abacc.southafricanorth.azurecontainerapps.io ~NOTFOUND, EXCLUDE localhost",
      ],
    });
    await context.route("https://web.whatsapp.com/**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "text/html",
        body: fixtureHtml,
      }),
    );
    const worker =
      context
        .serviceWorkers()
        .find((candidate) =>
          candidate.url().startsWith("chrome-extension://"),
        ) ||
      (await context.waitForEvent("serviceworker", {
        predicate: (candidate) =>
          candidate.url().startsWith("chrome-extension://"),
      }));
    const extensionPage = await context.newPage();
    await extensionPage.goto(
      `chrome-extension://${new URL(worker.url()).host}/options/options.html`,
    );
    await extensionPage.evaluate(
      async ({ endpoint, token }) => {
        await chrome.storage.local.clear();
        await chrome.storage.session.clear();
        await chrome.storage.local.set({
          authToken: token,
          authTokenExpiresAt: Date.now() + 3_600_000,
          user: { id: "fixture-owner-a", email: "owner-a@example.test" },
          settings: { apiEndpoint: endpoint },
        });
      },
      { endpoint: apiOrigin, token: ownerToken },
    );
    const page = await context.newPage();
    await page.goto("https://web.whatsapp.com/");
    await page.locator("#convolens-fab").waitFor();

    await reviewLoadedMessages(page);
    await page.locator("#ws-confirm-capture").click();
    await expect(page.locator("#ws-status-text")).toContainText(
      "received by ConvoLens",
    );

    const ownerHeaders = { Authorization: `Bearer ${ownerToken}` };
    const listResponse = await context.request.get(
      `${apiOrigin}/api/chat-export`,
      {
        headers: ownerHeaders,
      },
    );
    expect(listResponse.ok()).toBe(true);
    const list = (await listResponse.json()) as {
      data: {
        conversations: Array<{
          id: string;
          messageCount: number;
          rawArtifactStatus: string;
        }>;
      };
    };
    expect(list.data.conversations).toHaveLength(1);
    expect(list.data.conversations[0]).toMatchObject({
      messageCount: 6,
      rawArtifactStatus: "stored",
    });
    const intakeId = list.data.conversations[0].id;

    const detailResponse = await context.request.get(
      `${apiOrigin}/api/chat-export/${intakeId}`,
      {
        headers: ownerHeaders,
      },
    );
    const detail = (await detailResponse.json()) as {
      data: {
        conversation: {
          messages: unknown[];
          rawArtifact: { status: string; sha256: string; size: number };
        };
      };
    };
    expect(detail.data.conversation.messages).toHaveLength(6);
    expect(detail.data.conversation.rawArtifact).toMatchObject({
      status: "stored",
    });
    expect(detail.data.conversation.rawArtifact.sha256).toMatch(
      /^[a-f0-9]{64}$/,
    );
    expect(detail.data.conversation.rawArtifact.size).toBeGreaterThan(0);

    const generated = await context.request.post(
      `${apiOrigin}/api/ticket-candidates/conversations/${intakeId}/generate`,
      { headers: ownerHeaders },
    );
    expect(generated.ok()).toBe(true);
    const generatedPayload = (await generated.json()) as {
      data: {
        candidates: Array<{ id: string; title: string; revision: number }>;
      };
    };
    expect(generatedPayload.data.candidates).toHaveLength(1);
    expect(generatedPayload.data.candidates[0].title).toBe("Synthetic reply");
    const candidateId = generatedPayload.data.candidates[0].id;
    const accepted = await context.request.post(
      `${apiOrigin}/api/ticket-candidates/${candidateId}/decision`,
      {
        headers: { ...ownerHeaders, "Content-Type": "application/json" },
        data: {
          expectedRevision: 1,
          decision: "accepted",
          projectId: "11111111-1111-4111-8111-111111111111",
        },
      },
    );
    expect(accepted.ok()).toBe(true);
    const publishHeaders = {
      ...ownerHeaders,
      "X-Baton-Access-Token": "fixture-mystira-token",
    };
    const published = await context.request.post(
      `${apiOrigin}/api/ticket-candidates/${candidateId}/publish`,
      { headers: publishHeaders },
    );
    expect(published.ok()).toBe(true);
    const replayedPublish = await context.request.post(
      `${apiOrigin}/api/ticket-candidates/${candidateId}/publish`,
      { headers: publishHeaders },
    );
    expect(replayedPublish.ok()).toBe(true);
    expect(baton.created()).toBe(1);
    const isolatedCandidates = await context.request.get(
      `${apiOrigin}/api/ticket-candidates/conversations/${intakeId}`,
      {
        headers: { Authorization: `Bearer ${otherToken}` },
      },
    );
    expect(
      ((await isolatedCandidates.json()) as { data: { candidates: unknown[] } })
        .data.candidates,
    ).toHaveLength(0);

    await reviewLoadedMessages(page);
    await page.locator("#ws-confirm-capture").click();
    await expect(page.locator("#ws-status-text")).toContainText(
      "already exist in ConvoLens",
    );
    const duplicateList = await context.request.get(
      `${apiOrigin}/api/chat-export`,
      {
        headers: ownerHeaders,
      },
    );
    expect(
      ((await duplicateList.json()) as typeof list).data.conversations,
    ).toHaveLength(1);

    await stopApi(api);
    api = await startApi(databasePath, artifactRoot);
    const afterRestart = await context.request.get(
      `${apiOrigin}/api/chat-export/${intakeId}`,
      {
        headers: ownerHeaders,
      },
    );
    expect(afterRestart.ok()).toBe(true);

    const isolated = await context.request.get(
      `${apiOrigin}/api/chat-export/${intakeId}`,
      {
        headers: { Authorization: `Bearer ${otherToken}` },
      },
    );
    expect(isolated.status()).toBe(404);

    const deleted = await context.request.delete(
      `${apiOrigin}/api/chat-export/${intakeId}`,
      {
        headers: ownerHeaders,
      },
    );
    expect(deleted.ok()).toBe(true);
    const finalList = await context.request.get(
      `${apiOrigin}/api/chat-export`,
      {
        headers: ownerHeaders,
      },
    );
    expect(
      ((await finalList.json()) as typeof list).data.conversations,
    ).toHaveLength(0);
    const remainingArtifacts = await readdir(artifactRoot, {
      recursive: true,
    }).catch(() => []);
    expect(
      remainingArtifacts.filter((entry) => entry.endsWith(".json")),
    ).toHaveLength(0);

    await testInfo.attach("phase4-persistence-evidence.json", {
      body: Buffer.from(
        JSON.stringify({
          intakeId,
          messageCount: 6,
          rawArtifactStatus: "stored",
          duplicateCount: 1,
          restartStatus: afterRestart.status(),
          isolatedStatus: isolated.status(),
          deletionStatus: deleted.status(),
          candidateId,
          batonTaskCount: baton.created(),
        }),
      ),
      contentType: "application/json",
    });
  } finally {
    await context?.close().catch(() => undefined);
    await stopApi(api);
    await new Promise<void>(
      (resolvePromise) =>
        baton?.server.close(() => resolvePromise()) || resolvePromise(),
    );
    await rm(root, { recursive: true, force: true }).catch(() => undefined);
  }
});
