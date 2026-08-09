# ADR 0002: Use provider-neutral contracts and evidence-gated promotion for Agent Harnessing v1

Date: 2026-08-09

Status: proposed

Deciders: organization architecture owner, repository owners, security/privacy owner, and Agent Harnessing v1 epic owner

Canonical Baton epic: `e1c82235-02d8-4b99-ba86-da2195271845`

ConvoLens adoption task: `d0e6826c-6739-443a-82cb-df9359d1f200`

## Context

ConvoLens and sibling repositories already use provider-specific agents, skills, hooks, task ledgers, model gateways, and review tooling. The pieces are unevenly mature and do not yet share a versioned contract for identity, task ownership, authority, leases, handoffs, evidence, cost attribution, or promotion.

The live default-branch audit on 2026-08-09 corrected two important assumptions:

- Retort already has meaningful scaffold-once, sync-diff, three-way preservation, doctor, handoff, and generated-provenance behavior. Agent Harnessing v1 should extend that base rather than replace it.
- The previously reported `org-meta` agent operating-model document is absent from the current `origin/master`. Its prior decisions are useful historical input, but they are not a current normative organization contract.

Industry protocols and products are also evolving at different rates. A2A 1.0 provides a stable cross-agent task and artifact protocol. MCP's task utility remains experimental in the 2025-11-25 specification. Provider-native multi-agent and hosted evaluation products continue to change. Binding the operating model directly to any one runtime would make repository policy drift with that provider.

Agent collaboration also expands the error surface: confused authority, prompt injection, context loss, duplicate effects, stale leases, shared-worktree collisions, unbounded cost, evidence laundering, and unsupported product claims. More agents are not intrinsically better; they must earn their complexity against a simpler baseline.

## Decision

Adopt a composed, provider-neutral Agent Harnessing v1 candidate contract with five machine-readable document types:

1. `HarnessManifest` for stable functional roles, task-shaped teams, deterministic hooks, workflows, authority, budgets, and model-policy references.
2. `HandoffEnvelope` for artifact-mediated transfer of task state, ownership, leases, authority, revisions, artifacts, evidence, blockers, and next action.
3. `EvidenceBundle` for typed, source-bound proof whose layers remain distinct.
4. `EvaluationSuite` for synthetic tasks, expected routes and effects, deterministic or human graders, and paired baselines.
5. `PromotionDecision` for lifecycle state, thresholds, evidence, approvers, limitations, expiry, restriction, and rollback.

The candidate schema is [`../schemas/agent-harnessing-v1-candidate.schema.json`](../schemas/agent-harnessing-v1-candidate.schema.json). It uses `harness.neuralliquid.dev/v1alpha1`, preserves provider-specific data only in namespaced extensions, and is explicitly non-normative until adopted by `org-meta`.

### Stable aliases and task-shaped teams

Repositories may use themed display names, but automation binds to stable functional aliases. ConvoLens will evaluate a small Observatory vocabulary rather than scaffold Mystira's full roster:

- horizontal candidates: `dispatcher`, `privacy-reviewer`, `evidence-auditor`, `change-integrator`, `runtime-operator`, and `knowledge-curator`;
- vertical candidates: `parser-engineer`, `analytics-engineer`, `insight-engineer`, `experience-engineer`, `integration-engineer`, and `data-lifecycle-engineer`.

A task has one accountable role. Specialists join only when the task requires an independent capability, authority boundary, or adversarial evaluation perspective. Skills remain reusable procedures; hooks remain deterministic enforcement.

### Complexity routing

- Tier 0 uses deterministic tooling without an agent.
- Tier 1 uses one bounded agent.
- Tier 2 uses a minimal task-shaped team.
- Tier 3 is opt-in Cognitive Mesh planning or evaluation for high-complexity tasks and remains read-only during the v1 pilot.

Parallel execution is limited to independent, idempotent, read-only, or isolated-worktree work. Shared files, migrations, privacy or authentication decisions, external effects, and change integration are serialized.

### Artifact-mediated interoperability first

Baton is the durable asynchronous task, lease, trace, evidence, artifact, handoff, and promotion ledger. Provider-native live messaging may be used inside a bounded run, but no provider's message format becomes the portfolio contract.

Where standards help:

- A2A may carry cross-agent task, status, artifact, and agent-card exchanges through an adapter.
- MCP may expose tools and resources through an adapter, but experimental MCP tasks do not become a required v1 dependency.
- W3C Trace Context supplies propagation semantics; Baton identifiers and the harness trace remain explicit domain fields.
- OpenTelemetry semantic conventions inform operational attributes, while content capture remains disabled by default.

### Authority and effects

Authority is deny-by-default, explicit per workflow step, bounded by authenticated identity, workspace, path, tool, effect, cost, deadline, and lease. Untrusted input cannot expand it.

Agent Harnessing v1 promotion proceeds in separate bands:

1. specification;
2. read-only harnessing and verification;
3. read-only promotion for named tasks;
4. later repository-specific workspace-write promotion; and
5. later external-effect promotion.

Merge authority is not part of v1. A `change-integrator` agent alias, `pr-landing` skill, or `land` command may collect exact-head evidence and recommend a decision; a human retains the merge action.

### Evidence-gated promotion

