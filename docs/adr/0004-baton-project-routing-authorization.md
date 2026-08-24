# ADR-0004: Server-side authorized project routing for Baton publish, and a `decisionQuestions` schema addition

**Status:** proposed
**Date:** 2026-08-24
**Deciders:** ConvoLens repository owner (not yet ratified — D1–D3 are Baton-resolved on `c794ef85`, but the mechanism decisions below, including the no-caching choice and the `BATON_OAUTH_MCP_ENABLED=false` fallback semantics, are new and unreviewed)
**Consulted:** PRD-002 (Status: Draft), Baton `c794ef85`, retort task `c24f726d` (D6 tracked jointly, not decided here)
**Informed:** None — entirely internal to ConvoLens; no cross-repo coordination required (contrast ADR-0003, which needed xtox/Sluice sign-off)

Canonical product contract: [`../prd/PRD-002-baton-project-routing-for-action-item-candidates.md`](../prd/PRD-002-baton-project-routing-for-action-item-candidates.md)

Technical spec: [`../specs/SPEC-002-baton-project-routing-for-action-item-candidates.md`](../specs/SPEC-002-baton-project-routing-for-action-item-candidates.md)

Baton: `c794ef85-60d4-4e7a-8829-d850552ad153`

## Context

ConvoLens already ships a full action-item pipeline — deterministic extraction, human accept/reject, idempotent claim-locked Baton publish (`ticket-candidate.service.ts`, `baton-mcp.client.ts`). Every published candidate goes to one resolved project: `normalizePinnedProjectId()` accepts only `this.defaultProjectId` (`BATON_DEFAULT_PROJECT_ID` env override, else the hardcoded `CONVOLENS_BATON_PROJECT_ID` constant) and rejects every other value. That pin is the entire gap between "ConvoLens files its own todos" and "ConvoLens routes action items to whichever Baton project they actually belong to."

Baton decisions D1–D3 on `c794ef85` are resolved and are binding for this ADR. D4 (LLM-assisted extraction), D5 (compliance-flag trigger criteria), and D6 (generic external reuse surface) are open and out of scope here — this ADR does not wait on them and does not resolve them.

## Decision

### 1. Never trust a client-supplied `projectId` alone (D1)

Replacing "equals one resolved default" with "any syntactically valid UUID" would turn the publish/decide path into a confused deputy: a user's own Baton credential, forwarded to whatever project ID the client claims, with no membership check. That path is rejected outright, not just for this v1.

### 2. Authorization source: live `listProjects(token)`, no caching, at every checkpoint the flag enables

`BatonMcpClient` gains `listProjects(token)`, wrapping the `list_projects` MCP tool, using the same `this.batonResource` and the same client/timeout pattern already used by `searchTasks`/`createTask`. `this.batonResource` is not always-on: the constructor resolves it to `BATON_MCP_RESOURCE` (env override, else `https://mcp.baton.celladoresystems.com/mcp`) only when `BATON_OAUTH_MCP_ENABLED=true`, and to `''` otherwise — the empty string *is* the flag-off signal the rest of this document relies on. A requested `projectId` is accepted only if it appears in that call's result, called fresh — never from a cache — at each of two checkpoints: the picker-list route and `decide()`/project-changing `PATCH /:id`. `publish()` does not re-check (see Consequences — the D3 invariant makes a third call redundant, not a security requirement).

This live check only runs when `BATON_OAUTH_MCP_ENABLED=true` (i.e. `this.batonResource` is configured). With the flag off there is no Baton session to check against, so `decide()`/`update()` fall back to today's `normalizePinnedProjectId()` behavior unchanged: a synchronous equality check against the resolved default, no network call. This is not a weaker authorization path — with the flag off, `publish()` already refuses to reach Baton at all (`this.batonResource` empty → `TicketCandidateValidation`), so a pinned, unauthorized-but-inert `projectId` on a candidate that can never publish carries no risk. SPEC-002 §4.1 specifies the exact branch.

Caching `listProjects` (TTL or otherwise) was considered and rejected for v1: it would reopen exactly the "revoked access mid-flow" gap PRD-002 §14 gap 8 calls out — a project that disappears from a user's live Baton access must fail closed immediately, not after a cache expires. Latency is instead bounded by the existing 15-second `BatonMcpClient` timeout wrapper, not by a cache. Revisit only if production latency data shows real user pain that a short, carefully-scoped cache would fix without weakening the fail-closed guarantee.

### 3. Fail closed, never fall back

