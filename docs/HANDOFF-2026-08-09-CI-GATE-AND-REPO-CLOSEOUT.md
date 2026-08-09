# CI pattern gates and repository closeout handoff

Date: 2026-08-09

## Outcome

PR [#189](https://github.com/neuralliquid/convolens/pull/189) recovers the
durable portion of unpublished local commit `93ec45f` without carrying forward
its superseded authentication and API-documentation changes.

The PR:

- runs every API Jest suite matched by `apps/api/jest.config.js` instead of a
  hand-maintained file list;
- discovers workspace `typecheck` scripts recursively, with the existing web
  type-error baseline as the only documented exclusion;
- adds explicit `typecheck` scripts for the web and monitoring packages;
- removes Testing Library packages that are not global type packages from the
  web TypeScript `types` array; and
- updates the extension release-evidence contract so CI rejects a return to an
  explicit API test-path allowlist.

## Review and verification

Implementation commit before this handoff: `a0eb4daf322c5043130c61104b392a90c22b4557`.

- Recursive typecheck passed across seven workspace projects.
- All 16 API suites and 165 tests passed.
- All 167 extension tests passed after the workflow-contract update.
- Exact-head GitHub Actions run
  [31303824238](https://github.com/neuralliquid/convolens/actions/runs/31303824238)
  passed before this handoff was added.
- The initial thread-aware ready-state review query reported no reviews,
  comments, or review threads.
- Manual self-review found no correctness, security, or privacy issue in the
  implementation diff.

Because this handoff changes the PR head, merge still requires fresh exact-head
CI, a repeated thread-aware review query, a current base comparison, and clean
mergeability.

## Repository cleanup completed

The two superseded linked worktrees and their filesystem remnants were removed.
Eight obsolete local branches and eleven obsolete remote topic branches were
removed only after their merged, closed, or superseded PR dispositions were
verified. The remaining worktrees and branches are `main` plus the PR #189
worktree and branch.

The primary checkout intentionally retains the untracked repository guidance
file `AGENTS.md`.

## Open boundaries

- `@convolens/web` remains excluded from the recursive typecheck gate because
  its existing baseline is not clean and `next.config.mjs` still ignores build
  type errors. Drive that baseline to zero before removing the exclusion.
- GitHub reported one high-severity default-branch Dependabot alert during the
  PR push. Baton task `0822e9fc-9a20-4b60-bd8b-4494ba786f76` remains open for
  alert `328`.
- Local CodeRabbit CLI review was unavailable because the CLI is not installed.
  GitHub bot reviews and review threads must be checked again at the final PR
  head before merge.
- CI, deployment, and this repository cleanup do not prove authentic WhatsApp
  intake or grounded-todo/Baton publication acceptance. Those staffed gates
  remain open and require their own explicit authorization.

## Baton

Task `58aac86f-af30-4aff-a45f-6904e8f4ebd6`, **Replace hand-listed CI gates
with pattern-derived discovery**, tracks PR #189 and closes only after the PR is
merged and post-merge state is verified.