Promotion uses the thresholds in [`../evals/agent-harnessing-v1-evaluation-design.md`](../evals/agent-harnessing-v1-evaluation-design.md). Critical authority, privacy, security, and evidence-integrity checks require zero violations. A task-shaped team must be non-inferior on task success and show a material improvement in critical-finding recall, human review time, or normalized quality without exceeding the default cost and latency bounds.

Authentic user acceptance remains operator-held. CI, publication, deployment, health, authentication, external execution, and acceptance are recorded as separate evidence kinds.

## Ownership

- `org-meta` owns the normative doctrine, vocabulary, lifecycle, policy, and accepted schema namespace.
- Baton owns durable tasks, runs, authenticated agent records, relations, ownership leases, traces, authority snapshots, artifacts, evidence, handoffs, and promotion or restriction history.
- Retort owns versioned provider-portable onboarding plus validate, sync, update, diff, migrate, and doctor for already-scaffolded repositories.
- Cognitive Mesh owns gated orchestration and benchmark execution, initially read-only and opt-in.
- Sluice owns model and provider routing policy, virtual keys, quotas, budgets, timeouts, retries, and content-free usage telemetry.
- Docket owns cost and latency attribution by repository, task, trace, agent or team, workflow, tier, model, and component.
- CodeFlow supplies normalized review findings and quality evidence; it is neither the task orchestrator nor merge authority.
- Product repositories own thin domain roles, skills, workflows, guardrails, fixtures, and authentic acceptance boundaries.

## Alternatives considered

### Standardize on one provider runtime

Rejected. It offers faster initial integration but couples durable authority, evidence, and lifecycle semantics to a product surface that can change or be withdrawn. Provider capabilities remain adapters.

### Start with live inter-agent networking

Rejected for v1. It adds discovery, identity, streaming, replay, cancellation, and partial-failure complexity before the portfolio has a common task, lease, authority, evidence, and idempotency envelope. Artifact-mediated handoffs are inspectable and replayable.

### Copy an existing repository's full roster

Rejected. A large standing roster increases routing error, context overhead, duplicated skills, and maintenance cost. Mystira remains a comparison corpus, not the template.

### Keep contracts as prose only

Rejected. Prose is essential for rationale but cannot deterministically validate references, authority containment, lifecycle transitions, or evidence completeness.

### Allow autonomous merge after passing checks

Rejected for v1. Aggregate CI does not prove exact-head freshness, actionable review resolution, changed-component coverage, current mergeability, branch policy, or authentic acceptance. The harness may prepare a landing decision, not take it.

## Consequences

### Positive

- Repository policy can survive changes in provider runtimes and protocols.
- Task and authority boundaries become testable before runtime adoption.
- Baton, Retort, Sluice, Docket, CodeFlow, and Cognitive Mesh receive explicit integration contracts rather than overlapping orchestration duties.
- Small teams must demonstrate value relative to simpler routes.
- Evidence remains source-bound and layered, reducing accidental overclaiming.
- Restrictions and migrations can target a contract or adapter version.

### Costs and risks

- The schema and semantic linter add governance and versioning work.
- A2A, MCP, OpenTelemetry, and provider adapters require ongoing compatibility tests.
- Accurate cost attribution needs coordinated Sluice, Docket, and Baton changes.
- Human review remains a deliberate throughput constraint for external effects and landing.
- A ConvoLens-owned candidate could be mistaken for an organization standard unless its proposed status is preserved.

## Adoption sequence

1. Review this candidate, research record, schema, and fixtures in ConvoLens without scaffolding agents.
2. Re-establish and approve the normative doctrine in `org-meta`, selecting the canonical schema owner and namespace.
3. Add Baton structural fields and APIs for runs, authenticated agents, leases, authority snapshots, artifacts, evidence, handoffs, and promotion records.
4. Extend Retort's existing scaffold metadata and sync foundation with contract validation, update, versioned migration, and provider adapters.
5. Connect Sluice model-policy metadata, Docket cost and latency attribution, and CodeFlow normalized findings.
6. Run read-only ConvoLens fixtures through the simplest route and candidate adapters.
7. Admit Cognitive Mesh only for opt-in Tier 3 read-only planning or evaluation after identity, timeout, budget, cancellation, and failure gates pass.
8. Record a human promotion or restriction decision in Baton for each named task family.

## Required follow-up decisions

- Which repository owns the normative schema and compatibility suite after `org-meta` review?
- Which identity claims and trust roots bind a runtime agent to a Baton agent and lease?
- What retention and access policy applies to content-bearing local trajectories and artifacts?
- Which adapters are mandatory for the first pilot, and which remain experimental?
- Which repository-specific failure fixtures are required before any workspace-write trial?

## References

- [`../research/agent-harnessing-v1-primary-sources-2026-08-09.md`](../research/agent-harnessing-v1-primary-sources-2026-08-09.md)
- [`../evals/agent-harnessing-v1-evaluation-design.md`](../evals/agent-harnessing-v1-evaluation-design.md)
- [`../evals/fixtures/agent-harnessing-v1-convolens.json`](../evals/fixtures/agent-harnessing-v1-convolens.json)
- [`../HANDOFF-2026-08-09-AGENT-HARNESSING-V1.md`](../HANDOFF-2026-08-09-AGENT-HARNESSING-V1.md)
