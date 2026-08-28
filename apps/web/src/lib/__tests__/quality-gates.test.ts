import { readFileSync } from "node:fs";

const read = (path: string) =>
  readFileSync(new URL(path, import.meta.url), "utf8");

describe("web quality gates", () => {
  it("typechecks the web workspace in CI without a Next escape hatch", () => {
    const workflow = read("../../../../../.github/workflows/ci.yml");
    const nextConfig = read("../../../next.config.mjs");
    const packageJson = JSON.parse(read("../../../package.json"));

    expect(workflow).toMatch(/pnpm -r run typecheck/);
    expect(workflow).not.toMatch(/!@convolens\/web/);
    expect(nextConfig).not.toMatch(/ignoreBuildErrors/);
    expect(packageJson.scripts.pretypecheck).toContain(
      "@convolens/contexts build",
    );
    expect(packageJson.scripts.pretypecheck).toContain("@convolens/ui build");
  });
});
