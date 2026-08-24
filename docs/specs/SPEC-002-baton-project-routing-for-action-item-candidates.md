# SPEC-002: Baton project routing for action-item candidates

**Status:** Draft — implementable contract for Phase 1–2; Phase 3 is schema-only here and stays blocked on D5; Phase 4 is out of scope, blocked on D4
**Date:** 2026-08-24
**Product:** ConvoLens
**PRD:** [`../prd/PRD-002-baton-project-routing-for-action-item-candidates.md`](../prd/PRD-002-baton-project-routing-for-action-item-candidates.md)
**ADR:** [`../adr/0004-baton-project-routing-authorization.md`](../adr/0004-baton-project-routing-authorization.md)
**Baton:** `c794ef85-60d4-4e7a-8829-d850552ad153`

This spec extends the existing `ticket-candidate.service.ts` / `baton-mcp.client.ts` / `ticket-candidate.routes.ts` pipeline. It does not replace any of it — every signature below is additive or a body-only change unless stated otherwise.

---

## 1. Scope

| Phase | What | This spec |
| --- | --- | --- |
| 1 | Server-side authorized project routing | **Normative.** First implementation cut. |
| 2 | Deterministic project suggestion | Normative for the matching contract; UI polish left to implementation. |
| 3 | `decisionQuestions` + compliance flag | Client type only (§3.3) is normative now; triggering/UI stays blocked on D5. |
| 4 | Experimental LLM extraction | Out of scope. Blocked on D4. |

Out: voice/audio ingestion into candidate generation (separately gated), a generic externally-callable analyze API (D6), any LLM extraction path (D4), any auto-publish without explicit human accept.

---

## 2. Processing path (Phase 1)

```text
Browser (session cookie only)
        │
        ▼
┌───────────────────────────────────────────────────┐
│ apps/web BFF (apps/web/src/app/api/ticket-candidates/**) │
│  reads session.batonAccessToken server-side         │
│  NEW: GET  baton/projects/route.ts                  │
│  CHANGED: [id]/decision/route.ts  (conditional)      │
│  CHANGED: [id]/route.ts (PATCH)   (conditional)      │
│  unchanged: [id]/publish/route.ts                    │
└──────────────┬──────────────────────────────────────┘
               │ x-baton-access-token (session-derived; never browser-supplied)
               ▼
┌───────────────────────────────────────────────────┐
│ apps/api  ticket-candidate.routes.ts                │
│  NEW: GET  /api/ticket-candidates/baton/projects     │
│  CHANGED: POST /:id/decision   (reads header)        │
│  CHANGED: PATCH /:id           (reads header)        │
│  unchanged: POST /:id/publish, /:id/admin-retry       │
└──────────────┬──────────────────────────────────────┘
               ▼
┌───────────────────────────────────────────────────┐
│ TicketCandidateService                              │
│  NEW: authorizeProjectId(projectId, batonToken)      │
│  NEW: listAvailableProjects(batonToken)              │
│  CHANGED: update(), decide()  — batonToken param     │
│  unchanged: generate(), publish(), revoke(), remove() │
└──────────────┬──────────────────────────────────────┘
               ▼
┌───────────────────────────────────────────────────┐
│ BatonMcpClient                                       │
│  NEW: listProjects(accessToken)                      │
│  CHANGED: createTask() input — optional decisionQuestions │
│  unchanged: searchTasks(), callTool(), 15s timeout    │
└──────────────┬──────────────────────────────────────┘
               ▼
        Baton MCP (this.batonResource — BATON_MCP_RESOURCE,
        default https://mcp.baton.celladoresystems.com/mcp)
```

