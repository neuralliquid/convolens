import fs from "node:fs";
import path from "node:path";

const appRoot = path.resolve(__dirname, "../..");
const repoRoot = path.resolve(appRoot, "../../..");

const read = (relativePath: string) =>
  fs.readFileSync(path.join(appRoot, relativePath), "utf8");
const readRepo = (relativePath: string) =>
  fs.readFileSync(path.join(repoRoot, relativePath), "utf8");

describe("external surface containment", () => {
  it("keeps internal strategy and unshipped platform names out of public copy", () => {
    const externalCopy = [
      "app/landing-page.tsx",
      "app/features/page.tsx",
      "components/layouts/footer/index.tsx",
      "app/layout.tsx",
      "app/login/page.tsx",
      "app/dashboard/page.tsx",
      "app/dashboard/import/page.tsx",
    ]
      .map(read)
      .concat([
        readRepo("apps/chrome-extension/manifest.json"),
        readRepo("apps/chrome-extension/popup/popup.html"),
      ])
      .join("\n");

    expect(externalCopy).not.toMatch(
      /\b(?:alpha|moat|operating loop|NeuralLiquid stack|Codeflow|Cognitive Mesh|OmniPost|governed responses?)\b/i,
    );
    expect(externalCopy).not.toMatch(
      /(?:defensible asset|sample activity|demo records?)/i,
    );
    expect(read("app/login/page.tsx")).not.toMatch(
      /(?:browser extension|ConvoLens Alpha|alpha team|new to the alpha)/i,
    );
    expect(read("app/dashboard/import/page.tsx")).toMatch(/text export/i);
    expect(read("app/dashboard/import/page.tsx")).toMatch(/browser extension/i);
    expect(read("app/dashboard/import/page.tsx")).toMatch(/planned/i);
  });

  it("does not ship the developer theme-test route", () => {
    expect(fs.existsSync(path.join(appRoot, "app/test-theme/page.tsx"))).toBe(
      false,
    );
  });

  it("keeps preview navigation limited to implemented workflows", () => {
    const navigation = [
      "components/layouts/navigation/hooks/useNavigation.ts",
      "components/layouts/navigation/Navigation.tsx",
    ]
      .map(read)
      .join("\n");

    expect(navigation).not.toMatch(
      /(?:\/groups|\/notifications|\/customize|\/settings|\/profile)/,
    );
  });

  it("prevents search indexing during the private preview", () => {
    expect(read("app/robots.ts")).toMatch(/disallow:\s*["']\/["']/);
    expect(read("app/layout.tsx")).toMatch(/index:\s*false/);
    expect(read("app/layout.tsx")).toMatch(/follow:\s*false/);
  });
});
