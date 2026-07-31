import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import { isAbsolute, relative, resolve } from "node:path";

const extensionRoot = resolve(import.meta.dirname, "..");
const extensionPath = extensionRoot;
const defaultProfile = process.env.LOCALAPPDATA
  ? resolve(
      process.env.LOCALAPPDATA,
      "ConvoLens",
      "Playwright",
      "acceptance-profile",
    )
  : resolve(homedir(), ".convolens", "playwright", "acceptance-profile");
const configuredProfile =
  process.env.CONVOLENS_PW_PROFILE_DIR || defaultProfile;
if (!isAbsolute(configuredProfile)) {
  throw new Error("CONVOLENS_PW_PROFILE_DIR must be an absolute path.");
}
const profileDir = resolve(configuredProfile);
const repositoryRoot = resolve(extensionRoot, "../..");
const relativeToRepo = relative(repositoryRoot, profileDir);
const profileInsideRepository =
  relativeToRepo === "" ||
  (!relativeToRepo.startsWith("..") && !isAbsolute(relativeToRepo));

if (profileInsideRepository) {
  throw new Error(
    "CONVOLENS_PW_PROFILE_DIR must be an absolute path outside the repository.",
  );
}

await mkdir(profileDir, { recursive: true });
const context = await chromium.launchPersistentContext(profileDir, {
  channel: "chromium",
  headless: false,
  args: [
    `--disable-extensions-except=${extensionPath}`,
    `--load-extension=${extensionPath}`,
  ],
});

try {
  const worker =
    context
      .serviceWorkers()
      .find((candidate) => candidate.url().startsWith("chrome-extension://")) ||
    (await context.waitForEvent("serviceworker", {
      predicate: (candidate) =>
        candidate.url().startsWith("chrome-extension://"),
    }));
  const whatsapp = await context.newPage();
  const convolens = await context.newPage();
  const extensionPage = await context.newPage();
  await Promise.all([
    whatsapp.goto("https://web.whatsapp.com/"),
    convolens.goto("https://convolens.neuralliquid.ai/login"),
    extensionPage.goto(
      `chrome-extension://${new URL(worker.url()).host}/options/options.html`,
    ),
  ]);
  console.log(
    "Complete WhatsApp QR and ConvoLens/Mystira sign-in in the visible browser. No cookie or token values will be printed.",
  );

  await whatsapp
    .locator('[data-testid="chat-list"], #pane-side')
    .first()
    .waitFor({ timeout: 10 * 60_000 });

  const deadline = Date.now() + 10 * 60_000;
  let authenticated = false;
  while (!authenticated && Date.now() < deadline) {
    authenticated = await extensionPage.evaluate(async () => {
      const chromeApi = (
        globalThis as typeof globalThis & { chrome: typeof chrome }
      ).chrome;
      await chromeApi.runtime.sendMessage({ action: "SYNC_MYSTIRA_AUTH" });
      const result = await chromeApi.runtime.sendMessage({
        action: "GET_AUTH_STATUS",
      });
      return Boolean(result?.success && result?.data?.isAuthenticated);
    });
    if (!authenticated)
      await new Promise((resolvePromise) => setTimeout(resolvePromise, 2_000));
  }
  if (!authenticated) {
    throw new Error(
      "ConvoLens authentication was not established before the provisioning timeout.",
    );
  }
  console.log(
    `Provisioned a dedicated Playwright acceptance profile at ${profileDir}.`,
  );
} finally {
  await context.close();
}