`listProjects` is called **live, uncached**, at two points: the new picker route and `decide()`/`PATCH :id` when a `projectId` is being set — and only when `BATON_OAUTH_MCP_ENABLED=true`. `publish()` never calls it (§4.6). With the flag off (today's default), `decide()`/`PATCH :id` make no Baton call at all — see §4.1 step 2.

---

## 3. `BatonMcpClient` changes

### 3.1 `listProjects` (new)

```ts
export interface BatonMcpProject {
  id: string;
  name: string;
  description?: string | null;
}

async listProjects(accessToken: string): Promise<BatonMcpProject[]>
```

Wraps MCP tool `list_projects`, called via the existing private `callTool`/`callWithTimeout` machinery — same 15s `BATON_TIMEOUT_MS`, same per-call `StreamableHTTPClientTransport`/`Client` construct-call-close pattern as `searchTasks`/`createTask`. No arguments beyond the access token; the tool scopes results to whatever the token's own session can see.

Add a `parseProjectsPayload` parser alongside the existing `parseTaskPayload`/`parseCreatePayload`, following the same "throw a plain `Error` on malformed JSON/shape" convention — do not introduce a different error style for this one call.

**Verify before implementing:** the exact response shape of Baton MCP's `list_projects` tool is not yet confirmed against a live schema — this spec assumes at minimum `{ id: string, name: string }` per project, with `description` optional and needed only for Phase 2 matching. Confirm directly against the deployed tool (e.g. one manual MCP call) before writing `parseProjectsPayload`; do not ship a parser built only from this assumption.

### 3.2 `searchTasks` — unchanged

No changes.

### 3.3 `createTask` — additive `decisionQuestions`

```ts
async createTask(
  input: {
    projectId: string;
    idempotencyKey: string;
    title: string;
    description?: string;
    priority: 'medium';
    traceId: string;
    decisionQuestions?: string[];   // NEW — omit the field entirely when empty/undefined, never send []
  },
  accessToken: string
): Promise<BatonMcpTask>
```

`createBatonTask()` (the `ticket-candidate.service.ts` wrapper around `createTask`) passes `decisionQuestions` only when a candidate actually carries one. Per ADR-0004 §6, verify the field's accepted shape against Baton MCP's live `create_task` tool schema before Phase 3 wiring — this type is ConvoLens's current best reading of PRD-002's vocabulary table, not a confirmed schema diff.

---

## 4. `TicketCandidateService` changes

### 4.1 New: `authorizeProjectId`

```ts
private async authorizeProjectId(projectId: string, batonToken: string): Promise<string>
```

Replaces `normalizePinnedProjectId()` at its two call sites (`update()`, `decide()`). Behavior:

1. `normalizeBatonProjectId(projectId)` — unchanged UUID-shape check, still synchronous, still throws `TicketCandidateValidation('Baton project ID must be a valid UUID')` on bad shape.
2. **If `this.batonResource` is empty (i.e. `BATON_OAUTH_MCP_ENABLED !== 'true'`, today's default): no live call is possible or required.** Fall back to exactly `normalizePinnedProjectId()`'s current behavior — if the normalized value is not `this.defaultProjectId`, throw `TicketCandidateValidation('Only the configured ConvoLens Baton project is allowed')` (today's existing message); otherwise return it. `batonToken` is not read in this branch. **This is a deliberate carve-out, not an authorization hole:** with the flag off, `publish()` already refuses to reach Baton at all (its own existing `this.batonResource` check), so a candidate can never be published to whatever `projectId` it's pinned to except the one hardcoded default — this preserves today's behavior byte-for-byte, including the exact error message. See ADR-0004 §2.
3. Otherwise (`this.batonResource` configured): call `listAvailableProjects(batonToken)` (§4.2) — including when `batonToken` is `''`/unset, which the call is expected to fail on (see §4.2). On any failure (timeout, transport error, malformed response, empty/invalid token) — throw `TicketCandidateValidation('Unable to verify Baton project access — try again')`. **Deliberate simplification, per ADR-0004:** this reuses the existing `TicketCandidateValidation` → 400 mapping rather than introducing a new error class/HTTP status for a transient upstream failure, so no new route-layer plumbing is needed. Flagged in §13 as worth revisiting (e.g. a distinct 503) if it proves confusing in practice — not a Phase 1 blocker.
4. If the normalized `projectId` is not among the returned projects' `id`s — throw `TicketCandidateValidation('That Baton project is not accessible with your current session — choose another or reconnect Baton')`.
5. Return the normalized `projectId`.

The resolved default project ID goes through this same function with no special-case bypass when the flag is on (ADR-0004 §2) — step 2's carve-out applies only when the flag is off, in which case there is no live authorization to bypass.

**Regression guard this step 2 exists to satisfy:** with `BATON_OAUTH_MCP_ENABLED=false` (today's default in both `apps/api/.env.example` and `apps/web/.env.example`), plain accept-with-the-default-project must keep working exactly as it does today. Routing every `decide()`/`update()` call through the live-check branch unconditionally — i.e. omitting step 2 — would make every accept throw `TicketCandidateValidation('Baton publishing is not configured')`, since accepting without a `projectId` is already rejected separately (`'Choose a Baton project before accepting'`). That is a regression this spec must not ship; step 2 is what prevents it.

`normalizePinnedProjectId()` is deleted. `normalizeBatonProjectId()` (the free function, UUID-shape-only) is unchanged and still used directly by `generate()`.

### 4.2 New: `listAvailableProjects`

```ts
async listAvailableProjects(batonToken: string): Promise<BatonMcpProject[]>
```

Thin wrapper, exposed as its own method so the new picker route (§5.1) can call it without going through project *authorization* (there is nothing to authorize yet — this call *is* the authorized set). No caching, matching ADR-0004 §2. Unlike `authorizeProjectId`, this method has no flag-off fallback value to return (there is no "list of projects" when Baton isn't configured) — it always requires the flag on:

1. If `this.batonResource` is empty — throw `TicketCandidateValidation('Baton publishing is not configured')`, the same check and message `publish()` already uses today (`ticket-candidate.service.ts` line 235-236). This is the same message `authorizeProjectId` step 3 relies on being unreachable when the flag is off (step 2 short-circuits before ever calling this method).
2. Otherwise call `BatonMcpClient.listProjects(batonToken)`. Any failure — including a missing/empty/invalid `batonToken` — surfaces as a thrown error here; `authorizeProjectId` step 3 catches it and re-throws as `TicketCandidateValidation('Unable to verify Baton project access — try again')`. The new route (§5.1) lets it propagate as the same 400 via `sendError()`.

### 4.3 `generate()` — unchanged in effect, simplified in mechanism

`generate()` still sets `projectId: this.defaultProjectId` on every newly created candidate (line 99 today). This assignment does **not** call `authorizeProjectId` — the default is a server-controlled constant/env value, not user input, so there is nothing to authorize at creation time. It remains a provisional value: `update()`/`decide()` is what commits a real, authorized target project before accept, and both now run the live check regardless of whether the value being set matches the default.

(Today's code technically routes this same assignment through `normalizePinnedProjectId()`, which only did a shape+equality check anyway since the value is always exactly `this.defaultProjectId`. Post-change, drop that call entirely at this call site — a self-assigned constant needs no shape validation.)

### 4.4 `update()` — new optional `batonToken` param

```ts
async update(
  userId: string,
  id: string,
  expectedRevision: number,
  changes: { title?: string; description?: string; projectId?: string },
  batonToken?: string
): Promise<TicketCandidate>
```

If `changes.projectId !== undefined`: **only when `this.batonResource` is configured** (`BATON_OAUTH_MCP_ENABLED=true`), require `batonToken` (throw `TicketCandidateValidation('A Baton session is required to change the target project')` if missing/empty) before calling `authorizeProjectId`. With the flag off, `batonToken` is not required — `authorizeProjectId`'s own step 2 (§4.1) handles that case without it. Call `authorizeProjectId(changes.projectId, batonToken ?? '')` in place of today's `normalizePinnedProjectId(changes.projectId)` either way. The existing `WHERE status = 'pending'` guard on the update is unchanged (D3 invariant — see §8).

If `changes.projectId === undefined`, behavior is fully unchanged — no Baton call, `batonToken` is not required.

(`update()` and `decide()` are methods on `TicketCandidateService` itself, so this pre-check reads `this.batonResource` directly — no new public accessor needed.)

### 4.5 `decide()` — new optional `batonToken` param

```ts
async decide(
  userId: string,
  id: string,
  expectedRevision: number,
  decision: 'accepted' | 'rejected',
  projectId?: string,
  batonToken?: string
): Promise<TicketCandidate>
```

If `decision === 'accepted'` and `projectId` is provided: require `batonToken` the same way as `update()` — only when `this.batonResource` is configured — then call `authorizeProjectId(projectId, batonToken ?? '')` in place of today's `normalizePinnedProjectId(projectId)`. With the flag off this is a synchronous equality check against the resolved default (§4.1 step 2), so **accept-with-the-default-project keeps working with no Baton call and no token, exactly as it does today** — this is the specific regression this spec must not introduce. The existing "reject accepting without a project" check (`'Choose a Baton project before accepting'`) and the `WHERE status = 'pending'` guard are unchanged.

If `decision === 'rejected'`: unchanged — no Baton call, `projectId`/`batonToken` not required (candidate's `projectId` is set to `null`, as today).

### 4.6 `publish()`, `publishAsAdmin()`, `revoke()`, `remove()` — unchanged

`publish()` does not re-call `listProjects`. The D3 invariant (§8) guarantees `projectId` cannot change between a successful `decide()`/`update()` and `publish()`, so the authorization already performed at that point still holds — re-checking here would be a redundant round trip on every publish, not a security requirement. If that invariant is ever weakened, this decision must be revisited (flagged in PRD-002 §14 gap 2 already).

---

## 5. `apps/api` routes (`ticket-candidate.routes.ts`)

### 5.1 New: `GET /api/ticket-candidates/baton/projects`

- `authenticateToken` required.
- Reads `x-baton-access-token` via the existing `batonToken(req)` helper (`ticket-candidate.routes.ts:14-16`) and passes it straight to `service.listAvailableProjects(token)` **unconditionally, with no route-level presence check** — verified against the router's actual current convention: `/publish` (line 94) and `/admin-retry` (line 124) both do exactly this today, with no route-level 401 for a missing token anywhere in this file. This spec does not introduce one either.
- `service.listAvailableProjects` (§4.2) is the only source of failure here: empty `token` is not treated specially, since the flag-off case throws `TicketCandidateValidation('Baton publishing is not configured')` regardless of token, and a flag-on call with a missing/invalid token fails the same way an invalid token fails today — as a thrown error, caught and turned into `TicketCandidateValidation('Unable to verify Baton project access — try again')`. Both map to `400` via the existing `sendError()` `instanceof` mapping (§5.5) — **no new `401` shape at the API layer.** (A 401-for-missing-session experience exists only at the BFF layer, via `getConvolensPublishTokens()` — see §6.1 — same split as today's `/publish`.)
- Response on success: `{ projects: BatonMcpProject[], defaultProjectId: string }` — `defaultProjectId` lets the picker pre-select without hardcoding `CONVOLENS_BATON_PROJECT_ID` client-side. `Cache-Control: no-store` on the response (PRD-002 §11 Phase 1).

### 5.2 `POST /:id/decision` — reads the header unconditionally, same as `/publish` today

Reads `x-baton-access-token` via `batonToken(req)` **unconditionally** (possibly `''`) and passes it straight to `service.decide(...)` — matching how this router already handles the header on `/publish`/`/admin-retry`; no route-level branching is added. Whether the token is actually required is decided inside `service.decide()` (§4.5), based on `this.batonResource` and whether `projectId` is being set — not by the route. A request that rejects, or accepts with no `projectId` change, is unaffected by this either way.

### 5.3 `PATCH /:id` — reads the header unconditionally, same as `/publish` today

Reads `x-baton-access-token` via `batonToken(req)` unconditionally and passes it to `service.update(...)`. Same reasoning as §5.2 — `service.update()` (§4.4) is what decides whether the token is required.

### 5.4 `POST /:id/publish`, `POST /:id/admin-retry` — unchanged

Already read `x-baton-access-token`; no change.

### 5.5 Error surface — no new error taxonomy

`ticket-candidate.routes.ts` maps errors by `instanceof` (`TicketCandidateValidation` → 400, `TicketCandidateConflict` → 409, else → 502), not by a discriminated `code` field. Every new failure mode in this spec (missing token, unauthorized project, `listProjects` failure) reuses `TicketCandidateValidation` → 400, per §4.1 step 3 and ADR-0004 §5. This spec does not introduce codes like SPEC-001's `VOICE_ANALYSIS_DISABLED` table — that convention belongs to the media-analysis route family, not this one; matching this router's actual existing convention is deliberate, not an oversight.

---

## 6. `apps/web` BFF routes

### 6.1 New: `apps/web/src/app/api/ticket-candidates/baton/projects/route.ts` (GET)

Uses `getConvolensPublishTokens()` (`apps/web/src/lib/convolens-api.ts:84-105`) — the same helper `[id]/publish/route.ts` already uses — which throws `503` if `BATON_OAUTH_MCP_ENABLED !== 'true'` and `401` if no `session.batonAccessToken`. Forwards `X-Baton-Access-Token: batonToken` to the API. `cache: 'no-store'` on the outbound fetch and on the response returned to the browser.

### 6.2 Changed: `apps/web/src/app/api/ticket-candidates/[id]/decision/route.ts`

Branch on **both** the parsed request body **and** the flag — checking `process.env.BATON_OAUTH_MCP_ENABLED === 'true'` directly (the same env var `getConvolensPublishTokens()` itself checks; reading it here is not a new source of truth):

- `decision === 'accepted' && body.projectId !== undefined && BATON_OAUTH_MCP_ENABLED === 'true'` → use `getConvolensPublishTokens()`, forward `X-Baton-Access-Token`. (This is where a genuinely missing session surfaces as `401`, and the flag genuinely being off surfaces as `503` — both from the existing helper, unchanged.)
- otherwise → keep using `getConvolensApiToken()` as today, no Baton header forwarded.

**The flag check is required, not just the `projectId` check.** Branching on `projectId` presence alone — omitting the `BATON_OAUTH_MCP_ENABLED` condition — would route every accept-with-a-`projectId` through `getConvolensPublishTokens()`, which throws `503` whenever the flag is off. Since `BATON_OAUTH_MCP_ENABLED=false` is today's default in both `apps/api/.env.example` and `apps/web/.env.example`, and the frontend today always sends the resolved default `projectId` on accept (there is currently no other value to send), that omission would make **every accept fail with a `503`** in the default configuration — the exact regression this spec must not introduce. With the flag correctly included in the condition, a flag-off accept falls through to `getConvolensApiToken()` with no Baton header, reaches the API with an empty `x-baton-access-token`, and resolves via `authorizeProjectId`'s flag-off equality branch (§4.1 step 2) — the same outcome as today, no BFF-level 503 in the way.

### 6.3 Changed: `apps/web/src/app/api/ticket-candidates/[id]/route.ts` (PATCH)

Same two-part condition as §6.2 — `body.projectId !== undefined && BATON_OAUTH_MCP_ENABLED === 'true'` — for the same reason: `projectId` presence alone is not sufficient, the flag must gate it too.

### 6.4 Unchanged: `[id]/publish/route.ts`, `route.ts`, `conversations/[intakeId]/route.ts`, `[id]/revoke/route.ts`

No changes. (No BFF route exists for `/admin-retry` today; still out of scope here.)

---

## 7. UI contract (picker)

The entire picker experience below is gated behind `BATON_OAUTH_MCP_ENABLED`. When the flag is false (today's default), the UI renders no picker at all and behaves exactly as it does today: implicit publish to the resolved default project, no project selection UI, no `GET /baton/projects` call. This matches §9's flag-gated pattern and is what keeps §4.1/§4.4/§4.5/§6.2/§6.3's flag-off fallback behavior reachable in practice — the picker is what would otherwise send a non-default `projectId` that the flag-off branches must reject.

- On mount (or on expanding the review surface), fetch `GET /api/ticket-candidates/baton/projects`. Loading state while pending.
- Render project **name** (never a bare UUID). `description`, if present, may back Phase 2's suggestion text but is not shown as a raw field in Phase 1.
- Pre-select `defaultProjectId` from the response. This pre-selection is specific to this destination picker; it never applies to the Phase 2 suggestion chip, which is always unselected (PRD-002 §13).
- Publish/accept stays disabled until both an explicit accept **and** a project selection exist — clearing the selection blocks publish the same as a missing accept.
- Fetch failure (any non-2xx, timeout, or network error): explicit error banner with a retry action. Never falls back to silently publishing against the old pinned project — there is no client-side fallback value to fall back to once this ships.

Phase 2 (sketched, not blocking Phase 1): a labeled "Suggested match" chip next to the picker, populated by a deterministic keyword match (candidate title/evidence vs. each authorized project's `name`/`description`), never pre-selected, always showing the matched reason text rather than a bare confidence percentage (PRD-002 §13).

---

## 8. Regression test — D3 retarget invariant

Add a test asserting that once a candidate has any `publishStatus !== 'not_requested'` (or `status !== 'pending'`), `update()`/`decide()` calls attempting to change `projectId` fail — via the existing `WHERE status = 'pending'` clause producing a zero-row update, surfaced as `TicketCandidateConflict` the same way a stale `expectedRevision` is today. This is a test of existing behavior under the new authorized-projectId code path, not a new mechanism (PRD-002 D3, confirmed unchanged by the research pass behind this spec: `revoke()` requires `publishStatus = 'not_requested'`; `remove()` refuses once a publish attempt has started).

---

## 9. Feature flags

No new flag. Phase 1/2 ship entirely behind the existing `BATON_OAUTH_MCP_ENABLED` env var (singular — confirmed only one such flag exists across `apps/api/.env.example` and `apps/web/.env.example`, both defaulting `false`; PRD-002's phrase "flag family" is loose wording, not a second flag to add).

---

## 10. Telemetry (Phase 2)

Log/metric only: candidate id, suggested project id, match score. Never candidate title, description, or evidence text — matching the existing redacted-evidence precedent in `createBatonTask()` (PRD-002 §12).

---

## 11. Production evidence (before enabling `BATON_OAUTH_MCP_ENABLED=true` broadly)

1. `list_projects` MCP tool confirmed reachable and its response shape matches `parseProjectsPayload` (§3.1) against a real Baton deployment, not just a mock.
2. A revoked-access scenario manually verified end-to-end: a project removed from a token's live `list_projects` result is rejected by `authorizeProjectId` on the next `decide()`/`update()` call, not silently accepted from a stale value.
3. Picker UI shows project names correctly; error state verified by forcing a `listProjects` failure.
4. D3 regression test (§8) passing.
5. No candidate title/description/evidence text appears in logs from the new code paths.

---

## 12. Implementation slices (separate PRs)

1. **`BatonMcpClient.listProjects` + `createTask` `decisionQuestions` type** — client-layer only, no route/service wiring yet (`§3`).
2. **`TicketCandidateService` Phase 1** — `authorizeProjectId`, `listAvailableProjects`, `update()`/`decide()` signature changes, `generate()` simplification (`§4`).
3. **`apps/api` routes** — new picker route, conditional header reads on `/decision` and `PATCH /:id` (`§5`).
4. **`apps/web` BFF** — new picker proxy route, conditional token branching on the two changed routes (`§6`).
5. **Picker UI** — Phase 1 destination picker (`§7`), plus the D3 regression test (`§8`).
6. **Phase 2** — deterministic suggestion matching + telemetry (`§10`), separate PR from Phase 1.
7. **Phase 3** — after D5 resolves; not started by this spec beyond the client type in `§3.3`.

PRs that combine slice 1–5 with Phase 2 matching, or that begin any Phase 3 UI/consumer work ahead of D5, violate this spec.

---

## 13. Open implementation notes (not product decisions)

- `list_projects` response shape (§3.1) is assumed, not confirmed against a live schema — verify before writing the parser.
- `decisionQuestions`'s accepted shape on Baton's `create_task` tool (§3.3) is assumed `string[]` from PRD-002's reading of intent, not a confirmed schema diff — verify before Phase 3 wiring.
- `authorizeProjectId`'s "upstream call failed" case reusing `TicketCandidateValidation` → 400 (§4.1 step 3) is a deliberate simplification; revisit as a distinct status (e.g. 503) only if it proves confusing in practice, not a Phase 1 blocker.
- Exact wording of the new `400` error messages (§5.1–§5.3) should match this router's existing tone; no wording is normative here beyond what's quoted. (There is no new `401` at the API layer — see §5.1.)
- The `BATON_OAUTH_MCP_ENABLED=false` fallback branch (§4.1 step 2) is the single most safety-critical line in this spec to implement correctly: getting the condition backwards (e.g. routing flag-off calls through the live-check branch) breaks every accept in the default configuration. Slice 2 (§12) should land a test asserting accept-with-default-project succeeds with the flag off and no token, alongside the D3 regression test in §8.
