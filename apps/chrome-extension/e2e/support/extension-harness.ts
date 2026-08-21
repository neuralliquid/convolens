import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  chromium,
  test as base,
  type BrowserContext,
  type Page,
  type TestInfo,
  type Worker,
} from "@playwright/test";

const supportDir = dirname(fileURLToPath(import.meta.url));
const extensionRoot = resolve(supportDir, "../..");
const extensionPath = extensionRoot;
const fixturePath = resolve(supportDir, "../fixtures/whatsapp-web.html");
const apiOrigin = "http://localhost:3001";
const conversationId = "1d3e4567-e89b-42d3-a456-426614174000";

export interface CapturedRequest {
  authorization?: string;
  body: Record<string, unknown>;
  correlationId?: string;
  source?: string;
}

export interface AttributedConsoleMessage {
  source: "page" | "service-worker";
  type: string;
  text: string;
}

export interface ExtensionHarness {
  apiRequests: CapturedRequest[];
  consoleMessages: AttributedConsoleMessage[];
  context: BrowserContext;
  extensionPage: Page;
  extensionId: string;
  page: Page;
  serviceWorker: Worker;
}

async function readBody(request: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}

function json(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, {
    "content-type": "application/json",
    "cache-control": "no-store",
  });
  response.end(JSON.stringify(body));
}

async function startFixtureApi(apiRequests: CapturedRequest[]) {
  const server = createServer(async (request, response) => {
    const url = new URL(request.url || "/", apiOrigin);
    if (
      request.method === "POST" &&
      url.pathname === "/api/chat-export/extension"
    ) {
      const body = JSON.parse(await readBody(request)) as Record<
        string,
        unknown
      >;
      apiRequests.push({
        authorization: request.headers.authorization,
        body,
        correlationId: request.headers["x-correlation-id"] as
          | string
          | undefined,
        source: request.headers["x-source"] as string | undefined,
      });
      const duplicate = apiRequests.length > 1;
      json(response, 200, {
        message: duplicate
          ? "Conversation was already received"
          : "Chat data received successfully",
        duplicate,
        reconciliationRequired: false,
        data: {
          chatId: body.chatId,
          intakeId: conversationId,
          chatName: "Fixture Group",
          messageCount: body.messageCount,
          receivedAt: "2026-07-30T08:00:00.000Z",
          dashboardUrl: `/dashboard/conversations/${conversationId}`,
          reconciliationRequired: false,
        },
      });
      return;
    }
    if (request.method === "POST" && url.pathname === "/api/auth/login") {
      json(response, 200, {
        token: "fixture-owner-b-token",
        user: { id: "fixture-owner-b", email: "owner-b@example.test" },
      });
      return;
    }
    json(response, 404, { error: "Fixture route not found" });
  });
  await new Promise<void>((resolvePromise, reject) => {
    server.once("error", reject);
    server.listen(3001, resolvePromise);
  });
  return server;
}

async function waitForExtensionWorker(
  context: BrowserContext,
): Promise<Worker> {
  return (
    context
      .serviceWorkers()
      .find((worker) => worker.url().startsWith("chrome-extension://")) ||
    (await context.waitForEvent("serviceworker", {
      predicate: (worker) => worker.url().startsWith("chrome-extension://"),
    }))
  );
}

async function attachConsoleEvidence(
  context: BrowserContext,
  messages: AttributedConsoleMessage[],
): Promise<void> {
  const observedPages = new WeakSet<Page>();
  const observedWorkers = new WeakSet<Worker>();
  const observePage = (page: Page) => {
    if (observedPages.has(page)) return;
    observedPages.add(page);
    page.on("console", (message) =>
      messages.push({
        source: "page",
        type: message.type(),
        text: message.text(),
      }),
    );
  };
  const observeWorker = (worker: Worker) => {
    if (observedWorkers.has(worker)) return;
    observedWorkers.add(worker);
    worker.on("console", (message) =>
      messages.push({
        source: "service-worker",
        type: message.type(),
        text: message.text(),
      }),
    );
  };
  context.pages().forEach(observePage);
  context.serviceWorkers().forEach(observeWorker);
  context.on("page", observePage);
  context.on("serviceworker", observeWorker);
}

