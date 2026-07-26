# ConvoLens extension acceptance handoff — 2026-07-27

## Outcome at handoff

The public/import alignment work is deployed, and the Chrome extension recovery chain is merged through version 1.0.4. The remaining gate is an operator-held WhatsApp send from the actual Chrome profile; do not mark extension acceptance complete until that send is visible in ConvoLens and the persistence checks below pass.

The first implementation task in the next session is to display the running extension version in the popup so screenshots and support reports identify the loaded build without opening `chrome://extensions`.

## Verified repository and runtime state

- Current `origin/main`: `29f865db4e9fbeda02a9d38ad1e03a18c97b82df`.
- PR [#134](https://github.com/neuralliquid/convolens/pull/134) merged as `18f7b18f690da9b2367f99268ed24d8d4cfb7b03`:
  - removed the obsolete WhatsApp message-list-wrapper dependency;
  - added `#main` and selectable-message fallbacks;
  - added deterministic DOM tests.
- PR [#135](https://github.com/neuralliquid/convolens/pull/135) merged as `e9ffd7eab9ee264dba2296c9eed7f907760a1526`:
  - registered the popup receiver before DOM readiness;
  - recognized `#pane-side` as a loaded WhatsApp workspace;
  - replaced misleading reconnect copy.
- PR [#136](https://github.com/neuralliquid/convolens/pull/136) merged as `29f865db4e9fbeda02a9d38ad1e03a18c97b82df`:
  - targets the active WhatsApp tab first;
  - injects the verified CSS/content bundle when Chrome reports no receiver;
  - retries the popup message automatically;
  - added the `scripting` permission and popup-runtime tests.
- PR #136 CI run `30222701366` passed. Its delayed review window had no comments, reviews, or threads.
- Extension validation at 1.0.4:
  - `pnpm --dir apps/chrome-extension test`: 6/6 passed;
  - `pnpm --dir apps/chrome-extension typecheck`: passed;
  - `pnpm --dir apps/chrome-extension package`: passed;
  - packaged manifest and active-tab injection were inspected successfully.
- The directory actually loaded by the operator's Chrome profile is:
  - `C:\tmp\convolens-extension-ready-20260726`
  - its manifest was replaced and verified at version `1.0.4`;
  - `scripting` permission and `chrome.scripting.executeScript` recovery are present.
- The most recent web/API production deployment is workflow run [30217254787](https://github.com/neuralliquid/convolens/actions/runs/30217254787), attempt 2, completed successfully against `603451b69ddd510f3e10bd1ef770869d2afe5e85`.
  - Attempt 1 stopped before infrastructure changes on a transient SQLite/TypeORM smoke race.
  - Attempt 2 passed the API build smoke, Terraform, image rollout, web deployment, and final smoke.
  - Extension-only PRs #134–#136 do not require an Azure deployment.

## Current operator gate

The operator still needs to prove the merged 1.0.4 runtime in the existing Chrome profile:

1. Open `chrome://extensions`.
2. Reload ConvoLens and accept any new permission prompt.
3. Confirm the card reports version 1.0.4.
4. Keep the intended WhatsApp Web tab active and open the ConvoLens popup.
5. Confirm `Connected to WhatsApp Web`.
6. Select an authorized conversation and choose **Send Current Chat**.
7. Capture the popup result and the resulting ConvoLens dashboard/conversation screen.

If the popup still cannot connect, inspect the ConvoLens extension card's **Errors** view and the WhatsApp tab console before changing more selectors. Record the exact exception and confirm which extension ID/path Chrome is running.

## First next change: show the extension version

Implement a small visible version label in the popup, preferably in the existing footer beside `ConvoLens Preview`:

- derive it at runtime from `chrome.runtime.getManifest().version`;
- render a neutral label such as `v1.0.5`—do not hard-code a second version string in HTML;
- keep it legible but visually secondary;
- add a regression test that proves the popup reads the manifest version;
- bump both `apps/chrome-extension/manifest.json` and `apps/chrome-extension/package.json` together;
- build/package, inspect the ZIP, open a PR, wait for CI and delayed bot feedback, merge only when clean;
- replace `C:\tmp\convolens-extension-ready-20260726` with the verified package and ask the operator to reload once.

Suggested clean start:

```powershell
git fetch origin
git worktree add C:\tmp\convolens-extension-version -b agent/show-extension-version origin/main
Set-Location C:\tmp\convolens-extension-version
pnpm install --frozen-lockfile
```

If disk space is still constrained, reuse an already-installed dependency tree rather than duplicating the full monorepo installation. Validate exact deletion targets before removing generated `node_modules` or `dist` directories.

## Acceptance sequence after the version label

Do not stop at a successful popup message. Complete the original Phase 4 evidence in order:

1. Send one selected WhatsApp conversation through the extension.
2. Confirm the API acknowledges it and the dashboard displays it.
3. Re-send the same conversation and verify deterministic deduplication.
4. Restart the API through the approved production workflow/operation.
5. Confirm the conversation remains after restart.
6. Confirm another authenticated session cannot read the conversation.
7. Attach screenshots and exact IDs/timestamps to Baton.
8. Close Phase 4 only when all required evidence exists.

Then reconcile stale Baton Phases 0, 1, 2, and 7, and proceed to Phase 5's deterministic, evidence-linked ticket-candidate wedge. Keep Phase 5 human-reviewed and non-publishing initially: candidate schema, source-message spans, confidence, suggested project, accept/edit/reject UI, and deterministic fixtures.

## Workspace safety

The primary checkout remains intentionally untouched on `agent/fix-upload-and-product-loop` with the user's untracked `docs/HANDOFF-2026-07-24-EXTENSION-RUNTIME.md`. Do not delete, overwrite, stash, or reset it.

This handoff was created from a clean worktree based on `origin/main`.

## Baton

- Root task: `ff10e352-c8ef-4e3b-a705-5dbe3698d93d`
- Phase 4 task: `c3020f7e-6be8-4b83-9dca-6d6afe9df4e2`

Both tasks contain the PR #134–#136 validation trail and the remaining operator acceptance step. Add the merged handoff URL and any new screenshots/results to both tasks.
