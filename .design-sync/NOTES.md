# design-sync notes — @convolens/ui

First sync: 2026-08-17. Storybook shape, 6 storied components (Button, Card,
DropdownMenu, Input, Label, ThemeProvider) under `packages/ui`. All 6 graded
`match` on the first pass — no owned previews (`.design-sync/previews/`) were
needed.

## Repo-specific gotchas

- **`cfg.cssEntry` cannot point at `apps/web/src/app/globals.css`.** That's
  the DS's real stylesheet (Storybook's own `.storybook/preview.tsx` imports
  it directly — same file apps/web's `layout.tsx` imports), but the
  converter bounds `cssEntry` to `PKG_DIR` (`packages/ui`) by design — its
  content ships verbatim, so a path outside the package would let a
  malicious config exfiltrate repo files. `@convolens/ui` ships **no
  compiled CSS of its own** (it's a Tailwind-class component set, styled
  entirely by the consuming app's stylesheet) — there is no in-bounds file
  to point `cssEntry` at. **Do not re-attempt setting `cssEntry`** on a
  future sync; leave it unset. The converter's `[CSS_FROM_STORYBOOK]`
  fallback correctly scrapes the real compiled CSS out of
  `.design-sync/sb-reference` (which already went through the real
  `globals.css` via Storybook's preview import) — this is the intended path
  for this repo, not a degraded fallback.
- **Brand token shadowing (fixed 2026-08-17, Baton task 13f85318,
  commit 6548981):** `apps/web/src/app/global-styles.css` used to declare
  unlayered `--primary`/`--secondary` that silently beat the real `@layer
  base` tokens in `globals.css` per CSS cascade-layer rules (unlayered
  always wins), making `bg-primary`/`text-primary` etc. compute to an
  invalid transparent color app-wide. Renamed to `--legacy-primary`/
  `--legacy-secondary`. The scraped CSS design-sync ships reflects the
  **fixed** state (real brand tokens render correctly) — if a future sync's
  token colors look wrong, check whether this shadowing regressed before
  assuming a design-sync bug.
- **DropdownMenu hardcoded-gray fix (commit 8ec9b31f):** apps/web previously
  had a local DropdownMenu copy that drifted to hardcoded grays instead of
  `bg-popover`/`bg-accent`. Fixed by migrating apps/web onto `@convolens/ui`'s
  version (the one this sync ships). No action needed here — just context if
  colors ever look off again.
- **Input's `SearchWithError` story is capture-flaky, not broken.** The
  error text is a framer-motion `AnimatePresence`/`motion.p` element
  (`initial`/`animate` variants). On the first `compare.mjs` capture it can
  be photographed before the mount-animation's `animate` effect has
  committed, stranding it at `initial` (opacity: 0) — the DS preview bundle
  is heavier than storybook's own iframe, so it occasionally loses this
  race. Confirmed NOT a real defect: a direct render with no animation
  freeze shows the text after ~50ms, and a plain recapture (no `--force`)
  reliably shows it correctly. If a future sync shows this story's grade
  cleared with the red error text missing, recapture once before treating
  it as a regression.
- No component in this DS loads remote/CDN images — the `[ASSETS_BLOCKED]`
  canary doesn't apply here; no need to keep re-checking for it.
- `tokens: 121 defined, 53 referenced (3 missing, below threshold)` in
  validate — non-blocking, not chased (below the warn threshold).

## Re-sync risks

- If `@convolens/ui` ever grows its own compiled stylesheet (a `dist/*.css`
  sidecar), reconsider `cssEntry`/`tokensPkg` — the current
  `[CSS_FROM_STORYBOOK]` reliance assumes Storybook's preview keeps
  importing the same app-level stylesheet the library is actually styled
  by; if that import is ever removed or repointed, the scrape would start
  reflecting the wrong (or no) CSS silently.
- The brand-token shadowing bug above is an app-level (`apps/web`) CSS
  ordering hazard, not something design-sync can detect — it would only
  show up here as tokens rendering wrong in scraped CSS.
- `SearchWithError`'s capture-flake (above) — re-verify once if it recurs,
  don't chase it as a real bug without first checking with a longer-settle
  render.
