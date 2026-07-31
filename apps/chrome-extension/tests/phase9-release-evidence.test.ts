import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { test } from "node:test";
import { resolve } from "node:path";
import { parse } from "parse5";
import ts from "typescript";

const read = (path: string) =>
  readFileSync(new URL(path, import.meta.url), "utf8");
const includesPreloadToken = (value: string) =>
  value
    .split(/[\t\n\f\r ]+/)
    .some((token) => token.toLowerCase() === "preload");

type HtmlNode = {
  tagName?: string;
  attrs?: Array<{ name: string; value: string }>;
  childNodes?: HtmlNode[];
};

const decodeJsxLiteral = (
  initializer: ts.StringLiteral,
  sourceFile: ts.SourceFile,
) => {
  const emitted = ts.transpileModule(
    `const inventory = <link rel=${initializer.getText(sourceFile)} />;`,
    {
      compilerOptions: {
        jsx: ts.JsxEmit.React,
        target: ts.ScriptTarget.ESNext,
      },
    },
  ).outputText;
  const emittedSource = ts.createSourceFile(
    "inventory.js",
    emitted,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.JS,
  );
  let value: string | undefined;
  const visit = (node: ts.Node) => {
    if (
      ts.isPropertyAssignment(node) &&
      node.name.getText(emittedSource) === "rel" &&
      ts.isStringLiteral(node.initializer)
    ) {
      value = node.initializer.text;
      return;
    }
    if (value === undefined) ts.forEachChild(node, visit);
  };
  visit(emittedSource);
  return value;
};

const jsxRelValue = (
  attribute: ts.JsxAttribute,
  sourceFile: ts.SourceFile,
): string | undefined => {
  const initializer = attribute.initializer;
  if (!initializer) return undefined;
  if (ts.isStringLiteral(initializer)) {
    return decodeJsxLiteral(initializer, sourceFile);
  }
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

const scriptKindFor = (fileName: string) =>
  fileName.endsWith(".tsx")
    ? ts.ScriptKind.TSX
    : fileName.endsWith(".jsx")
      ? ts.ScriptKind.JSX
      : fileName.endsWith(".js")
        ? ts.ScriptKind.JS
        : ts.ScriptKind.TS;

const jsxSourcesWithAuthoredPreload = (
  sources: Array<{ fileName: string; source: string }>,
) => {
  const canonical = (path: string) => resolve(path).replaceAll("\\", "/").toLowerCase();
  const ambientFile = resolve("inventory-fixture", "react-dom-inventory.d.ts");
  const allSources = [
    ...sources,
    {
      fileName: ambientFile,
      source:
        'declare module "react-dom" { export function preload(href: string, options?: unknown): void; }',
    },
  ];
  const sourceByPath = new Map(
    allSources.map(({ fileName, source }) => [canonical(fileName), source]),
  );
  const compilerOptions: ts.CompilerOptions = {
    allowJs: true,
    jsx: ts.JsxEmit.React,
    moduleResolution: ts.ModuleResolutionKind.Node10,
    noEmit: true,
    noLib: true,
    skipLibCheck: true,
    target: ts.ScriptTarget.Latest,
  };
  const host = ts.createCompilerHost(compilerOptions);
  const defaultFileExists = host.fileExists.bind(host);
  const defaultDirectoryExists = host.directoryExists?.bind(host);
  const defaultGetSourceFile = host.getSourceFile.bind(host);
  const defaultReadFile = host.readFile.bind(host);
  host.fileExists = (path) =>
    sourceByPath.has(canonical(path)) || defaultFileExists(path);
  host.directoryExists = (path) => {
    const directory = `${canonical(path).replace(/\/$/, "")}/`;
    return (
      [...sourceByPath.keys()].some((sourcePath) =>
        sourcePath.startsWith(directory),
      ) ||
      defaultDirectoryExists?.(path) ||
      false
    );
  };
  host.getSourceFile = (path, languageVersion, onError, shouldCreateNew) => {
    const source = sourceByPath.get(canonical(path));
    return source !== undefined
      ? ts.createSourceFile(
          path,
          source,
          languageVersion,
          true,
          scriptKindFor(path),
        )
      : defaultGetSourceFile(path, languageVersion, onError, shouldCreateNew);
  };
  host.readFile = (path) =>
    sourceByPath.get(canonical(path)) ?? defaultReadFile(path);
  const program = ts.createProgram(
    allSources.map(({ fileName }) => fileName),
    compilerOptions,
    host,
  );
  const checker = program.getTypeChecker();
  const isReactDomPreload = (symbol: ts.Symbol | undefined) => {
    if (!symbol) return false;
    while (symbol.flags & ts.SymbolFlags.Alias) {
      const target = checker.getAliasedSymbol(symbol);
      if (target === symbol) break;
      symbol = target;
    }
    if (symbol.name !== "preload") return false;
    return symbol.declarations?.some((declaration) => {
      const path = canonical(declaration.getSourceFile().fileName);
      return (
        path === canonical(ambientFile) ||
        path.includes("/node_modules/@types/react-dom/index.d.ts")
      );
    });
  };
  const authored = new Set<string>();
  for (const { fileName } of sources) {
    const sourceFile = program.getSourceFile(fileName);
    if (!sourceFile) continue;
    let found = false;
    const visit = (node: ts.Node) => {
      if (ts.isCallExpression(node)) {
        const callee = ts.isPropertyAccessExpression(node.expression)
          ? node.expression.name
          : node.expression;
        if (isReactDomPreload(checker.getSymbolAtLocation(callee))) {
          found = true;
          return;
        }
      }
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
          const value = jsxRelValue(rel, sourceFile);
          if (value === undefined || includesPreloadToken(value)) found = true;
        }
      }
      if (!found) ts.forEachChild(node, visit);
    };
    visit(sourceFile);
    if (found) authored.add(fileName);
  }
  return authored;
};

