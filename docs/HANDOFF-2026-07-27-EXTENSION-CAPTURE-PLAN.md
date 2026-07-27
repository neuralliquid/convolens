# ConvoLens extension capture plan handoff — 2026-07-27

## Outcome

A repository-backed phased plan now covers the full extension discussion:

- truthful loaded-message capture;
- the popup/in-page progress mismatch;
- one shared operation state;
- compact draggable launcher placement;
- pre-send preview;
- sender name-plus-phone preservation;
- neutral image/video/audio/document/sticker markers without attachment download;
- guided `Capture as I scroll`;
- automatic older-history loading;
- queue, retry, export, and result navigation;
- carefully labelled `Soon` functions;
- console-source attribution for Agent Desktop, promise, preload, and message-channel signals;
- authentic long-chat production acceptance.

Canonical plan:

- `docs/EXTENSION-CAPTURE-EXPERIENCE-PLAN.md`

## Repository state at plan creation

- Repository: `neuralliquid/convolens`
- Base branch: `main`
- Base commit: `2f8ab1a5895b92ed999934f33e52ac8e88324f9c`
- Plan branch: `agent/extension-capture-plan`
- Plan PR: [#146](https://github.com/neuralliquid/convolens/pull/146) (draft)
- The primary checkout's untracked `docs/HANDOFF-2026-07-24-EXTENSION-RUNTIME.md` was left untouched.

## Confirmed findings

1. The current extractor captures only messages rendered in WhatsApp's virtualized DOM. History scrolling is not implemented.
2. The popup extraction path updates the in-page progress bar but performs upload outside the in-page operation, so the in-page reset path does not run.
3. For 16 rendered messages, the final periodic extraction update is approximately 41%, matching the observed stuck bar.
4. The `Agent Desktop` strings supplied by the operator do not occur in this repository and must be attributed to their owning extension ID.
5. Generic `content.js`, `dashboard:1`, promise rejection, preload, and closed-channel messages are not sufficient attribution by themselves.
6. ConvoLens still requires its own messaging audit because its listeners use asynchronous response channels.
7. The comparison screenshots show that sender sources are complementary: ConvoLens can retain a phone while dropping the visible name because the extractor chooses one sender source by precedence.
8. Media-only messages need sender-preservation fixtures, and video detection must take precedence over generic image-thumbnail evidence.

## Immediate next implementation slice

Start with the plan's Phase 0 and Phase 1 as separate reviewable changes:

1. Capture the console profile matrix and attribute each supplied signal.
2. Inventory ConvoLens message listeners and senders.
3. Add a fixture representing 16 rendered messages from a longer virtualized chat.
4. Make popup extraction UI-silent in the page.
5. Guarantee progress reset for every in-page outcome.
6. Rename the action to `Send Loaded Messages` and make exclusions explicit.
7. Catch and classify expected message-channel teardown.

Then implement the sender/media fidelity slice before the shared operation-state and launcher work:

1. Collect metadata sender, visible sender, and phone evidence independently.
2. Render `Name · phone`, name-only, phone-only, or `Unidentified participant N` deterministically.
3. Preserve the message participant reference through persistence and read projection.
4. Detect video before image when both indicators exist.
5. Render neutral `Image`, `Video`, `Audio`, `Document`, `Sticker`, or `Media` badges.
6. Show captions separately and do not download attachments.

Do not start automatic scrolling in the hotfix PR.

## Required evidence for console signals

For every error or warning, record:

- full source URL and extension ID when present;
- selected DevTools execution context;
- expanded stack or promise rejection;
- triggering user action;
- normal-profile result;
- Agent-Desktop-disabled result;
- ConvoLens-only clean-profile result;
- no-extension dashboard result where relevant;
- owner, severity, and disposition.

Redact tokens, cookies, message/contact data, and runtime/session values.

## Guardrails

- Do not treat Agent Desktop logs as ConvoLens failures.
- Do not call 16 rendered messages the complete chat.
- Do not upload during preview or scrolled collection.
- Do not scrape the broader WhatsApp contact surface.
- Do not expose raw message or identity evidence in logs.
- Do not discard a name because a phone was found in another sender source.
- Do not silently link People Directory identities from captured labels.
- Do not imply that a media badge represents a retained attachment.
- Do not show more than two secondary `Soon` capabilities.
- Do not claim authentic acceptance until the authorized long-chat, persistence, deduplication, restart, isolation, and deletion sequence passes.

## Validation for this plan-only change

- Confirm Markdown formatting and repository links.
- Run `git diff --check`.
- Confirm the diff contains documentation only.
- Confirm the primary checkout remains unchanged.

## Copy-paste continuation

```text
Continue ConvoLens extension work from docs/EXTENSION-CAPTURE-EXPERIENCE-PLAN.md and docs/HANDOFF-2026-07-27-EXTENSION-CAPTURE-PLAN.md. Recheck the live draft PR, current origin/main, checks, reviews, and worktree state. Preserve unrelated work. Begin with Phase 0 console attribution; do not assume generic content.js/dashboard errors belong to ConvoLens. Then implement Phase 1 as a narrow PR: truthful loaded-message wording, popup extraction that does not mutate page progress, terminal progress reset, safe messaging-channel handling, and focused 16-rendered-message regression coverage. Follow with the sender/media fidelity slice: collect visible name and phone independently, preserve participant references, detect video before image, and render neutral media badges without downloading attachments. Do not implement automatic scrolling in the hotfix. Keep production acceptance operator-held until the full authorized sequence passes.
```
