import { readFileSync } from "node:fs";

const read = (path: string) =>
  readFileSync(new URL(path, import.meta.url), "utf8");

describe("web quality gates", () => {
  it("lints and typechecks the web workspace in CI without a Next escape hatch", () => {
    const workflow = read("../../../../../.github/workflows/ci.yml");
    const nextConfig = read("../../../next.config.mjs");
    const packageJson = JSON.parse(read("../../../package.json"));

    expect(workflow).toMatch(/pnpm --filter @convolens\/web lint/);
    expect(workflow).toMatch(/pnpm -r run typecheck/);
    expect(workflow).toMatch(
      /pnpm --filter @convolens\/web run test -- src\/lib\/__tests__\/quality-gates\.test\.ts --runInBand/,
    );
    expect(workflow).not.toMatch(/!@convolens\/web/);
    expect(nextConfig).not.toMatch(/ignoreBuildErrors/);
    expect(packageJson.scripts.pretypecheck).toContain(
      "@convolens/contexts build",
    );
    expect(packageJson.scripts.pretypecheck).toContain("@convolens/ui build");
  });
});
