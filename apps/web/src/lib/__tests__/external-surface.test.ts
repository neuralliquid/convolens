import fs from "node:fs";
import path from "node:path";

const appRoot = path.resolve(__dirname, "../..");
const repoRoot = path.resolve(appRoot, "../../..");

const read = (relativePath: string) =>
  fs.readFileSync(path.join(appRoot, relativePath), "utf8");
const readRepo = (relativePath: string) =>
  fs.readFileSync(path.join(repoRoot, relativePath), "utf8");

describe("external surface containment", () => {
  it("keeps public, authenticated import, and navigation content on one responsive grid", () => {
    expect(read("app/page-wrapper.tsx")).toContain(
      "mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8",
    );
    expect(read("app/dashboard/import/page.tsx")).toContain(
      "mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8",
    );

    const navigationStyles = read(
      "components/layouts/navigation/navigation.module.css",
    );
    expect(navigationStyles).toContain("max-width: 80rem");
    expect(navigationStyles).toContain("padding: 0 1rem");
    expect(navigationStyles).toMatch(
      /@media \(min-width: 640px\) \{\s+\.container \{\s+padding: 0 1\.5rem/,
    );
    expect(navigationStyles).toContain("padding: 0 2rem");
  });

  it("keeps internal strategy and unshipped platform names out of public copy", () => {
    const externalCopy = [
      "app/landing-page.tsx",
      "app/features/page.tsx",
      "components/layouts/footer/index.tsx",
      "app/layout.tsx",
      "app/login/page.tsx",
      "app/extension-welcome/page.tsx",
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

  it("ships the welcome route opened on extension installation", () => {
    const extensionBackground = readRepo(
      "apps/chrome-extension/src/background.ts",
    );

    expect(extensionBackground).toMatch(/\/extension-welcome/);
    expect(
      fs.existsSync(path.join(appRoot, "app/extension-welcome/page.tsx")),
    ).toBe(true);
    expect(read("app/extension-welcome/page.tsx")).toMatch(
      /ConvoLens is installed/i,
    );
  });

  it("reads the wrapped WhatsApp connection status returned by the extension", () => {
    const popupRuntime = readRepo("apps/chrome-extension/popup/popup.js");

    expect(popupRuntime).toMatch(/const connectionStatus = response\.data \|\| response/);
    expect(popupRuntime).toMatch(
      /connectionStatus\.isWhatsAppWeb && connectionStatus\.isLoggedIn/,
    );
  });

  it("uses explicit production typography and non-wrapping desktop navigation", () => {
    const globalStyles = read("app/globals.css");
    const navigationStyles = read(
      "components/layouts/navigation/navigation.module.css",
    );

    expect(globalStyles).toMatch(/--font-sans:\s*Arial, Helvetica/);
    expect(globalStyles).toMatch(/body\s*{[^}]*font-family:\s*var\(--font-sans\)/s);
    expect(globalStyles).toMatch(/button,[\s\S]*textarea\s*{\s*font:\s*inherit/);
    expect(navigationStyles).toMatch(/\.navLink\s*{[^}]*white-space:\s*nowrap/s);
    expect(navigationStyles).toMatch(
      /\.mobileMenuButton\s*{\s*display:\s*none\s*!important/,
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
