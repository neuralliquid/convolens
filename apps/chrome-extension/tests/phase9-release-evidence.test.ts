import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { test } from "node:test";
import { resolve } from "node:path";
import ts from "typescript";

const read = (path: string) =>
  readFileSync(new URL(path, import.meta.url), "utf8");
const includesPreloadToken = (value: string) =>
  value.split(/\s+/).some((token) => token.toLowerCase() === "preload");

const jsxRelValue = (attribute: ts.JsxAttribute): string | undefined => {
  const initializer = attribute.initializer;
  if (!initializer) return undefined;
  if (ts.isStringLiteral(initializer)) return initializer.text;
  if (
    ts.isJsxExpression(initializer) &&
    initializer.expression &&
    (ts.isStringLiteral(initializer.expression) ||
      ts.isNoSubstitutionTemplateLiteral(initializer.expression))
  ) {
    return initializer.expression.text;
  }
  return undefined;
};

const jsxHasAuthoredPreload = (source: string) => {
  const sourceFile = ts.createSourceFile(
    "inventory.tsx",
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  let found = false;
  const visit = (node: ts.Node) => {
    if (
      (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) &&
      node.tagName.getText(sourceFile) === "link"
    ) {
      if (node.attributes.properties.some(ts.isJsxSpreadAttribute)) {
        found = true;
        return;
      }
      const rel = node.attributes.properties.find(
        (attribute): attribute is ts.JsxAttribute =>
          ts.isJsxAttribute(attribute) &&
          attribute.name.getText(sourceFile).toLowerCase() === "rel",
      );
      if (rel) {
        const value = jsxRelValue(rel);
        if (value === undefined || includesPreloadToken(value)) found = true;
      }
    }
    if (!found) ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return found;
};

const htmlHasAuthoredPreload = (source: string) => {
  const withoutComments = source.replace(/<!--[\s\S]*?-->/g, "");
  const tags: string[] = [];
  const lower = withoutComments.toLowerCase();
  let searchFrom = 0;
  while (searchFrom < withoutComments.length) {
    const start = lower.indexOf("<link", searchFrom);
    if (start === -1) break;
    const boundary = withoutComments[start + 5];
    if (boundary && !/[\s/>]/.test(boundary)) {
      searchFrom = start + 5;
      continue;
    }
    let quote: '"' | "'" | null = null;
    let end = start + 5;
    for (; end < withoutComments.length; end += 1) {
      const character = withoutComments[end];
      if (quote) {
        if (character === quote) quote = null;
      } else if (character === '"' || character === "'") {
        quote = character;
      } else if (character === ">") {
        tags.push(withoutComments.slice(start, end + 1));
        break;
      }
    }
    searchFrom = end + 1;
  }
  for (const tag of tags) {
    let index = 5;
    while (index < tag.length) {
      while (/\s/.test(tag[index] ?? "")) index += 1;
      if (tag[index] === "/" || tag[index] === ">") break;
      const nameStart = index;
      while (index < tag.length && !/[\s=/>]/.test(tag[index])) index += 1;
      const name = tag.slice(nameStart, index).toLowerCase();
      while (/\s/.test(tag[index] ?? "")) index += 1;
      let value = "";
      if (tag[index] === "=") {
        index += 1;
        while (/\s/.test(tag[index] ?? "")) index += 1;
        const quote =
          tag[index] === '"' || tag[index] === "'" ? tag[index] : null;
        if (quote) {
          const valueStart = ++index;
          while (index < tag.length && tag[index] !== quote) index += 1;
          value = tag.slice(valueStart, index);
          if (tag[index] === quote) index += 1;
        } else {
          const valueStart = index;
          while (index < tag.length && !/[\s>]/.test(tag[index])) index += 1;
          value = tag.slice(valueStart, index);
        }
      }
      if (name === "rel" && includesPreloadToken(value)) return true;
    }
  }
  return false;
};

test("keeps release versions aligned and package inspection mandatory", () => {
  const manifest = JSON.parse(read("../manifest.json"));
  const packageJson = JSON.parse(read("../package.json"));
  assert.equal(manifest.version, "1.0.20");
  assert.equal(packageJson.version, manifest.version);
  assert.match(
    packageJson.scripts.package,
    /package-extension\.mjs && node scripts\/verify-package\.mjs$/,
  );
});

test("runs extension, intake, and inspected-package evidence in CI", () => {
  const workflow = read("../../../.github/workflows/ci.yml");
  assert.match(workflow, /@convolens\/chrome-extension test/);
  assert.match(
    workflow,
    /jest --config=jest\.config\.js --runInBand src\/services\/__tests__\/conversation-intake\.service\.test\.ts/,
  );
  assert.match(workflow, /@convolens\/chrome-extension package/);
});

test("records the authored web preload inventory deterministically", () => {
  for (const source of [
    '<link rel="preload" />',
    '<link rel = "preload" />',
    '<link rel={"preload"} />',
    "<link rel = {'preload'} />",
    "<link rel={`preload`} />",
    '<link rel="stylesheet preload" />',
  ]) {
    assert.equal(jsxHasAuthoredPreload(source), true);
  }
  assert.equal(htmlHasAuthoredPreload("<link rel=preload>"), true);
  assert.equal(jsxHasAuthoredPreload('<link {...{ rel: "preload" }} />'), true);
  assert.equal(jsxHasAuthoredPreload("<link {...linkProps} />"), true);
  assert.equal(jsxHasAuthoredPreload("<link rel={relation} />"), true);
  assert.equal(jsxHasAuthoredPreload('<link rel="preloader" />'), false);
  assert.equal(jsxHasAuthoredPreload('<Widget rel="preload" />'), false);
  assert.equal(jsxHasAuthoredPreload("<Link {...props} />"), false);
  assert.equal(htmlHasAuthoredPreload('<link-preview rel="preload">'), false);
  assert.equal(htmlHasAuthoredPreload('<link data-rel="preload">'), false);
  assert.equal(
    htmlHasAuthoredPreload('<link title="rel=preload" href="/">'),
    false,
  );
  assert.equal(
    htmlHasAuthoredPreload('<link title="1 > 0" rel="preload">'),
    true,
  );
  assert.equal(
    jsxHasAuthoredPreload(`const fixture = '<link rel="preload">';`),
    false,
  );
  assert.equal(jsxHasAuthoredPreload(`{/* <link rel="preload" /> */}`), false);
  assert.equal(htmlHasAuthoredPreload(`<!-- <link rel="preload"> -->`), false);
  const webRoot = new URL("../../web/src/", import.meta.url);
  const files = readdirSync(webRoot, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .filter((entry) => /\.(?:tsx?|jsx?|html)$/.test(entry.name));
  const authoredPreloads = files.filter((entry) => {
    const source = readFileSync(resolve(entry.parentPath, entry.name), "utf8");
    return entry.name.endsWith(".html")
      ? htmlHasAuthoredPreload(source)
      : jsxHasAuthoredPreload(source);
  });
  assert.deepEqual(authoredPreloads, []);
});