Any `listProjects` failure, timeout, or empty/incomplete result is an explicit error surfaced to the caller. It must never silently fall back to `CONVOLENS_BATON_PROJECT_ID` or any other default — that fallback would itself be an undocumented authorization bypass (PRD-002 §14 gap 10).

### 4. Token threading follows the existing `/publish` pattern, extended to `/decision`

`x-baton-access-token` today reaches the API only on `/publish` and `/admin-retry`. Authorization now needs a live token wherever a `projectId` is validated, so `/decision` and any `PATCH /:id` that changes `projectId` must forward it too — sourced the same way `/publish` already sources it: the BFF reads the session-derived Baton token server-side and forwards it as `x-baton-access-token`; the browser never supplies a token directly to the API. No new trust boundary is introduced, only a wider one for the same boundary.

### 5. Replace `normalizePinnedProjectId()`, keep its error contract

The authorization-checked replacement preserves the existing `TicketCandidateValidation` error shape so current frontend error handling keeps working unchanged. This is a body-of-the-function change, not an interface change.

### 6. `decisionQuestions` is an additive, optional field — schema only, usage stays blocked on D5

`BatonMcpClient.createTask()`'s input type gains `decisionQuestions?: string[]`, wired through `createBatonTask()` so it is sent only when a candidate actually carries one; omit the field entirely when there are none rather than sending an empty array, matching the minimal-payload style the client already uses elsewhere. This ADR decides the schema shape now so Phase 3 implementation is not blocked re-litigating it later — it does **not** decide when a candidate gets flagged (D5, open) or build any compliance-flag consumer of the field.

Before Phase 3 ships, verify `decisionQuestions`'s accepted shape against Baton MCP's live `create_task` tool schema rather than assuming `string[]` is final — Baton owns that tool's contract, not ConvoLens, and this ADR's assumption is based on PRD-002's reading of the field's intent, not a direct schema diff.

### 7. Project-suggestion matching stays plain code, inside ConvoLens

Phase 2's keyword match (candidate title/evidence vs. authorized projects' name/description) is deterministic code, not a model call, and lives in ConvoLens — no new service, no new Sluice alias. It is a labeled hint only; the picker never pre-selects it (contrast Phase 1's destination picker, which does pre-select the resolved default — that pre-selection is specific to the destination picker and does not apply here).

## Considered options

### A. Trust a client-supplied project ID directly, drop the pin

Rejected. Confused deputy: the user's own Baton credential would forward to any project ID the client asserts, with no server-side check that the user's token can actually see that project.

### B. Static per-user/org allow-list maintained by an admin

Rejected. Doesn't reflect live Baton project access, requires manual sync on every membership change, and cannot satisfy the fail-closed-on-revoked-access requirement — a revoked user would keep publish access until someone remembered to update the allow-list.

### C. Cache `listProjects` with a short TTL

Rejected for v1, for the reason in Decision §2: a staleness window conflicts directly with fail-closed-on-revoked-access. Latency is handled by reusing the existing 15s timeout wrapper instead.

### D. Live `listProjects(token)` membership check at every authorization checkpoint, no cache

Chosen. Directly implements D1, satisfies fail-closed, adds no new service, and reuses `BatonMcpClient`'s existing timeout/error-handling pattern.

## Consequences

- One additional Baton MCP round trip on `decide()`, project-changing `PATCH /:id`, and the new picker-list route, only when `BATON_OAUTH_MCP_ENABLED=true` — each bounded by the existing 15s timeout, not a new one. `publish()` adds none: the D3 invariant guarantees `projectId` cannot change between a successful `decide()`/`update()` and `publish()`, so re-checking there would be a redundant round trip, not a security requirement.
- `/decision` and project-changing `PATCH /:id` must start reading and forwarding `x-baton-access-token`; a caller that omits it can no longer authorize a non-default `projectId` and must fail closed with the existing `TicketCandidateValidation` error shape.
- `BatonMcpClient.createTask()`'s input type grows one optional field; existing callers that never set it are unaffected.
- No database migration for Phase 1 — `TicketCandidate.projectId` is already a free `varchar(36)`; the constraint that changes is code-level (equality → live membership), not schema-level.
- Phase 3 implementation (using `decisionQuestions` to represent a compliance flag) stays blocked on D5 regardless of this ADR's acceptance — this ADR only clears the schema, not the trigger criteria or the UI treatment.

## Follow-on

SPEC-002 is the implementable contract: routes, token threading, error codes, picker UI contract, and the D3 retarget-invariant regression test. This ADR does not enable `BATON_OAUTH_MCP_ENABLED` in production or authorize any new public claim — Phase 1/2 ship behind the existing flag family, default `false`, same as today.
