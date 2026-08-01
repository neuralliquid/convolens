# Extension artifact and authentic acceptance handoff

Date: 2026-08-01

## Current stop point

`origin/main` is `d91ab0ea3b98d041991d9820be8705992f7eeb4b`, the squash merge of PR #167. The current extension version is `1.0.20`.

The implementation, repeatable fixtures, launcher polish, and downloadable current-main package are complete. Authentic WhatsApp intake is not complete: the staffed runner stopped before confirmation because current WhatsApp Web exposed no verified stable conversation identifier.

## Landed work

| PR   | Merge                                      | Outcome                                                                            |
| ---- | ------------------------------------------ | ---------------------------------------------------------------------------------- |
| #162 | `8eaa6d7fc68947d7b119603d19f008f3079305bd` | Deterministic candidate extraction/review plus guarded, durable Baton publication. |
| #163 | `31a31d3fa79d9aa9cdb712c8f6e06e46eb938aa3` | Dedicated authenticated Playwright readiness fixture.                              |
| #164 | `6e1a3d6b6520b2b53cb79fad6dcfca42f21cbd9b` | Candidate/Baton closeout handoff.                                                  |
| #165 | `7f463461c2dc49fcba6b6a2339c48d1143ad1be7` | Authentic authenticated no-send evidence.                                          |
| #166 | `61e6cc58246451ab2108231dbd678b48a530f35c` | Accessible launcher Height/Side controls with headed Playwright coverage.          |
| #167 | `d91ab0ea3b98d041991d9820be8705992f7eeb4b` | Verified ZIP/checksum retention on `main` and release-asset publication workflow.  |

PR #162 was deployed by production run `30693790497`. Independent verification identified Azure revision `nl-prod-convolens-api--0000042` on image `nlprodconvolensacr.azurecr.io/convolens-api:8eaa6d7fc68947d7b119603d19f008f3079305bd`; API health/readiness and the web feature/auth-status probes returned HTTP 200. PRs #163-#167 changed tests, documentation, extension UX, or packaging workflows and did not require another API/web deployment.

## Downloadable current-main extension

Post-merge CI run `30710724769` passed on exact SHA `d91ab0ea3b98d041991d9820be8705992f7eeb4b`, including build, extension tests, headed browser fixtures, persistence fixtures, API intake tests, package inspection, checksum generation, and artifact upload.

- artifact: `convolens-extension-d91ab0ea3b98d041991d9820be8705992f7eeb4b`
- artifact id: `8821796657`
- retained until: `2026-08-31T17:39:05Z`
- GitHub artifact archive digest: `sha256:a9013ab0f77dd5c9aa3c6edf526b7e5501a9aab7b119b9b09197b1447360d51e`
- verified inner `convolens-extension.zip` SHA-256: `d0be9d4c776df55a3588b9a441a4e2309bc13407b05c6cfe9d605f6cd444c6f4`

Download and verify:

```powershell
gh run download 30710724769 `
  --repo neuralliquid/convolens `
  --name convolens-extension-d91ab0ea3b98d041991d9820be8705992f7eeb4b `
  --dir C:\tmp\convolens-extension-main-d91ab0e

$zip = "C:\tmp\convolens-extension-main-d91ab0e\convolens-extension.zip"
$expected = (Get-Content "${zip}.sha256" -Raw).Split(' ', [System.StringSplitOptions]::RemoveEmptyEntries)[0].Trim().ToLowerInvariant()
$actual = (Get-FileHash -LiteralPath $zip -Algorithm SHA256).Hash.ToLowerInvariant()
if ($actual -ne $expected) { throw "Extension artifact checksum mismatch" }
```

Extract the ZIP, open `chrome://extensions`, enable Developer mode, choose **Load unpacked**, and select the extracted directory containing `manifest.json`. This is not a signed CRX or Chrome Web Store release.

