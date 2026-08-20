# Voice-note transcription — scoping notes (Baton `1e50aef3`)

**Date:** 2026-08-20
**Baton task:** `1e50aef3` (convolens, `status: todo`, `confidence: needs_scoping`)
**Related task:** `591273de` (xtox, "Audio-to-transcript pipeline: WhatsApp OGG/Opus, WAV, MP3 → text")
**Outcome of this pass:** scoping only. No code changed. Task remains blocked upstream — see below.

## Why this is a note and not a PR

`1e50aef3` came in marked `needs_scoping` with two pending decision requirements. Both are now
resolved or deferred with evidence (below), but the feature itself cannot be implemented
end-to-end yet: it depends on two things outside this repo, neither owned by this session.

```
1e50aef3 (convolens, this task)
   └─ relates_to → 591273de (xtox, inprogress)
                       └─ blocked_by → 833d6a98 (sluice, inprogress, unassigned)
```

- **`833d6a98`** (sluice): add a Foundry Whisper deployment + LiteLLM audio route. Blocked on
  setting `azure_foundry_endpoint` in sluice's prod Terraform vars — a cost-incurring
  production infrastructure change with no current owner.
- **`591273de`** (xtox): `POST /api/transcribe-audio` is coded and pushed
  (`celladore/xtox`, branch `feature/audio-transcription-sluice`, commit `c9c313d`), but
  **no PR has been opened yet** — the PR-creation URL was left for the user
  (`https://github.com/celladore/xtox/pull/new/feature/audio-transcription-sluice`). The
  endpoint 503s with an explanatory message while `833d6a98` is unshipped — that's working
  as designed, not a bug.

Building convolens's calling code now is safe (it would only ever hit a 503 today), but it
can't be verified end-to-end, and there's nothing to demo until both of the above land. Given
that, this pass stops at scoping + writing this doc, rather than opening a convolens PR that
can't be tested against a live transcript.

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
  convolens any audio/transcription access today, and it isn't evidence either way for how
  *this* feature should route.

### 2. The `/upload` ingestion route is not audio-ready

The task implied `chat-export.routes.ts` already provides an ingestion surface for audio.
Checked directly:

- `apps/api/src/routes/chat-export.routes.ts:19-25` — multer's `fileFilter` hard-rejects
  anything that isn't `text/plain` / `.txt`:
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
  isn't a one-off in the route; it's the documented contract.
- The 10 MB cap (`chat-export.routes.ts:17`, mirrored in `.env.example:45`) also matters here:
  a WhatsApp "Export chat → Attach media" `.zip` with more than a handful of voice notes will
  exceed it.
- The `/extension` route's `ExtractedMessage` shape (`chat-export.routes.ts:35-45`) has
  `mediaType?: 'image' | 'video' | 'audio' | 'document' | 'sticker'` but no transcript field
  anywhere in the intake, GET, or DELETE response shapes.

Net: a new or substantially widened ingestion surface is required for either capture path
(DOM or `.opus` export fallback). This is not a small addition on top of existing plumbing.

## Decision requirements

### `b91e40f1` — routing: convolens → xtox, or convolens → sluice directly?

**Resolution: convolens → xtox.** This isn't a fresh choice for this task to make — task
`591273de`'s own decision `2b081d2d` is already `resolved`, on an explicit user directive
(2026-08-19, "integrate through sluice"): xtox is the ecosystem's single audio-transcription
service, and it sits in front of sluice. `591273de`'s branch (`feature/audio-transcription-sluice`,
commit `c9c313d`) is the concrete evidence — it implements the client-facing contract as
`POST /api/transcribe-audio` (multipart, optional `language` / `source_conversion_id`) →
`TranscriptionResult`, with xtox's own `services/transcription_service.py` doing the httpx
call to sluice's `/v1/audio/transcriptions`.

Convolens building its own direct Whisper-via-sluice client would duplicate that logic and
fork the ecosystem away from the settled architecture for no benefit — the existing
`convolens` sluice key is scoped to a different capability anyway (see above), so there's no
shortcut being given up by not going direct.

**Action:** convolens should call xtox's `POST /api/transcribe-audio` once
`feature/audio-transcription-sluice` has a PR open and merged on `celladore/xtox`.

### `0414d374` — can a content script read decrypted voice-note audio from the WhatsApp Web DOM?

**Deferred, not resolved.** This is an empirical question that needs a live, authenticated
WhatsApp Web session to answer, and answering it means driving someone's real chat session —
not something to do unattended in this pass. Recorded as deferred rather than resolved so it
doesn't read as answered when it wasn't.

**Recommended default for MVP scope in the meantime:** don't build against the DOM-capture
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

- **Audio bytes leave convolens.** They travel convolens → xtox → sluice → Azure Foundry. That
  is conversation content reaching a third-party model boundary and needs the same
  explicit-consent treatment as any other AI-generated insight in this product, not an
  implicit one because it's "just transcription."
- **Retention of the uploaded audio blob** — how long does xtox (or convolens, if audio is
  staged locally first) keep the raw `.opus`/`.wav`/`.mp3` bytes after transcription
  completes? Needs a stated answer, not an assumed one.
- **Retention of the returned transcript** — same question for the derived text, which is
  itself conversation content once it lands in convolens's database.
- **Deletion propagation** — does the existing `deleteForUser` path in
  `conversation-intake.service.ts` reach the sibling transcript record (see hash-exclusion
  note above), or does it only delete the message row it was written against? If transcripts
  are a separate table, this needs an explicit cascade/query, not an assumption that FK
  cascade covers it.

None of these have answers yet. They should be answered as part of scoping the actual
implementation PR, not discovered during review of it.

## Recommended staged plan (not started this pass)

1. Wait for `celladore/xtox` PR on `feature/audio-transcription-sluice` to open and merge.
   (Not blocking on `833d6a98` to *start* convolens-side work — the endpoint 503s safely in
   the meantime — but blocking on it to *demo* or *close out* this task.)
2. Add a `MessageTranscript`-style sibling entity, kept out of all three content-hash
   functions (see constraint above).
3. Add or widen an ingestion surface for audio (`.opus` export attachments to start, per the
   MVP-default decision above) — this is new work, not reuse of `/upload`'s current
   `.txt`-only filter.
4. Add the xtox HTTP client call (multipart `POST /api/transcribe-audio`), with the 503 case
   treated as an expected, user-visible "not available yet" state rather than an error.
5. Write and get explicit sign-off on the privacy section above before any audio actually
   leaves the system in a deployed environment.
6. Delegate test-writing to the project's TESTING agent per workspace convention, after (2)–(4)
   land — not written inline as part of this scoping pass.

## What this pass did NOT do

- No code changes in `apps/api`, `apps/chrome-extension`, or anywhere else in this repo.
- No live WhatsApp Web session was driven to test DOM audio capture.
- No PR was opened on `celladore/xtox` (that repo isn't this one; it already has a pushed
  branch and a PR-creation link waiting on the user).
- No action was taken on sluice task `833d6a98` (cost-incurring prod infra change — outside
  this session's authority).
