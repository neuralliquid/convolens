# Agent Harnessing v1 portfolio handoff

Date: 2026-08-09

Status: planning and task creation complete; implementation deliberately deferred

Canonical Baton epic: `e1c82235-02d8-4b99-ba86-da2195271845` (`/link/task-e1c82235`)

ConvoLens adoption task: `d0e6826c-6739-443a-82cb-df9359d1f200`

## Outcome

The July Agent Operating Model v0 epic was promoted to a **critical** Agent Harnessing v1 research, standards, and cross-repository adoption program. A second competing factory epic was not created. The canonical epic now has nine acceptance checkpoints and explicit `relates_to` links to work owned by ConvoLens, Baton, OmniPost, Retort, Cognitive Mesh, Sluice, Docket, CodeFlow, House of Veritas, NexaMesh, and Mystira.

No agents, hooks, commands, runtime integrations, or scaffolding were implemented in this session. The next session should be dedicated to research and specification before any repository adopts generated files.

## Decisions to carry forward

### Portfolio ownership

- `org-meta` owns doctrine, vocabulary, lifecycle, policy, and the normative contract.
- Baton owns durable task identity, lifecycle, evidence, relations, leases/ownership, blockers, artifacts, handoffs, and promotion/restriction history. It is the asynchronous cross-session ledger, not the live runtime.
- Retort owns versioned, provider-portable scaffolding and the first-onboarding plus already-scaffolded update/migrate/diff/doctor experience.
- Cognitive Mesh owns gated orchestration/runtime execution and benchmark gates. It does not receive default repository-write, external-effect, or merge authority.
- Sluice owns model/provider routing policy, virtual keys, quotas, budgets, timeouts, and model telemetry.
- Docket owns cost and latency attribution by repo, task, trace, agent/team, workflow, complexity tier, model, and component.
- CodeFlow should supply review and quality-analysis evidence. It should not become the task orchestrator or merge authority.
- Product repositories keep thin domain agents, skills, workflows, and guardrails. They should not fork the shared engine or policy.

### Agents versus teams

Use agents for stable capabilities, authority boundaries, or independent evaluation perspectives. Use skills for reusable procedures. Use hooks for deterministic enforcement. Use task-shaped teams for a particular workflow. Do not create an always-on team or a named agent for every technology.

A themed display name may vary by product, but every role needs a stable functional alias such as `privacy-reviewer`, `parser-engineer`, or `change-integrator`. This keeps Retort templates, Baton routing, evaluations, and cross-repository handoffs portable.

### Vertical and horizontal split

- Vertical roles own an end-to-end product slice: intake/parsing, deterministic analytics, bounded AI insight, user experience, integration, or persistence/retention.
- Horizontal roles apply across slices: routing, privacy/security, evidence/claims, runtime/telemetry, change integration, and knowledge/handoff.
- Parallelize only independent, idempotent, read-only, or isolated-worktree work. Serialize shared-file edits, migrations, authentication/privacy decisions, external effects, and merge/closeout.
- Keep one accountable task owner even when specialists contribute.

## Proposed ConvoLens theme and minimal roster

Use an **Observatory** theme, distinct from Mystira's court/craft vocabulary. Treat these as candidates to evaluate, not approved files to scaffold.

| Display name | Stable functional alias | Axis | Responsibility |
| --- | --- | --- | --- |
| Prism | `dispatcher` | horizontal | classify work, select the smallest workflow, create/claim Baton work, and sequence specialists |
| Veil | `privacy-reviewer` | horizontal | conversation-content privacy, retention/deletion, model-processing boundaries, and no diagnostic claims |
| Focus | `evidence-auditor` | horizontal | claims, synthetic labels, screenshots, source links, acceptance layers, and evidence quality |
| Aperture | `change-integrator` | horizontal | PR landing/closeout gates, merge, post-merge verification, handoff, Baton update, and cleanup |
| Beacon | `runtime-operator` | horizontal | deployment, health, telemetry, incident evidence, and the prohibition on conversation-content telemetry |
| Archive | `knowledge-curator` | horizontal | durable handoffs, decisions, drift, and retrospective improvements |
| Decoder | `intake-parser-engineer` | vertical | supported export intake, deterministic parsing, identity, fixtures, and failure isolation |
| Signal | `analytics-engineer` | vertical | deterministic analytics that remain useful without an LLM |
| Lens | `ai-insight-engineer` | vertical | bounded summaries/topics and Sluice-routed AI behavior without psychological or diagnostic claims |
| Frame | `experience-engineer` | vertical | accessible product workflows, explicit confirmation, and honest capability/source labels |
| Relay | `integration-engineer` | vertical | browser extension, Baton, and other product integrations with idempotency and revoke/delete behavior |
| Vault | `data-lifecycle-engineer` | vertical | persistence, retention, deletion, deduplication, provenance, and migration safety |