async function attachEvidence(
  testInfo: TestInfo,
  harness: ExtensionHarness,
): Promise<void> {
  await testInfo.attach("extension-console-attribution.json", {
    body: Buffer.from(JSON.stringify(harness.consoleMessages, null, 2)),
    contentType: "application/json",
  });
  await testInfo.attach("fixture-api-requests.json", {
    body: Buffer.from(
      JSON.stringify(
        harness.apiRequests.map(
          ({ authorization, body, correlationId, source }) => ({
            body,
            correlationId,
            source,
            authorizationPresent: Boolean(authorization),
          }),
        ),
        null,
        2,
      ),
    ),
    contentType: "application/json",
  });
}

export const test = base.extend<{ harness: ExtensionHarness }>({
  harness: async ({}, use, testInfo) => {
    const apiRequests: CapturedRequest[] = [];
    const consoleMessages: AttributedConsoleMessage[] = [];
    const profileDir = await mkdtemp(
      resolve(tmpdir(), "convolens-pw-fixture-"),
    );
    let fixtureApi: Awaited<ReturnType<typeof startFixtureApi>> | undefined;
    let context: BrowserContext | undefined;
    try {
      fixtureApi = await startFixtureApi(apiRequests);
      const fixtureHtml = await readFile(fixturePath, "utf8");
      context = await chromium.launchPersistentContext(profileDir, {
        channel: "chromium",
        // MV3 service workers must run in the full bundled Chromium process.
        // Linux CI supplies a virtual display with xvfb-run.
        headless: false,
        args: [
          `--disable-extensions-except=${extensionPath}`,
          `--load-extension=${extensionPath}`,
          "--host-resolver-rules=MAP convolens.neuralliquid.ai ~NOTFOUND, MAP nl-prod-convolens-api.thankfulwave-56b90601.southafricanorth.azurecontainerapps.io ~NOTFOUND, MAP nl-prod-convolens-api.calmmoss-612abacc.southafricanorth.azurecontainerapps.io ~NOTFOUND, MAP api.convolens.com ~NOTFOUND, MAP api.convolens.neuralliquid.ai ~NOTFOUND, EXCLUDE localhost",
        ],
      });
      await attachConsoleEvidence(context, consoleMessages);
      await context.route("https://web.whatsapp.com/**", (route) =>
        route.fulfill({
          status: 200,
          contentType: "text/html",
          body: fixtureHtml,
        }),
      );
      await context.route("https://convolens.neuralliquid.ai/**", (route) =>
        route.fulfill({
          status: 200,
          contentType: "text/html",
          body: "<!doctype html><title>Fixture dashboard</title>",
        }),
      );
      const serviceWorker = await waitForExtensionWorker(context);
      const extensionId = new URL(serviceWorker.url()).host;
      const existingPages = context.pages();
      const extensionPage = await context.newPage();
      await extensionPage.goto(
        `chrome-extension://${extensionId}/options/options.html`,
      );
      for (const existingPage of existingPages) await existingPage.close();
      await extensionPage.evaluate(
        async ({ endpoint }) => {
          const chromeApi = (
            globalThis as typeof globalThis & { chrome: typeof chrome }
          ).chrome;
          await chromeApi.storage.local.clear();
          await chromeApi.storage.session.clear();
          await chromeApi.storage.local.set({
            authToken: "fixture-owner-a-token",
            authTokenExpiresAt: Date.now() + 3_600_000,
            user: { id: "fixture-owner-a", email: "owner-a@example.test" },
            settings: { apiEndpoint: endpoint },
          });
        },
        { endpoint: apiOrigin },
      );

      const page = await context.newPage();
      await page.goto("https://web.whatsapp.com/");
      await page.locator("#convolens-fab").waitFor();

      const harness = {
        apiRequests,
        consoleMessages,
        context,
        extensionPage,
        extensionId,
        page,
        serviceWorker,
      };
      await use(harness);
      await attachEvidence(testInfo, harness);
    } finally {
      if (context) await context.close().catch(() => undefined);
      if (fixtureApi) {
        await new Promise<void>((resolvePromise) =>
          fixtureApi?.close(() => resolvePromise()),
        );
      }
      await rm(profileDir, { force: true, recursive: true }).catch(
        () => undefined,
      );
    }
  },
});

export { expect } from "@playwright/test";
