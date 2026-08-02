import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const popupSource = readFileSync(
  new URL("../popup/popup.js", import.meta.url),
  "utf8",
);
const popupHtml = readFileSync(
  new URL("../popup/popup.html", import.meta.url),
  "utf8",
);
const manifest = JSON.parse(
  readFileSync(new URL("../manifest.json", import.meta.url), "utf8"),
);
const packageJson = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
);

test("renders the runtime manifest version and keeps release versions aligned", () => {
  assert.match(popupHtml, /id="extensionVersion"/);
  assert.match(
    popupSource,
    /extensionVersion\.textContent = `v\$\{chrome\.runtime\.getManifest\(\)\.version\}`/,
  );
  assert.equal(manifest.version, packageJson.version);
  assert.equal(manifest.version, "1.0.23");
});

test("opens the conversation dashboard from both popup entry points", () => {
  assert.match(popupHtml, /id="dashboardLink"/);
  assert.match(
    popupSource,
    /dashboardLink\.href = `\$\{DASHBOARD_URL\}\/dashboard`/,
  );
  assert.match(
    popupSource,
    /openDashboard\.addEventListener\("click", \(\) => \{\s+openTab\(`\$\{DASHBOARD_URL\}\/dashboard`\)/,
  );
  assert.match(popupSource, /function openTab\(url\)/);
  assert.match(popupSource, /chrome\.tabs\s+\.create\(\{ url \}\)\s+\.catch/);
});

test("targets the active WhatsApp tab before searching background tabs", () => {
  const activeQuery = popupSource.indexOf("active: true");
  const urlQuery = popupSource.indexOf('url: "https://web.whatsapp.com/*"');

  assert.notEqual(activeQuery, -1);
  assert.notEqual(urlQuery, -1);
  assert.ok(activeQuery < urlQuery);
});

test("self-heals a missing content-script receiver and retries the message", () => {
  assert.ok(manifest.permissions.includes("scripting"));
  assert.match(popupSource, /chrome\.scripting\.insertCSS/);
  assert.match(popupSource, /chrome\.scripting\.executeScript/);
  assert.equal(manifest.minimum_chrome_version, "111");

  const receiverError = popupSource.indexOf("Receiving end does not exist");
  const bridgeInjection = popupSource.indexOf(
    'files: ["dist/whatsapp-page-identity.js"]',
  );
  const mainWorld = popupSource.indexOf('world: "MAIN"', bridgeInjection);
  const contentInjection = popupSource.indexOf(
    'files: ["dist/content.js"]',
    bridgeInjection,
  );
  const retry = popupSource.lastIndexOf("chrome.tabs.sendMessage");

  assert.ok(receiverError < bridgeInjection);
  assert.ok(bridgeInjection < mainWorld);
  assert.ok(mainWorld < contentInjection);
  assert.ok(contentInjection < retry);
});