Start with the functional aliases and only instantiate the roles a task needs. A likely first pilot needs Decoder, Signal, Veil, Focus, and Aperture; it does not need all twelve agents active.

Suggested task-shaped teams:

1. Intake and Trust: Decoder + Vault + Veil.
2. Insight: Signal + Lens + Focus.
3. Experience and Integration: Frame + Relay, with Veil when user data or external writes are involved.
4. Ship and Operate: Beacon + Aperture, with the relevant vertical owner accountable for the change.

## Complexity and sequencing model to research

| Tier | Typical work | Default behavior |
| --- | --- | --- |
| 0 | read-only question, trivial local edit | one agent; no orchestration |
| 1 | bounded single-domain change | implementer, targeted validation, then Aperture/`change-integrator` |
| 2 | cross-domain, privacy/security-sensitive, or multi-component change | scout/planner, independent specialist reviews, accountable implementer, explicit guardrail gates, then closeout |
| 3 | architecture, multi-repository, production, identity, migration, or material external effects | Baton epic/decision record, human approval, isolated workstreams, integration evaluation, release evidence, and authentic acceptance |

Complexity is not only estimated size. Routing must include reversibility, blast radius, data sensitivity, authority required, coupling, novelty, verification cost, and whether an authentic human/external-system action is necessary.

## Inter-agent communication feasibility

Live peer-to-peer agent messaging is runtime-specific and is not yet a portable repository capability. Retort has task state and handoff concepts; Baton can durably coordinate agents and sessions; some providers expose native subagents. None of that justifies assuming a reliable, cross-provider conversational mesh.

Adopt artifact-mediated communication first. Every handoff should carry:

- Baton task and trace/run identifiers;
- sender, accountable owner, lease/expiry, and intended recipient capability;
- objective, inputs, assumptions, authority/tool/data limits, and prohibited effects;
- current state, artifacts/diffs, commands/checks, evidence links, and confidence;
- blockers, unresolved risks, required approval, idempotency key, and next action.

Avoid chatty peer meshes, circular notifications, anonymous findings, and multiple agents editing the same worktree. Add capability discovery, deduplication, lease/ownership, retry, timeout, and dead-letter semantics before stateful inter-agent work.

## Cognitive Mesh boundary

Cognitive Mesh is realistic initially as an opt-in research/evaluation backend for high-complexity planning, read-only analysis, independent comparison, and benchmarkable orchestration. It is not yet the default ConvoLens coding harness.

Promotion to stateful repository work requires a workspace adapter; authenticated agent identity; consent and authority scopes; tool/data allowlists; Baton task/trace correlation; leases and idempotency; budgets and Sluice/Docket telemetry; timeouts/retries/backpressure; approval points; deterministic tests; failure drills; cost/latency thresholds; and a recorded human promotion decision. Write, external-effect, and merge authority remain restricted until those gates pass.

## Common skills, commands, hooks, and guardrails

The shared baseline should be small and composable:

- Commands/workflows: `discover`, `plan`, `implement`, `validate`, `review`, `handoff`, `land`, `doctor`, `sync`, `update`, `diff`, and `migrate`.
- Skills: repository orientation, task/Baton intake, isolated-worktree setup, focused implementation, baseline-versus-change validation, security/privacy review, evidence/claims audit, PR review remediation, PR landing/closeout, deployment verification, and durable handoff.
- Hooks: destructive-command guard, sensitive-file/secret guard, worktree ownership guard, formatting after edits, pre-push validation, stop-with-uncommitted-or-unverified-work warning, budget guard, and session-start repository/task reminder.
- Guardrails: authority and tool allowlists; content/privacy constraints; external-effect confirmation; no fabricated acceptance; idempotency; bounded retries/timeouts; cost ceilings; audit evidence; rollback; and explicit lifecycle promotion/restriction.

Retort already provides useful vocabulary around discover/spec/plan/check/review/handoff/doctor and task orchestration, but its current catalog/team mappings and sequential handoff chains need rationalization. Mystira demonstrates rich themed roles, hooks, handoffs, and traces, but its large roster should be measured for overlap, prompt cost, notification amplification, and routing quality before reuse.

## The missing PR closeout capability

The clearest common name is **PR landing** or **change integration**. Other useful industry terms are **merge readiness**, **merge train/merge queue**, **release train**, **change control**, **ship/land**, and **post-merge verification**. “Closeout” is broader than landing because it includes durable evidence, task/handoff updates, and local cleanup.

Use `land` as the short command, `pr-landing` as the skill/workflow identifier, and `change-integrator` as the stable agent alias. The workflow must:

