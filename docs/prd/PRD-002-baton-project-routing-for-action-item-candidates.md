# PRD-002: Baton project routing for action-item candidates

**Status:** Draft — planning, not implementation  
**Date:** 2026-08-24  
**Product:** ConvoLens  
**Canonical Baton task:** `c794ef85-60d4-4e7a-8829-d850552ad153`  
**Related Baton tasks:**
- retort "content → Baton tasks" skill (narrowed by this PRD's findings; its DQ1 is resolved against this task): `c24f726d-6a3c-49a3-a466-0cbc1b32a14a`

**Follow-on docs:**
- ADR-0004 (proposed, not yet ratified): [`../adr/0004-baton-project-routing-authorization.md`](../adr/0004-baton-project-routing-authorization.md)
- SPEC-002: [`../specs/SPEC-002-baton-project-routing-for-action-item-candidates.md`](../specs/SPEC-002-baton-project-routing-for-action-item-candidates.md)

This PRD is the ConvoLens product contract for extending an existing, shipped pipeline. It does not authorize production flags or public claims beyond what is already live. It does not scope voice-note ingestion — see §5.

---

## 1. Why this exists

ConvoLens already turns WhatsApp text into reviewed, Baton-published action items: deterministic extraction (`apps/api/src/services/ticket-candidate.service.ts`), a human accept/reject review surface (`/dashboard/todos`, `ticket-candidate-review.tsx`), and an idempotent, claim-locked publish path (`baton-mcp.client.ts`) with duplicate detection and ambiguous-create reconciliation. This is a mature pipeline, not a blank page.

On 2026-08-24 that same six-step pattern — ingest, transcribe, extract, match the right Baton **project**, file tasks with `decisionQuestions` for anything ambiguous, flag anything compliance-sensitive rather than auto-acting — was proven by hand outside ConvoLens, against unrelated content (Rail Spring Certification voice notes; see `org-meta/docs/handoffs/2026-08-24-*.md`). That prompted a proposal to generalize the pattern into a standalone Claude Code skill (retort task `c24f726d`). Reading ConvoLens's own source resolves that skill's first open question directly: ConvoLens already has the harder half of this built, tested, and shipped behind a feature flag — it does not need to be reimplemented.

What ConvoLens does not have is the one capability that made the manual worked example valuable: routing a filed action item to the *right* Baton project. Every candidate ConvoLens has ever published has gone to ConvoLens's own backlog, because `normalizePinnedProjectId()` rejects every project ID except one resolved default (`this.defaultProjectId` — operator-configurable via `BATON_DEFAULT_PROJECT_ID`, falling back to the hardcoded `CONVOLENS_BATON_PROJECT_ID` constant only when that env var is unset). That pin is a deliberate safety boundary, not an oversight — but it is also the entire gap between "ConvoLens files its own todos" and "ConvoLens routes action items to whichever Baton project they actually belong to."

This PRD scopes closing that gap as a ConvoLens product feature: extend the existing review-and-publish pipeline to a user-chosen project, drawn only from the projects that user's own Baton token can see, instead of one fixed project. It does not scope rebuilding the pipeline, and it does not scope the audio-ingest half of the worked example.

---

## 2. Vocabulary (normative)

| Term | Meaning in ConvoLens | Source of truth | Status |
| --- | --- | --- | --- |
| **Action-item candidate** | A `TicketCandidate` row: `pending → accepted/rejected → published`. UI copy already calls these "Todos", not tickets. | `db/entities/TicketCandidate.ts` | Implemented |
| **Target project** | The single Baton project a candidate is proposed to publish into. | `candidate.projectId` | Implemented, but fixed to one resolved default today |
| **Authorized project set** | The Baton projects the *publishing user's own token* can see, per `list_projects`. The only valid source of truth for which project IDs a request may target. | New — `BatonMcpClient.listProjects()` | Missing |
| **Project suggestion** | A deterministic, ranked hint ("this candidate's evidence matches project X's description") shown in the picker. Never pre-selected, never auto-published. | New | Planned |
| **Compliance-sensitive flag** | A candidate whose content touches legal standing, safety, or certification claims and should not be silently accepted or silently dropped. Criteria are an open decision (§16, D5). | New | Missing |
| **`decisionQuestions`** | Baton's own mechanism for a created task to carry an unresolved, human-owned question. ConvoLens's `BatonMcpClient.createTask()` does not send this field today. | Baton MCP `create_task` | Missing from ConvoLens's client |

Do not overclaim autonomy in UI or marketing copy. This feature is deterministic extraction plus a human-confirmed destination, not an "AI that triages your conversations into the right team's backlog." A suggested project is a hint with a stated reason, never a silent decision.

---

## 3. Problem statement

### 3.1 User problem

A signed-in user imports a WhatsApp export and ConvoLens surfaces action-item candidates. If the conversation is about work, a shared project, or anything other than the user's personal ConvoLens backlog, there is currently no way to publish that candidate anywhere except ConvoLens's own Baton project — the destination is invisible and non-negotiable.

### 3.2 Product problem

The worked example that motivated this (Rail Spring Certification) is exactly the case ConvoLens cannot serve today: content that clearly belongs in a specific, pre-existing Baton project other than ConvoLens's own. Today that routing can only happen by hand, outside the product, by someone with direct Baton MCP access — which is not most ConvoLens users.

### 3.3 Constraint problem

Opening project choice is not a config toggle; it is an authorization decision. `x-baton-access-token` is already threaded per-request from the browser session, so the honest design is to derive the authorized project set from that same user token via `list_projects`, and never accept a client-supplied project ID on trust. Getting this wrong turns the publish endpoint into a confused deputy: a user's own credential, a server that will forward it to any project ID the client claims. Separately, extraction itself is still regex-only (`HIGH_SIGNAL` / `MEDIUM_SIGNAL`), which recalls far less than the LLM-assisted read that made the manual worked example find contacts and figures a regex would miss — that is a real capability gap but a separate, explicitly deferred decision (§16, D4), not something this PRD resolves by default.

---

## 4. Goals

1. Let a user publish an accepted action-item candidate to any Baton project their own token can see, not only ConvoLens's own project.
2. Enforce that authorization **server-side**: derive the valid project set from `list_projects` under the user's own Baton token; never trust a client-supplied project ID alone.
3. Preserve the existing human gate — nothing publishes without an explicit accept plus an explicit project choice. This is already true and must not regress.
4. Give the picker a deterministic, labeled project suggestion (keyword match against project descriptions) without ever auto-selecting or auto-publishing.
5. Add `decisionQuestions` support to the publish path so an ambiguous or compliance-sensitive candidate can carry an open question on the Baton task it creates, instead of guessing.
6. Keep extraction deterministic-by-default. Whether to invest in an opt-in, higher-recall extraction pass is an explicit open decision (§16, D4), not something this PRD ships.

---

## 5. Non-goals (v1)

- Rebuilding `ticket-candidate.service.ts`'s claim/lease locking or idempotent-publish machinery — reuse as-is.
- Voice-note or audio ingestion into candidate generation. `generate()` still skips `message.isMedia`; that stays blocked on the separate, already-gated transcription production path (`FEATURE_VOICE_TRANSCRIPTION`, `XTOX_EPHEMERAL_TRANSCRIPTION_VERIFIED`). This PRD does not reproduce the Rail Spring Certification worked example — it generalizes the existing **text** pipeline's project routing.
- A generic "paste any text, get Baton tasks" endpoint decoupled from ConvoLens's own consented WhatsApp ingest. Whether ConvoLens should ever expose that is left open (§16, D6) and tracked jointly with retort task `c24f726d`.
- LLM-assisted extraction shipping in v1. Regex stays the default extractor (§16, D4).
- Cross-org project visibility beyond what the user's own Baton token already grants — no admin override, no "see all projects" mode.
- Any form of auto-publish without human accept. Not reconsidered here.

---

## 6. Personas and jobs

| Persona | Job to be done | What they must not get |
| --- | --- | --- |
| Individual with one active project workspace who occasionally has action items belonging elsewhere | Publish a candidate to the project it actually belongs to, in a couple of clicks | A silent default to the wrong backlog |
| User importing a work-related WhatsApp chat | Route todos to their team's real Baton project instead of a personal ConvoLens backlog | A bulk "send everything to project X" toggle that skips per-item review |
| Privacy-conscious user | See exactly which project (name, not a bare UUID) something is about to be sent to before confirming | Publish going ahead against a project they never explicitly chose |

---

## 7. Current state (2026-08-24)

### Implemented

- WhatsApp text export parsing and deterministic action-item extraction (`HIGH_SIGNAL` / `MEDIUM_SIGNAL` regex over message text).
- Full candidate lifecycle: `generate → list → update → decide (accept/reject) → publish → revoke → remove`, all in `ticket-candidate.service.ts` / `ticket-candidate.routes.ts`, auth-gated, with optimistic concurrency (`expectedRevision`).
- Idempotent Baton publish: per-intake and per-candidate publish claims/leases (`BATON_PUBLISH_LEASE_MS = 90_000`), duplicate detection via `search_tasks` + `traceId` match, ambiguous-create reconciliation (`BATON_AMBIGUOUS_HOLD_MS = 60_000`) so a crash between `create_task` and finalize cannot silently double-file.
- Fingerprint/idempotency key: `sha256(intakeId, message.position, title.toLowerCase())`, unique per `(intakeId, fingerprint)`. No project component. Verified invariant: a candidate's `projectId` can only be set while `status = 'pending'` (`update()`, `decide()`); `revoke()` requires `publishStatus = 'not_requested'`; `remove()` refuses once `publishStatus !== 'not_requested'`. **A candidate cannot be retargeted to a different project once a publish attempt has started.** This already holds today and must keep holding once the target project is a variable, not a constant — no new locking mechanism is needed, only a regression test.
- Full frontend surface: `/dashboard/todos`, `ticket-candidate-review.tsx`, BFF proxy routes under `apps/web/src/app/api/ticket-candidates/**` for generate/list/update/decide/publish/revoke.
- Feature-flagged off by default in both apps (`BATON_OAUTH_MCP_ENABLED=false` in `apps/api/.env.example` and `apps/web/.env.example`).

### In progress / blocked

- Voice-note transcription into message text (separate production-gated path); candidate generation skips media messages regardless.

### Missing

- `BatonMcpClient.listProjects()` — the client wraps `search_tasks` and `create_task` only; no `list_projects` call exists anywhere in ConvoLens today.
- Any server-side authorization check against a live project list. `normalizePinnedProjectId()` is a static equality check against one resolved default value (`this.defaultProjectId`), not a membership check.
- `batonToken` is not forwarded on the `/decision` route today (only `/publish` and `/admin-retry` read `x-baton-access-token`) — needed once `decide()`/`update()` must validate a project choice against a live token-scoped list.
- Project picker UI — today the frontend has nothing to pick; there is exactly one implicit destination.
- Deterministic project-suggestion matching.
- `decisionQuestions` support anywhere in `BatonMcpClient.createTask()` or `createBatonTask()` — the input type is closed (`priority: 'medium'` hardcoded, no `decisionQuestions` field).
- Compliance-sensitive flag as a first-class candidate state or annotation.

---

## 8. Where the functionality sits

### 8.1 Ownership (unchanged)

ConvoLens API owns candidate lifecycle, authorization, and the Baton MCP client. Baton MCP owns project existence, task creation, and (newly) project visibility per token. No new service is introduced.

```text
User (accepts a candidate, picks a destination project)
        │
        ▼
┌───────────────────────────────────────────┐
│ ConvoLens API                             │
│  TicketCandidateService                   │
│   generate / list / update / decide       │
│   publish (claim + lease + reconcile)     │
│   NEW: authorize projectId against        │
│        listProjects(token) before decide  │
│        and before publish                 │
└──────────────┬─────────────────────────────┘
               │ x-baton-access-token (user's own Mystira-derived token)
               ▼
┌───────────────────────────────────────────┐
│ BatonMcpClient                            │
│  searchTasks / createTask (existing)      │
│  NEW: listProjects                        │
│  NEW: decisionQuestions on createTask     │
└──────────────┬─────────────────────────────┘
               ▼
        Baton MCP (this.batonResource,
        same resource used everywhere else
        in this class — see §8.2)
```

### 8.2 Authorization design (resolved — D1, §16)

`normalizePinnedProjectId()` is today the **only** server-side check on where a candidate can be published, and it is a pure equality check against `this.defaultProjectId` (env-overridable via `BATON_DEFAULT_PROJECT_ID`, else the hardcoded `CONVOLENS_BATON_PROJECT_ID` constant) — everything else (`normalizeBatonProjectId`) only validates UUID shape and forwards under the user's own token. Replacing "equals one resolved default" with "any syntactically valid UUID" would build a confused deputy: client-supplied target, user's credential, no membership check.

Requirement: the allowed project set for a given publish/decide call **must** be derived server-side, per request, from `listProjects(batonToken)` — called against the exact same `this.batonResource` the class already uses for `searchTasks`/`createTask` (`BATON_MCP_RESOURCE`, overridable via `BATON_MCP_RESOURCE` env var; **note this is `https://mcp.baton.celladoresystems.com/mcp` in ConvoLens's own config, not necessarily the same Baton deployment other tooling in this workspace points at** — do not assume they are interchangeable). A requested `projectId` is accepted only if it appears in that live-fetched set; otherwise reject with the same `TicketCandidateValidation` shape used today. The resolved default (`this.defaultProjectId` — `BATON_DEFAULT_PROJECT_ID` env override, else the hardcoded `CONVOLENS_BATON_PROJECT_ID` constant) is checked through that same live membership call — it is **not** exempted from it. Existing single-project behavior is unchanged only in the practical sense that a user who never picks anything else already has token access to ConvoLens's own project; if `listProjects` ever fails to include it for a given token, publish must fail closed (§14, gap 10), not silently succeed against an unchecked value.

Consequence: `batonToken` must be forwarded to `/decision` (and `/:id` PATCH when it changes `projectId`) the same way `/publish` already forwards it, since authorization now needs a live token at that point, not only at publish time.

---

## 9. Code vs model vs LLM

Default: run it in code unless a model is the only honest way to produce the output. The decision space here is small.

| Output | v1 method | Notes |
| --- | --- | --- |
| Action-item extraction | Code (existing regex) | Stays default; LLM-assisted pass is an explicit, separate, opt-in decision (D4) |
| Project authorization | Code (`listProjects` + set membership) | Never a model call; this is a security boundary, not a suggestion |
| Project suggestion (picker hint) | Code (keyword match: candidate title/evidence vs. project title/description) | Deterministic, always labeled "suggested match", never pre-selected |
| Compliance-sensitive detection | Code (keyword/category list, once D5 resolves what the list is) | Not a model call by default; revisit only if D5 explicitly asks for it |

No new LLM call is introduced by this PRD. If D4 later approves an experimental extraction pass, it should be routed the way ConvoLens's other bounded-AI features already are (`apps/api/src/services/ai/`), not as a new ad hoc integration.

---

## 10. Compliance-sensitive flagging (design sketch, pending D5)

The manual worked example filed a "build a dummy certification website" request as its own `review`-type Baton task with an open `decisionQuestions` entry, called out in prose, never auto-actioned or silently dropped. ConvoLens's existing accept/reject gate already gets partway there — nothing publishes without a human clicking accept — but there is no equivalent of "this one needs a second look before you accept it," which is the actual behavior being asked for.

Two shapes are possible and D5 (§16) decides between them:

1. **Evidence annotation** — a flagged candidate gets a visible badge and a required extra confirmation click in the existing accept flow. No schema change, no new status.
2. **Distinct state + `decisionQuestions`** — a flagged candidate publishes with a Baton `decisionQuestions` entry attached to the created task (requires the `decisionQuestions` client/schema work in §8 regardless), and ConvoLens's own UI treats it as a heavier-weight review step.

Both require deciding the trigger criteria (a keyword/category list — legal, safety, certification terms) before either can ship. Do not build either shape ahead of D5.

---

## 11. Phased product requirements

Status key: **P** planned · **E** experimental · **B** blocked · **I** implemented.

### Phase 0 — Planning (this task, `c794ef85`)

- [x] Baton task with PRD required (`c794ef85`)
- [x] This PRD
- [x] ADR-0004 (authorization design, `decisionQuestions` schema)
- [x] SPEC-002 (API/DB changes, picker UI contract)
- [x] Resolve D1 — authorization model (server-derived, never client-trusted)
- [x] Resolve D2 — audio path stays **B**, out of scope for this PRD
- [x] Resolve D3 — fingerprint/retarget invariant confirmed, no new mechanism needed
- [ ] Resolve D4 — LLM-assisted extraction investment (open)
- [ ] Resolve D5 — compliance-flag trigger criteria and representation (open)
- [ ] Resolve D6 — generic externally-callable reuse surface (open; joint with `c24f726d`)

### Phase 1 — Server-side authorized project routing (P)

- `BatonMcpClient.listProjects(token)` wrapping the `list_projects` MCP tool, same client/timeout pattern as `searchTasks`/`createTask`.
- Replace `normalizePinnedProjectId()` with an authorization-checked variant that calls `listProjects` and checks membership; keep the same `TicketCandidateValidation` error shape.
- Forward `batonToken` on `/decision` (and project-changing `PATCH /:id`), matching how `/publish` already forwards it.
- New BFF/API route exposing the authorized project list for the picker (e.g. `GET /api/ticket-candidates/baton/projects`): BFF reads `session.batonAccessToken` server-side and forwards it as `x-baton-access-token`, the same pattern `/publish` already uses — never a browser-supplied token. API calls `listProjects(batonToken)` and returns only that token's own live list. Response is `cache: no-store`.
- UI: project picker replacing the implicit "always ConvoLens" assumption, showing project **name**, not a bare UUID. The picker pre-selects the resolved default project, so a user who changes nothing still has a valid, visible selection and sees the same one-click publish flow as today — this pre-selection applies only to this destination picker, never to Phase 2's suggestion chip (§13, always unselected). Publish stays disabled until accept + a project selection exists (default or changed); clearing the selection blocks publish the same as a missing accept.
- Regression test: a publish attempt cannot change `projectId` (covers the invariant in §7/D3).

### Phase 2 — Deterministic project suggestion (P)

- Keyword match of candidate title/evidence against authorized projects' name/description; picker shows a ranked, labeled suggestion, never pre-selected.
- Telemetry: match score + candidate id + suggested project id only — never candidate title/description text, matching the existing redacted-evidence precedent in `createBatonTask()`.

### Phase 3 — `decisionQuestions` + compliance flag (P, blocked on D5)

- Extend `BatonMcpClient.createTask()`'s input type with optional `decisionQuestions: string[]`.
- Wire `createBatonTask()` to pass them when a candidate is flagged.
- Implementation shape (annotation vs. distinct state) follows whatever D5 decides — do not build ahead of it.

### Phase 4 — Experimental extraction (E, blocked on D4)

- Only begins if D4 resolves toward "invest." Routed through `apps/api/src/services/ai/` conventions, not a new ad hoc call.

---

## 12. Privacy, legal, and claims

| Rule | Application here |
| --- | --- |
| Explicit destination consent | Choosing a non-default project is a per-candidate, explicit action. No bulk "send everything to project X" toggle in v1. |
| Name the destination, not just an ID | Picker and confirmation UI show project name + owning org, never a bare UUID, before publish. |
| Authorization | Project set always derived from the user's own Baton token via `listProjects`; a client-supplied project ID is never sufficient on its own (D1). |
| No content in telemetry | Project-match scoring logs candidate id + project id + score only — never title/description text, matching the existing `createBatonTask()` precedent (it already sends only "redacted evidence" positions, not message content, to Baton itself, let alone telemetry). |
| Deletion / retention | Unchanged: candidates cascade-delete with their `ConversationIntake`. Once published, the Baton task itself is outside ConvoLens's deletion control — same as today, now true for more possible destination projects. |
| Production gates | Ships behind the existing `BATON_OAUTH_MCP_ENABLED` flag family (default `false` in both apps); no new flag category. |
| Funding / public claims | This is deterministic extraction plus human-confirmed routing. Do not describe it as "AI that automatically triages your conversations into the right team's backlog." A suggested project is a labeled hint, never a decision. |

---

## 13. UX requirements

- Picker shows project name and owning context, never a raw UUID.
- Suggested-project chip is labeled "Suggested match" with the matched reason (e.g. "matches project description"), not a bare confidence percentage presented as certainty.
- Publish stays disabled until both accept **and** a project selection exist. The picker pre-selects the resolved default project (§11 Phase 1), so a user who changes nothing still has a valid selection and sees the same one-click flow as today; that pre-selection is specific to this destination picker and never applies to the Phase 2 suggestion chip.
- A compliance-flagged candidate (once D5 resolves) is visually distinct and requires an extra confirmation step; it does not silently pass through the normal accept button.
- Failure to load the authorized project list shows an explicit error state — never a silent fallback to the old pinned project (see §14).

---

## 14. Gaps this request would miss if we only "added a project picker"

1. **Confused deputy.** Trusting a client-supplied project ID without a server-side `listProjects` check (D1) turns a UI convenience into an authorization hole.
2. **Fingerprint collisions.** The idempotency key has no project component; this is safe only because a candidate targets exactly one project at a time. If a future change ever allowed publishing one candidate to multiple projects, the fingerprint would need revisiting. Not needed for this PRD's scope — call it out so it isn't silently assumed away later.
3. **Token plumbing.** `/decision` does not receive `batonToken` today; authorization at decide-time silently can't happen until that's added.
4. **Telemetry leakage.** Project-match scoring is a new signal; it must follow the existing no-content precedent, not invent a laxer one.
5. **Raw UUIDs in the UI.** Showing bare project IDs instead of names is both bad UX and a privacy smell (implies org membership without context).
6. **`decisionQuestions` as a substitute for review.** Adding the field does not itself prevent rubber-stamp acceptance — the compliance-flag UI state (§10) still has to force a second look.
7. **Audio scope creep.** The voice-note path must stay out of this feature; it is separately gated and not reproduced here (D2).
8. **Revoked access mid-flow.** If `listProjects` stops returning a project the user previously picked (access revoked), publish must fail closed with a clear error, not silently fall back to `CONVOLENS_BATON_PROJECT_ID`.
9. **New round trip on hot paths.** `listProjects` adds a Baton MCP call to `decide()`/picker load; reuse the existing 15s timeout wrapper in `BatonMcpClient`, don't invent a second one.
10. **No silent fallback.** An empty or failed `listProjects` response must surface as an explicit error state, never a quiet default to the old pinned project — that fallback would be an undocumented behavior change.

---

## 15. Technology recommendation (for the ADR)

1. `BatonMcpClient.listProjects(token)` — same client/timeout/error-handling pattern as `searchTasks`/`createTask`, calling MCP tool `list_projects`.
2. Replace `normalizePinnedProjectId()` with an authorization-checked variant; preserve the `TicketCandidateValidation` error type so existing frontend error handling keeps working.
3. Thread `batonToken` through `/decision` and project-changing `PATCH /:id`, mirroring `/publish`.
4. New BFF route surfacing the authorized project list to the picker.
5. Keep project-suggestion matching in ConvoLens as plain code (no new service, no new Sluice alias) for Phase 2.
6. No database migration required for Phase 1 — `TicketCandidate.projectId` is already a free `varchar(36)`; only the code-level constraint changes from "equals one constant" to "member of a live-fetched set."

---

## 16. Decisions (Baton `c794ef85`)

| ID | Question | Status | Resolution |
| --- | --- | --- | --- |
| **D1** | How is the authorized project set determined and enforced? | **Resolved** | Server-side only: `listProjects(batonToken)` against the same `batonResource` used elsewhere in the class, intersected against the requested `projectId`. A client-supplied project ID is never sufficient on its own. The resolved default project ID (`BATON_DEFAULT_PROJECT_ID` env override, else `CONVOLENS_BATON_PROJECT_ID`) is checked through that same live call, not exempted — it stays unchanged in practice only because existing users already have access to it. |
| **D2** | Does this PRD extend to the voice-note / audio-ingest path (the Rail Spring worked example)? | **Resolved** | No. That path stays **Blocked**, gated separately behind transcription production evidence. This PRD generalizes only the existing text pipeline's project routing. |
| **D3** | Does supporting multiple target projects require changing the candidate fingerprint or adding new locking? | **Resolved** | No. Verified in code: `update()`/`decide()` only set `projectId` while `status = 'pending'`; `revoke()` requires `publishStatus = 'not_requested'`; `remove()` refuses once a publish attempt has started. A candidate cannot be retargeted after publish begins. Add a regression test; no new mechanism needed. |
| **D4** (`62e22e20`) | Should ConvoLens invest in an experimental LLM-assisted extraction pass (higher recall for contacts, figures, decisions) as an opt-in alternative to the deterministic regex extractor, or stay regex-only for v1? | **Open** | Tracked as a pending Baton decision requirement on `c794ef85`. |
| **D5** (`67c7b283`) | What criteria trigger compliance-sensitive flagging, and is a flagged candidate a distinct state (forcing a Baton `decisionQuestions` entry) or an evidence annotation? | **Open** | Tracked as a pending Baton decision requirement on `c794ef85`. |
| **D6** (`29a96184`) | Should ConvoLens expose a narrow, opt-in API to analyze externally-supplied text (outside its own consented WhatsApp ingest), enabling reuse by tools like the org-meta content-to-Baton-tasks skill? | **Open** | Tracked jointly with retort task `c24f726d` (its DQ1 is resolved pointing here); this PRD does not decide it. |

---

## 17. Success criteria

Planning succeeds when:

- This PRD, ADR-0004, and SPEC-002 are linked on `c794ef85`.
- D1–D3 are resolved (done here).
- D4–D6 are resolved before Phase 3/4 work begins.

Phase 1 succeeds when:

- A user can publish an accepted candidate to any Baton project their own token can see.
- Publishing to a project outside that authorized set is rejected server-side, even if the client sends that project ID directly.
- A user who never picks anything else sees no behavior change in practice — the resolved default project ID is validated through the same `listProjects` check as any other target, not exempted from it; it only feels unchanged because existing users already have access to it.

Phase 2 succeeds when the picker shows a ranked, labeled suggestion without pre-selecting it, and match telemetry contains no candidate text.

---

## 18. Risks

| Risk | Mitigation |
| --- | --- |
| Confused deputy / project-scope escape | D1: server-side `listProjects` membership check, never client-trusted |
| User mis-routes sensitive personal content into a shared/work project by mistake | Picker always shows destination name + org; explicit per-candidate confirm; no bulk default |
| `decisionQuestions`/compliance flag treated as sufficient review by itself | UI still requires the existing explicit-accept gate; flag adds friction, does not replace it |
| Scope creep into audio ingestion | D2 explicitly blocks it here |
| `listProjects` latency/timeout degrading the todos page | Reuse existing 15s `BatonMcpClient` timeout pattern; fail closed to an explicit error, never a silent fallback |
| Fingerprint assumptions break if scope later expands to one-candidate-many-projects | Explicitly out of scope (§5); flagged for revisiting if that ever changes (D3) |

---

## 19. Next documents

1. ADR-0004 — authorization design (D1) and `decisionQuestions` schema addition to `BatonMcpClient`.
2. SPEC-002 — route/token-threading changes, `listProjects` contract, picker UI contract, regression test for the retarget invariant (D3).
3. Phase 1 implementation PR — `listProjects`, authorization-checked project selection, picker UI.
4. Phase 2 implementation PR — deterministic project suggestion.
5. Phase 3 — after D5 resolves.
6. Phase 4 — after D4 resolves.
