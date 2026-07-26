import fs from "node:fs";
import path from "node:path";

const appRoot = path.resolve(__dirname, "../..");

const read = (relativePath: string) =>
  fs.readFileSync(path.join(appRoot, relativePath), "utf8");

describe("external surface containment", () => {
  it("keeps internal strategy and unshipped platform names out of public copy", () => {
    const publicCopy = [
      "app/landing-page.tsx",
      "app/features/page.tsx",
      "components/layouts/footer/index.tsx",
      "app/layout.tsx",
      "app/login/page.tsx",
    ]
      .map(read)
      .join("\n");

    expect(publicCopy).not.toMatch(
      /\b(?:moat|operating loop|NeuralLiquid stack|Codeflow|Cognitive Mesh|OmniPost|governed responses?)\b/i,
    );
    expect(publicCopy).not.toMatch(/defensible asset/i);
    expect(read("app/login/page.tsx")).not.toMatch(
      /(?:browser extension|ConvoLens Alpha|alpha team|new to the alpha)/i,
    );
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
