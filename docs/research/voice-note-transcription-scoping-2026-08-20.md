# Voice-note transcription — scoping notes (Baton `1e50aef3`)

**Date:** 2026-08-20
**Baton task:** `1e50aef3` (convolens, `status: todo`, `confidence: needs_scoping`)
**Related task:** `591273de` (xtox, "Audio-to-transcript pipeline: WhatsApp OGG/Opus, WAV, MP3 → text")
**Outcome of this pass:** scoping only. No code changed on 2026-08-20. See updates below for later in-repo work.

> **Update, same day, ~3h later:** two of the "current state" claims below were already stale
> by the time they were written, and one upstream blocker has genuinely moved. See
> [**Update — 2026-08-20, later same day**](#update--2026-08-20-later-same-day) at the bottom
> before reading this as current. Short version: xtox's PR was already merged when this doc
> first claimed it wasn't (checked the task's text log, not GitHub, the first time — mistake);
> Sluice's Whisper Azure resource now exists, but on a new parallel subscription that isn't
> wired into the production hostname yet, so the pipe is still not reachable end-to-end today.
>
> **Update 2, same day, ~4h later:** Sluice fixed the specific bug that update 1 left open (an
> auth-key mismatch) and closed their task as "confirmed fully working end-to-end" — but their
> own smoke test proves that against the new stack's *temporary* domain, not the production
> hostname xtox is actually configured to call. See
> [**Update 2 — 2026-08-20, ~4h later**](#update-2--2026-08-20-4h-later) at the bottom. Still
> not reachable end-to-end from ConvoLens's real call path.
>
> **Update 3, 2026-08-21:** ConvoLens PR 202 shipped `MessageTranscript`,
> `XtoxTranscriptionService`, the audio upload route, and
> [`docs/VOICE-NOTE-TRANSCRIPTION.md`](../VOICE-NOTE-TRANSCRIPTION.md). Do not wait for the
> xtox PR or rebuild those pieces. Remaining work is production DNS/configuration and gated
> authentic verification. See [**Update 3**](#update-3--2026-08-21) and the staged plan.

## Why this is a note and not a PR

`1e50aef3` came in marked `needs_scoping` with two pending decision requirements. Both are now
resolved or deferred with evidence (below). On 2026-08-20 the feature could not be verified
end-to-end: it depended on two things outside this repo, neither owned by this session.

```text
1e50aef3 (convolens, this task)
   └─ relates_to → 591273de (xtox, inprogress)
                       └─ blocked_by → 833d6a98 (sluice, inprogress, unassigned)
```

- **`833d6a98`** (sluice): add a Foundry Whisper deployment + LiteLLM audio route. Blocked on
  setting `azure_foundry_endpoint` in Sluice's prod Terraform vars — a cost-incurring
  production infrastructure change with no current owner.
- **`591273de`** (xtox): `POST /api/transcribe-audio` is coded and pushed
  (`celladore/xtox`, branch `feature/audio-transcription-sluice`, commit `c9c313d`), but
  **no PR has been opened yet** — the PR-creation URL was left for the user
  (`https://github.com/celladore/xtox/pull/new/feature/audio-transcription-sluice`). The
  endpoint 503s with an explanatory message while `833d6a98` is unshipped — that's working
  as designed, not a bug.

Building ConvoLens's calling code then was safe (it would only ever hit a 503 that day), but
it couldn't be verified end-to-end. That is why this pass originally stopped at scoping. The
xtox merge and ConvoLens calling code later landed; see updates 1 and 3.

## Corrections to the task's stated premises

The task description contained two claims that don't hold up against the actual repo state.
Recording them here so nobody re-derives the same wrong assumption from the task text.

### 1. `scripts/keys.yaml` — reversed, and in the wrong repo

The task's premise was "`scripts/keys.yaml` currently has only an xtox entry." Checked
directly (`sluice/scripts/keys.yaml` — the file doesn't exist in convolens or xtox at all):

- There is **no `xtox` alias** anywhere in that file.
- There **is** a `convolens` alias already (`sluice/scripts/keys.yaml:72-83`), scoped to
  `models: [convolens-catch-up-v1]`, `capability: grounded-conversation-catch-up`. That's a
  different capability (text summarization) on a model that isn't Whisper — it doesn't grant
  ConvoLens any audio/transcription access today, and it isn't evidence either way for how
  *this* feature should route.

### 2. The `/upload` ingestion route is not audio-ready

The task implied `chat-export.routes.ts` already provides an ingestion surface for audio.
Checked against current `main`:

- `apps/api/src/routes/chat-export.routes.ts:28-32` — multer's `fileFilter` on the text
  export upload still hard-rejects anything that isn't `text/plain` / `.txt`:
  ```ts
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'text/plain' || file.originalname.endsWith('.txt')) {
      cb(null, true);
    } else {
      cb(new Error('Only .txt files are allowed'));
    }
  },
  ```
- `apps/api/.env.example:47` — `ALLOWED_FILE_TYPES=text/plain,application/json` confirms this
  isn't a one-off in the route; it's the documented contract for chat-export text uploads.
- The 10 MB cap (`chat-export.routes.ts:26`, mirrored in `.env.example:45`) still applies to
  that `.txt` upload. A WhatsApp "Export chat → Attach media" `.zip` with more than a handful
  of voice notes will exceed it. Voice-note transcription uses a separate multer
  (`VOICE_NOTE_MAX_BYTES`, default 25 MiB, `chat-export.routes.ts:36-48`).
- The `/extension` route's `ExtractedMessage` shape (`chat-export.routes.ts:106-116`) has
  `mediaType?: 'image' | 'video' | 'audio' | 'document' | 'sticker'` and still has no
  transcript field. GET `/api/chat-export/:id` **does** include `transcript` on each message
  (`chat-export.routes.ts:817-825`).

Net: text `/upload` is still `.txt`-only. Audio transcription uses a dedicated route, not a
widening of that filter.

## Decision requirements

### `b91e40f1` — routing: ConvoLens → xtox, or ConvoLens → Sluice directly?

**Resolution: ConvoLens → xtox.** This isn't a fresh choice for this task to make — task
`591273de`'s own decision `2b081d2d` is already `resolved`, on an explicit user directive
(2026-08-19, "integrate through sluice"): xtox is the ecosystem's single audio-transcription
service, and it sits in front of Sluice. `591273de`'s branch (`feature/audio-transcription-sluice`,
commit `c9c313d`) is the concrete evidence — it implements the client-facing contract as
`POST /api/transcribe-audio` (multipart, optional `language` / `source_conversion_id`) →
`TranscriptionResult`, with xtox's own `services/transcription_service.py` doing the httpx
call to Sluice's `/v1/audio/transcriptions`.

ConvoLens building its own direct Whisper-via-Sluice client would duplicate that logic and
fork the ecosystem away from the settled architecture for no benefit — the existing
`convolens` Sluice key is scoped to a different capability anyway (see above), so there's no
shortcut being given up by not going direct.

**Action:** ConvoLens should call xtox's `POST /api/transcribe-audio`. `celladore/xtox#7`
already merged on 2026-08-19; remaining work is verifying that production request path, not
waiting for another xtox PR.

### `0414d374` — can a content script read decrypted voice-note audio from the WhatsApp Web DOM?

**Deferred, not resolved.** This is an empirical question that needs a live, authenticated
WhatsApp Web session to answer, and answering it means driving someone's real chat session —
not something to do unattended in this pass. Recorded as deferred rather than resolved so it
doesn't read as answered when it wasn't.

**Recommended default for MVP scope:** don't build against the DOM-capture
path. Default to WhatsApp's native "Export chat → Attach media" flow, which produces `.opus`
files through a user-initiated export — no DOM audio-blob capture required, and it sidesteps
the open question entirely for a first version. The DOM-capture path can be revisited later if
the export-file flow proves too heavy for the target usage pattern.

## Design constraint worth stating now: transcript must not enter the hash functions

`conversation-intake.service.ts` computes dedup hashes (legacy v1, stable v2, a compatibility
hash) over message content to detect duplicate imports and to support the
`legacyVisualCompatibilityHash` repair path for rows hashed under an older scheme. A
transcript is *derived* data — it doesn't exist at capture time, arrives asynchronously after
an xtox round-trip, and (per `591273de`) may not exist at all until `833d6a98` ships. If a
transcript field is added to `ConversationMessageInput` and included in any of those hashes,
every message that later gets a transcript changes its own `contentHash`, which breaks dedup
identity for existing rows — the exact failure class `legacyVisualCompatibilityHash` exists to
repair.

**Recommendation:** store the transcript as a sibling record keyed to the message id (e.g. a
`MessageTranscript` entity/table), not a field on the message/hash input itself. Dedup and
hash identity stay defined purely by the original captured content; transcription is an
attached enrichment that can be added, retried, or regenerated without perturbing hash
identity or duplicate detection.

## Privacy — required section, not a follow-up

Per this repo's `CLAUDE.md` product constraints ("do not log conversation content in
telemetry"; "require explicit privacy, retention, deletion, and model-processing behavior")
and the MVP Launch Engineer's stop conditions ("uncontrolled model submission", "unclear data
retention"), this feature needs explicit answers before it ships, not after:

- **Audio bytes leave ConvoLens.** They travel ConvoLens → xtox → Sluice → Azure Foundry. That
  is conversation content reaching a third-party model boundary and needs the same
  explicit-consent treatment as any other AI-generated insight in this product, not an
  implicit one because it's "just transcription."
- **Retention of the uploaded audio blob** — how long does xtox (or ConvoLens, if audio is
  staged locally first) keep the raw `.opus`/`.wav`/`.mp3` bytes after transcription
  completes? Needs a stated answer, not an assumed one.
- **Retention of the returned transcript** — same question for the derived text, which is
  itself conversation content once it lands in ConvoLens's database.
- **Deletion propagation** — does the existing `deleteForUser` path in
  `conversation-intake.service.ts` reach the sibling transcript record (see hash-exclusion
  note above), or does it only delete the message row it was written against? If transcripts
  are a separate table, this needs an explicit cascade/query, not an assumption that FK
  cascade covers it.

The implemented contract that answers these is now
[`docs/VOICE-NOTE-TRANSCRIPTION.md`](../VOICE-NOTE-TRANSCRIPTION.md). Keep that document the
source of truth; do not re-open an implementation PR to re-derive them from this note.

## Recommended staged plan

As of 2026-08-21, the xtox merge and ConvoLens sibling-entity / client / tests are done.
Remaining work is production path verification, not a second implementation.

1. **Done.** `celladore/xtox#7` merged 2026-08-19. Verify the already-merged
   `POST /api/transcribe-audio` from the production request path ConvoLens actually uses, not
   only from a temporary Sluice hostname.
2. **Done.** `MessageTranscript` exists (`apps/api/src/services/message-transcript.service.ts`,
   tests in `apps/api/src/services/__tests__/message-transcript.service.test.ts`) and is
   excluded from content hashes. Confirm remaining wiring against
   [`docs/VOICE-NOTE-TRANSCRIPTION.md`](../VOICE-NOTE-TRANSCRIPTION.md).
3. **Done for exported audio files.** Dedicated voice-note upload (`VOICE_NOTE_MAX_BYTES`,
   default 25 MiB) is separate from the `.txt` 10 MB `/upload` filter. Zip-with-media export
   is still not an ingestion path.
4. **Done.** `XtoxTranscriptionService` calls xtox (`apps/api/src/services/xtox-transcription.service.ts`,
   tests in `apps/api/src/services/__tests__/xtox-transcription.service.test.ts`). 503 is a
   user-visible "not available yet" state. Confirm production env (`XTOX_BASE_URL`,
   `FEATURE_VOICE_TRANSCRIPTION`, `XTOX_EPHEMERAL_TRANSCRIPTION_VERIFIED`) on NeuralLiquid.
5. Privacy, consent, retention, and deletion answers belong in
   [`docs/VOICE-NOTE-TRANSCRIPTION.md`](../VOICE-NOTE-TRANSCRIPTION.md). Keep that document
   current; do not duplicate the implementation.
6. Tests for the entity and xtox client already exist. Remaining: authentic production
   transcription against the live xtox → Sluice path after DNS/configuration cutover.

## What this pass did NOT do

- No code changes in `apps/api`, `apps/chrome-extension`, or anywhere else in this repo
  (2026-08-20 scoping pass). Implementation later landed in PR 202; see Update 3.
- No live WhatsApp Web session was driven to test DOM audio capture.
- No PR was opened on `celladore/xtox` from this pass (that repo isn't this one; `#7` had
  already merged — see Update 1).
- No action was taken on Sluice task `833d6a98` (cost-incurring prod infra change — outside
  this session's authority).

## Update — 2026-08-20, later same day

Prompted by a user report ("sluice whisper landed with foundry"). Verified directly against
GitHub rather than re-reading Baton's task text, since Baton's own agent-message log on
`833d6a98` turned out to be ~3 hours stale relative to what had actually happened.

**Correction — xtox's PR was already merged, not "not opened yet" as stated above.**
`celladore/xtox#7` ("feat: add audio transcription endpoint routed through sluice gateway")
merged **2026-08-19T14:48:23Z** — 6 minutes after the branch was pushed and before this
scoping pass even started. The "no PR opened yet" claim above was accurate at the instant the
originating agent wrote it, but had already gone stale by the time it was copied into this
doc and into the Baton comment on `1e50aef3`; this doc should have checked GitHub directly
instead of trusting the task's own text log. Correcting the decision-requirement `b91e40f1`
resolution's action line above: xtox's endpoint is merged and exists in `celladore/xtox`
main today — the "once merged" condition was already satisfied.

**Genuinely new, verified this pass: Sluice's Foundry Whisper Terraform resource now exists
in Azure — but on a new, separate subscription that isn't in the production request path
yet.** `celladore/sluice` PRs #233–#237 (all merged between 07:30 and 10:13 UTC today) did
not fix the original blocker (Azure RBAC 403 on the CI service principal against
`mystira-sub`, subscription `bb4e3882-…`). Instead, per `docs/celladore-sub-migration-plan.md`
in that repo, Sluice's entire prod stack is mid-migration to a **new Azure AD tenant**
(`celladore-sub`) — not a subscription move (`mystira-sub` and `celladore-sub` are different
tenants; `az resource move` can't cross that boundary), a full rebuild. Verified directly from
the latest "Deploy Sluice (celladore-sub)" run
(`gh run view 32358330665 --repo celladore/sluice --log`):

```text
module.sluice.azurerm_cognitive_deployment.foundry_whisper[0]: Creation complete after 21s
  [id=.../resourceGroups/cel-prod-sluice-rg/.../accounts/cel-prod-sluice-foundry/deployments/whisper]
Apply complete! Resources: 3 added, 1 changed, 0 destroyed.
```

That's real — the Azure resource exists now, at 2026-08-20T10:21:05Z. But per the migration
plan's own phase tracking, this is Phase 2 of 5 (parallel stack build). Phase 3 (Postgres/
LiteLLM DB + Key Vault secret migration) and Phase 4 (DNS cutover of
`litellm.sluice.phoenixvc.tech`, the hostname ConvoLens's own `.env.example` and presumably
xtox's `SLUICE_BASE_URL` point at) have not run: *"Through Phase 3, the old stack in
mystira-sub is untouched and continues serving production traffic — the new stack is
additive."* No evidence of a minted LiteLLM virtual key on the new stack either — grepped the
full log of the successful apply run for `manage_keys`/`virtual key`/`xtox`: zero hits, and
the deploy workflow's own header comment says smoke/integration tests are deliberately
skipped because that "depends on state that doesn't exist until after a first apply (a minted
LiteLLM virtual key...)".

**Net effect on `1e50aef3`: still correctly blocked, but the blocker category changed.** It's
no longer an unowned RBAC deadlock with no visible path forward — it's a scoped, actively-
progressing, multi-phase migration with a written plan, already 2 of 5 phases in as of this
check. The production hostname xtox actually calls still serves the old, Whisper-less stack
today, so `POST /api/transcribe-audio` (merged, live in `celladore/xtox` main) still 503s
against real traffic right now. Nothing for ConvoLens to build against changes as a result of
this update — still no working end-to-end transcript to demo — but worth tracking: this is
likely to resolve on the timeline of that migration's remaining phases, not on an indefinite
"someone needs to notice and fix RBAC" timeline.

## Update 2 — 2026-08-20, ~4h later

Prompted by a second user report ("sluice whisper landed with foundry" — a status update
copy-pasted from a Sluice-side session). Verified independently rather than taken at face
value, per the same discipline as update 1.

**What Sluice actually fixed:** the Whisper *deployment* from update 1 existed but every call
through it 401'd — root-caused to `foundry_models`/`foundry_whisper_models` in
`infra/modules/sluice_aca/main.tf` both authenticating with the main Azure OpenAI account's
key instead of the separate `cel-prod-sluice-foundry` account's own key (Cognitive Services
keys are account-scoped, not interchangeable). `celladore/sluice#239` gives Foundry its own
key end to end (new `azure_foundry_api_key` var/secret/env var). Independently confirmed: PR
merged 2026-08-20T11:47:22Z, GH secret `AZURE_FOUNDRY_API_KEY_CELLADORE` set 11:47:05Z, the
"Deploy Sluice (celladore-sub)" workflow ran and succeeded shortly after. Baton `833d6a98` is
now marked `done` on this basis, citing a smoke test that returned `HTTP 200 {"text":"you"}`.

**The gap the "done" status doesn't surface:** that smoke test called
`https://litellm.sluice.celladoresystems.com/v1/audio/transcriptions` — the new celladore-sub
stack's own temporary hostname. It did not call `litellm.sluice.phoenixvc.tech`, which is what
xtox is actually configured to call in prod (`celladore/xtox`
`infra/env/prod/terraform.tfvars:40`, `sluice_base_url`). Checked
`docs/celladore-sub-migration-plan.md` at its latest revision (`celladore/sluice#238`, merged
2026-08-20T11:47:51Z — four minutes *before* the smoke test that closed `833d6a98`): DNS/
custom-domain cutover from `litellm.sluice.phoenixvc.tech` (Phase 4) is still explicitly listed
as "still genuinely open — actual remaining work," and "through Phase 3, the old stack in
mystira-sub is untouched and continues serving production traffic." The old stack's own Foundry
Whisper deployment is a separate, intentionally-unfixed dead end (regional capacity gap,
deprioritized until that stack is deleted) — so it isn't a fallback either.

**Net: the fix is real, but "confirmed fully working end-to-end" describes the new stack in
isolation, not the path ConvoLens's request would actually take.** `POST /api/transcribe-audio`
(xtox) still resolves, on today's prod config, to a hostname that has no working Whisper route
behind it. The actual unblock signal to watch for is Phase 4 (DNS cutover) landing in the
migration plan, or `sluice_base_url` being repointed at the new stack's domain directly.
Posted matching correction notes on Baton `833d6a98` and `591273de` rather than letting the
"done" status read as an all-clear for downstream consumers.

## Update 3 — 2026-08-21

ConvoLens PR 202 (`e85b20a`, "feat: add gated voice-note transcription flow") implemented the
in-repo work this note originally listed as not started:

- `MessageTranscript` sibling entity, excluded from content hashes
- `XtoxTranscriptionService` calling `POST /api/transcribe-audio`
- dedicated audio upload (`VOICE_NOTE_MAX_BYTES`, default 25 MiB)
- GET `/api/chat-export/:id` includes `transcript` on each message
- contract: [`docs/VOICE-NOTE-TRANSCRIPTION.md`](../VOICE-NOTE-TRANSCRIPTION.md)

Do **not** wait for another xtox PR, and do **not** add a second sibling entity or client.
Remaining work is production: NeuralLiquid `XTOX_BASE_URL` / feature flags /
`XTOX_EPHEMERAL_TRANSCRIPTION_VERIFIED`, Sluice DNS or `sluice_base_url` cutover, and an
authentic consented transcription on the live path.