1. Reconstruct current remote PR/head/base state and exact diff.
2. Confirm required component checks passed on the exact head or approved merged result.
3. Confirm base freshness, current mergeability, and required branch/ruleset gates.
4. Inspect requested reviews, bot comments, review threads, annotations, and unresolved actionable findings.
5. Request reviewers when policy requires them and none exist; never manufacture approval.
6. Perform and record an exact-diff self-review when allowed, including the unavailable-review-tool case.
7. Address findings, push, and repeat the exact-head gates after every change.
8. Merge only when all applicable gates are satisfied.
9. Verify the merge SHA/tree and post-merge CI, publication, deployment, or health layers that the change triggers.
10. Keep authentic user/operator acceptance separate from CI, deployment, and health.
11. Update Baton and the repository handoff with evidence, then remove only verified merged worktrees/branches while preserving unrelated work.

CodeFlow and review bots should provide normalized evidence to this workflow, not own merge authority. Adopt one primary automated code reviewer plus complementary deterministic security/quality checks; avoid redundant bots that produce conflicting or duplicate threads.

## Baton task map

| Repository | Task | Priority |
| --- | --- | --- |
| Portfolio/Retort | `e1c82235-02d8-4b99-ba86-da2195271845` Agent Harnessing v1 epic | critical |
| ConvoLens | `d0e6826c-6739-443a-82cb-df9359d1f200` Observatory design and pilot | critical |
| Baton | `65506574-ebb3-4761-a723-fdebe2e20323` durable workflow/evidence/communication ledger | critical |
| Retort | `5b8cf767-5ef3-4a5a-bea2-c84f2d6260bf` onboarding, update, migration, and drift repair | critical |
| Cognitive Mesh | `1ec54695-abd3-4bd7-b03e-53ed5f19133f` complexity qualification and promotion gates | critical |
| OmniPost | `1d4cec56-6936-4579-b4fb-f3ec9a22d386` publication/reconciliation adoption | high |
| Sluice | `7e1ce5ea-e1f5-461e-89ce-ce1066d46d6d` team routing, budgets, and evaluation | high |
| Docket | `771b4f65-df0e-473a-b416-e880641c6b69` cost/latency attribution | high |
| CodeFlow | `5aada06f-8c56-4168-a621-2ad0abff6592` review stack and landing evidence | high |
| House of Veritas | `39f50f18-dfbc-48a0-9e1b-dcd94f538186` governance/identity/release guardrails | high |
| NexaMesh | `48a6faed-2a77-4a60-a981-6596332bcee3` federated identity/capability/comms boundary | high |
| Mystira | `fbfa562a-ea00-4465-adf1-ae14574f9f11` roster rationalization/reference evaluation | high |

Related ConvoLens follow-up already on the task list: `d885e196-95c0-410d-a165-1cf7370982b4` fixes baseline lint failures. Keep it separate from harness research so existing failures are not misattributed to future scaffolding.

## Where the portfolio still falls short

- There is no approved normative schema joining Retort specs, Baton task state, Cognitive Mesh runs, Sluice/Docket telemetry, and CodeFlow evidence.
- Current agent names and categories are richer than the demonstrated routing/evaluation evidence.
- Provider-native subagent features are not portable and do not prove durable inter-agent communication.
- Retort's already-scaffolded update/migration path, provenance, reversibility, and local-extension preservation are not yet the standard onboarding procedure.
- Cognitive Mesh has useful orchestration patterns but lacks the full workspace/identity/approval/evidence promotion package required for autonomous product-repository writes.
- Review bots can overlap, rate-limit, or disagree; a normalized actionable-thread/evidence contract is missing.
- Exact-head PR landing and post-merge closeout are practiced manually but are not yet a shared, tested skill.
- Cost, latency, outcome quality, regression rate, and human-review burden are not yet compared across single-agent and team workflows.
- Agent definition files can increase prompt/context cost and drift unless discovery is lazy and generated content is thin.

## Dedicated next-session sequence

1. Claim the critical epic and ConvoLens task in Baton; do not start by scaffolding files.
2. Research current primary/official sources for agentic SDLC, harness contracts, inter-agent protocols, evaluation, merge queues/trains, review automation, and secure tool execution. Date the evidence and distinguish standards from vendor-specific features.
3. Audit the live default branches of Retort, Mystira, Cognitive Mesh, Baton, Sluice, Docket, CodeFlow, and NexaMesh. Treat older docs as hypotheses until code/tests confirm them.
4. Produce the normative role/team/workflow/communication/evidence schema and ADR with clear ownership boundaries.
5. Define eval fixtures and promotion thresholds before implementation.
6. Implement Retort onboarding/update mechanics and the `land` workflow in isolated PRs.
7. Pilot only the minimum ConvoLens Observatory slice, measure it, and record promote/restrict decisions before portfolio rollout.

## Closeout boundary

This handoff records recommendations and Baton planning only. It does not claim that the Observatory roster exists, that live inter-agent communication works, that Cognitive Mesh can safely edit or merge ConvoLens, or that any repository has adopted Agent Harnessing v1.