The release workflow now attaches the same verified ZIP and checksum to a created GitHub Release after application validation succeeds. The repository had no GitHub Releases when this handoff was written, so the release-event upload path is linted and regression-tested but has not yet been exercised by an authentic release event.

## Validation evidence

- extension unit/release suite: 150/150;
- extension TypeScript: passed;
- headed extension fixture suite: 5/5;
- package creation and ZIP integrity inspection: passed;
- workflow lint with `actionlint`: passed;
- exact-head PR #167 Validate run `30710537605`: passed;
- exact-head Codex review: first review found missing `gh` repository context; `GH_REPO` and regression coverage were added; fresh exact-head review returned a thumbs-up;
- post-merge `main` run `30710724769`: passed, including artifact upload;
- downloaded artifact checksum: matched.

## Authentic acceptance boundary

The dedicated profile remains outside the repository at:

```text
C:\Users\smitj\AppData\Local\ConvoLens\Playwright\acceptance-profile
```

Provisioning succeeded and the authenticated no-send fixture passed against real WhatsApp and ConvoLens sessions. On 2026-08-01 the operator supplied the exact phrase `I authorize one ConvoLens intake` and authorized any visible chat.

The guarded runner selected a real chat and completed loaded-message review, but the reviewed payload had no `sourceConversationId`; it stopped before `#ws-confirm-capture` was clicked. A subsequent read-only redacted diagnostic found:

- no `data-jid` or `data-chat-id` in the active conversation;
- no `data-jid`, `data-chat-id`, or chat `data-id` in the sidebar;
- the active conversation exposed one opaque alphanumeric message `data-id`, not a WhatsApp JID;
- none of the first 20 visible chat rows exposed a supported stable conversation identity.

No authentic conversation upload, WhatsApp message, production intake receipt, duplicate attempt, deletion, or Baton task occurred. Do not infer connected acceptance from authenticated readiness, synthetic fixtures, packaging, deployment health, or the operator authorization alone.

## Baton reconciliation

- Phase 5 task `b05a7eda-1df2-46cb-9d02-9481aeb74c4e` is now done with PR #162/deployment evidence.
- Phase 6 task `d16d720a-d8c7-47cc-8a81-ed2cf0301097` is now done with PR #162/deployment evidence.
- Phase 4 task `c3020f7e-6be8-4b83-9dca-6d6afe9df4e2` remains in progress.
- Phase 9 task `e518361c-fd6a-477c-83e9-91f7391cf73d` remains in progress.
- successor task `afabf0bd-5a6b-4272-b37a-b4bfd5601227`: **Restore stable WhatsApp conversation identity and complete staffed intake acceptance**.

The root, Phase 4, and Phase 9 Baton tasks contain this stop-point evidence and successor link.

## Next bounded slice

Start with Baton task `afabf0bd-5a6b-4272-b37a-b4bfd5601227` in a clean worktree from current `origin/main`.

1. Identify a privacy-safe, verified stable WhatsApp conversation identity source compatible with the current DOM/runtime. Never substitute the display label or a generated chat-name hash for a WhatsApp identity.
2. Add a synthetic current-DOM fixture and fail-closed tests proving identity extraction, chat-change invalidation, and no confirmation when identity cannot be established.
3. Rebuild/package and rerun the credential-free fixture and persistence suites.
4. With a staffed, dedicated profile and fresh exact one-intake authorization, run one zero-retry authentic intake.
5. Only after a production receipt exists, verify deterministic duplicate handling, session reload, API restart durability, owner isolation, authenticated deletion of row and raw artifact, candidate generation, and exactly one approved Baton publication.
6. Record exact IDs/timestamps without cookies, tokens, chat content, participant names, or message text.

Cloud deploys, browser-store publication, synthetic-to-production claim promotion, session export, and bypassing the stable-identity guard remain out of scope unless separately authorized.

## Workspace note

The primary checkout and its unrelated local state were not used for edits. This handoff was prepared in the isolated worktree `C:\tmp\convolens-auth-readiness` from current `origin/main`.