const jsxHasAuthoredPreload = (source: string) =>
  jsxSourcesWithAuthoredPreload([
    { fileName: resolve("inventory-fixture", "inventory.tsx"), source },
  ]).size > 0;

const htmlHasAuthoredPreload = (source: string) => {
  const document = parse(source) as HtmlNode;
  const visit = (node: HtmlNode): boolean => {
    if (node.tagName === "link") {
      const rel = node.attrs?.find((attribute) => attribute.name === "rel");
      if (rel && includesPreloadToken(rel.value)) return true;
    }
    return node.childNodes?.some(visit) ?? false;
  };
  return visit(document);
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
    '<link rel="pre&#108;oad" />',
    `<link rel='x" preload' />`,
  ]) {
    assert.equal(jsxHasAuthoredPreload(source), true);
  }
  assert.equal(htmlHasAuthoredPreload("<link rel=preload>"), true);
  assert.equal(jsxHasAuthoredPreload('<link {...{ rel: "preload" }} />'), true);
  assert.equal(jsxHasAuthoredPreload("<link {...linkProps} />"), true);
  assert.equal(jsxHasAuthoredPreload("<link rel={relation} />"), true);
  assert.equal(jsxHasAuthoredPreload('<link rel="preloader" />'), false);
  assert.equal(jsxHasAuthoredPreload('<link rel={"pre&#108;oad"} />'), false);
  assert.equal(jsxHasAuthoredPreload('<link rel="x&#160;preload" />'), false);
  assert.equal(jsxHasAuthoredPreload('<link rel="x&#9preload" />'), false);
  assert.equal(jsxHasAuthoredPreload('<link rel="x&#9;preload" />'), true);
  assert.equal(jsxHasAuthoredPreload('<link rel="x&Tab;preload" />'), false);
  assert.equal(jsxHasAuthoredPreload('<link rel={"x\u00a0preload"} />'), false);
  assert.equal(jsxHasAuthoredPreload('<Widget rel="preload" />'), false);
  assert.equal(jsxHasAuthoredPreload("<Link {...props} />"), false);
  assert.equal(
    jsxHasAuthoredPreload(
      `import { preload } from "react-dom"; preload("/app.js", { as: "script" });`,
    ),
    true,
  );
  assert.equal(
    jsxHasAuthoredPreload(
      `import { preload as warm } from "react-dom"; warm("/app.js", { as: "script" });`,
    ),
    true,
  );
  assert.equal(
    jsxHasAuthoredPreload(
      `import * as ReactDOM from "react-dom"; ReactDOM.preload("/app.js", { as: "script" });`,
    ),
    true,
  );
  assert.equal(
    jsxHasAuthoredPreload(
      `import { preload } from "somewhere-else"; preload("/app.js");`,
    ),
    false,
  );
  assert.equal(jsxHasAuthoredPreload(`preload("/app.js");`), false);
  assert.equal(
    jsxHasAuthoredPreload(
      `import { preload } from "react-dom"; function run(preload: () => void) { preload(); }`,
    ),
    false,
  );
  assert.equal(
    jsxHasAuthoredPreload(
      `import * as ReactDOM from "react-dom"; function run(ReactDOM: { preload(): void }) { ReactDOM.preload(); }`,
    ),
    false,
  );
  assert.equal(
    jsxSourcesWithAuthoredPreload([
      {
        fileName: resolve("inventory-fixture", "hints.ts"),
        source: `export { preload as warm } from "react-dom";`,
      },
      {
        fileName: resolve("inventory-fixture", "consumer.tsx"),
        source: `import { warm } from "./hints"; warm("/app.js", { as: "script" });`,
      },
    ]).has(resolve("inventory-fixture", "consumer.tsx")),
    true,
  );
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
  assert.equal(htmlHasAuthoredPreload('<link rel="pre&#108;oad">'), true);
  assert.equal(htmlHasAuthoredPreload('<link rel="x&#160;preload">'), false);
  assert.equal(
    htmlHasAuthoredPreload(
      `<script>const fixture = '<link rel="preload">';</script>`,
    ),
    false,
  );
  assert.equal(
    htmlHasAuthoredPreload(
      `<style>link[rel="preload"] { color: red; }</style>`,
    ),
    false,
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
  const htmlPreloads = files.filter((entry) => {
    if (!entry.name.endsWith(".html")) return false;
    const source = readFileSync(resolve(entry.parentPath, entry.name), "utf8");
    return htmlHasAuthoredPreload(source);
  });
  const scriptSources = files
    .filter((entry) => !entry.name.endsWith(".html"))
    .map((entry) => ({
      fileName: resolve(entry.parentPath, entry.name),
      source: readFileSync(resolve(entry.parentPath, entry.name), "utf8"),
    }));
  assert.deepEqual(htmlPreloads, []);
  assert.deepEqual([...jsxSourcesWithAuthoredPreload(scriptSources)], []);
});
