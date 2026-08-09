# Agent Harnessing v1: primary-source research and live interface audit

- **Status:** Research complete; recommendations are inputs to proposed ADR-0002
- **Research date:** 2026-08-09
- **Baton epic:** `e1c82235-02d8-4b99-ba86-da2195271845`
- **ConvoLens task:** `d0e6826c-6739-443a-82cb-df9359d1f200`
- **Scope:** agentic software delivery, portable contracts, inter-agent protocols,
  evaluations, secure tool execution, review automation, and PR landing

## Executive conclusion

Agent Harnessing v1 should be a **composed, provider-neutral control contract**, not a new
agent framework and not a large generated roster.

The current industry evidence supports five decisions:

1. Start with one accountable agent and add task-shaped delegation only when work is
   independently decomposable or needs a genuinely independent evaluation perspective.
2. Treat skills, hooks, runtime subagents, MCP, and A2A as different layers. They are not
   interchangeable and none of them replaces durable task/evidence state.
3. Use artifact-mediated handoffs with task, trace, lease, authority, evidence, and
   idempotency fields before enabling a live cross-provider agent mesh.
4. Make safety, privacy, exact-head change evidence, and external-effect authorization
   deterministic gates. Model self-assessment is supplementary evidence, not an authority
   grant.
5. Keep schemas and eval fixtures in version control with provider adapters. Hosted vendor
   products and experimental telemetry conventions are allowed integrations, not the source
   of truth.

This research does **not** approve repository-write, external-effect, deployment, or merge
authority for Cognitive Mesh or any proposed ConvoLens Observatory role.

## Research method and evidence classes

Only primary or official sources were used for external technical claims: standards bodies,
project specifications, vendor engineering reports, vendor product documentation, and
maintainer-owned repositories. Sources were checked on 2026-08-09.

Evidence is classified as:

- **Standard:** a published protocol or specification with an identified stability level.
- **Official guidance:** normative or operational documentation from the system owner.
- **Vendor result:** a provider's own measured experience; useful but not automatically
  portable or independently reproduced.
- **Live repository evidence:** code or tests on the exact current default-branch head.

## Terminology adopted for v1

| Term       | v1 meaning                                                                                                                       |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Agent      | A runtime instance operating under a stable functional role, scoped tools, data, authority, budget, and exit conditions.         |
| Role       | A stable capability and authority boundary such as `privacy-reviewer`; a themed name is display metadata.                        |
| Skill      | A reusable, lazily loaded procedure with explicit triggers, inputs, tools, and outputs.                                          |
| Hook       | Deterministic code invoked at a lifecycle or tool boundary to allow, deny, transform, validate, or record an operation.          |
| Workflow   | An ordered or dependency-linked set of steps and gates. The route is constrained even if an agent chooses tactics within a step. |
| Team       | A task-scoped composition of roles with one accountable owner; it is not a permanent chat room.                                  |
| Harness    | The environment, contract, policy, feedback, evidence, and lifecycle machinery surrounding model execution.                      |
| Ledger     | Baton's durable asynchronous record of task identity, state, evidence, ownership, blockers, and promotion decisions.             |
| Runtime    | Provider-specific execution machinery, including native subagents or Cognitive Mesh.                                             |
| Handoff    | A versioned artifact that transfers state and accountability without requiring shared conversational memory.                     |
| PR landing | Exact-head readiness, merge, post-merge verification, durable closeout, and verified cleanup.                                    |

The industry also uses _agentic workflow_, _multi-agent orchestration_, _merge queue_,
_merge train_, _change control_, and _harness engineering_. These are useful search terms but
do not replace the stable aliases above.

## Current primary-source findings

### 1. Harness engineering and task decomposition

- OpenAI's February 2026 harness-engineering report describes repository-embedded skills,
  worktree-per-change execution, agent-readable logs/metrics, self-review loops, and feedback
  infrastructure as the main engineering surface. This is a strong vendor result for isolated
  workspaces and legible evidence, not proof that human review is unnecessary in this
  portfolio. [OpenAI: Harness engineering](https://openai.com/index/harness-engineering/)
- Anthropic's long-running-agent work uses persistent feature lists, progress artifacts,
  commits, and startup verification to bridge context windows. It explicitly leaves open
  whether specialized multi-agent designs outperform a general agent across contexts.
  [Anthropic: Effective harnesses for long-running agents](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents)
- Anthropic's production research system found multi-agent execution useful for breadth-first,
  independently searchable work and a poor fit for tightly coupled work requiring shared
  context. Its performance numbers are internal vendor measurements and must not be generalized
  to coding without a portfolio benchmark.
  [Anthropic: Multi-agent research system](https://www.anthropic.com/engineering/multi-agent-research-system)
- Anthropic's 2026 C-compiler experiment used separate clones and task locks. Parallelism lost
  value when every agent hit the same serial blocker, and the experiment cost nearly USD 20,000.
  It is evidence for isolation, ownership locks, deterministic oracles, and explicit cost gates;
  it is not a production-readiness claim.
  [Anthropic: Parallel C compiler experiment](https://www.anthropic.com/engineering/building-c-compiler)
- OpenAI's practical guide recommends growing a single agent with tools before adding a
  multi-agent system. Anthropic's earlier agent guidance similarly favors simple, composable
  patterns. [OpenAI: Practical guide to building agents](https://openai.com/business/guides-and-resources/a-practical-guide-to-building-ai-agents/),
  [Anthropic: Building effective agents](https://www.anthropic.com/engineering/building-effective-agents)

**Implication:** tiers 0 and 1 default to one agent. Parallel work requires independent scopes,
isolated workspaces or read-only access, idempotency, and a single integrator. A named specialist
must earn its prompt, routing, evaluation, and maintenance cost.

### 2. Agent-to-agent and agent-to-tool protocols

- The Linux Foundation A2A project's latest specification presents **A2A v1.0** as the stable
  agent-to-agent protocol. It defines Agent Cards, messages, artifacts, stateful tasks,
  streaming/push updates, multiple transport bindings, version negotiation, idempotency
  semantics, security schemes, and signed Agent Cards.
  [A2A v1.0 specification](https://a2a-protocol.org/latest/specification/),
  [A2A v1.0 announcement](https://a2a-protocol.org/latest/announcing-1.0/)
- A2A explicitly positions MCP as complementary: MCP connects an agent to tools and context;
  A2A coordinates independent agents. A2A does not define a repository's approval policy,
  ownership lease, merge authority, or evidence sufficiency.
- MCP's 2025-11-25 specification uses JSON Schema and defines capability negotiation,
  resources, prompts, tools, sampling, elicitation, and authorization for HTTP transports.
  MCP **tasks are experimental**, so they cannot be Baton's durable lifecycle source of truth.
  [MCP overview](https://modelcontextprotocol.io/specification/2025-11-25/basic),
  [MCP tasks](https://modelcontextprotocol.io/specification/2025-11-25/basic/utilities/tasks)
- MCP authorization is based on OAuth-related standards, requires resource audience binding and
  PKCE for supported flows, and prohibits token passthrough. Elicitation separates sensitive
  out-of-band input from ordinary form data.
  [MCP authorization](https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization),
  [MCP elicitation](https://modelcontextprotocol.io/specification/2025-11-25/client/elicitation)

**Implication:** the v1 handoff/evidence schema is transport-neutral. Baton stores the durable
record. A2A and MCP adapters may carry references to it, but neither protocol is the policy
authority. No live A2A service is required for the ConvoLens pilot.

### 3. Secure execution, identity, and approvals

- NIST launched an AI Agent Standards Initiative in February 2026. Its current identity and
  authorization work is still a concept-paper project concerned with agent identification,
  authorization, auditing, non-repudiation, and prompt injection. The field is active but not
  mature enough to treat one vendor identity model as a settled standard.
  [NIST AI Agent Standards Initiative](https://www.nist.gov/artificial-intelligence/ai-agent-standards-initiative),
  [NIST/NCCoE identity and authorization concept paper](https://csrc.nist.gov/pubs/other/2026/02/05/accelerating-the-adoption-of-software-and-ai-agent/ipd)
- OpenAI describes prompt injection as an open security problem and recommends layered controls:
  least privilege, sandboxing, monitoring, explicit instructions, and confirmation before
  consequential actions. Its 2026 source/sink framing reinforces separating untrusted content
  ingestion from dangerous tools or data transmission.
  [OpenAI: Understanding prompt injection](https://openai.com/index/prompt-injections/),
  [OpenAI: Designing agents to resist prompt injection](https://openai.com/index/designing-agents-to-resist-prompt-injection/)
- Anthropic's coding-agent security report similarly treats filesystem and network sandboxing as
  a stronger boundary than repeated permission prompts alone.
  [Anthropic: Coding-agent sandboxing](https://www.anthropic.com/engineering/claude-code-sandboxing)
- GitHub's current agent hooks can programmatically approve or deny tool execution and record
  lifecycle events. This is official vendor functionality, not a portable hook file format.
  [GitHub: Copilot hooks](https://docs.github.com/en/copilot/concepts/agents/hooks)

**Implication:** v1 requires authenticated actor identity, a task-bound authority snapshot,
workspace and network boundaries, data classification, allowlists, an explicit external-effect
policy, and immutable approval evidence. Untrusted retrieved content can never expand authority.
Merge authority stays denied during the ConvoLens pilot.

### 4. Evaluation and observability

- Anthropic's 2026 eval guidance distinguishes task, trial, grader, assertion, and transcript;
  recommends multiple trials for stochastic systems; and advocates eval-driven development
  before capability rollout.
  [Anthropic: Demystifying evals for AI agents](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents)
- Public benchmark suites such as SWE-bench Verified, SWE-Lancer, and METR time horizons are
  useful model/harness capability signals, but they do not measure ConvoLens privacy, exact-head
  PR evidence, Baton closeout, or portfolio-specific cost. The pilot needs repository fixtures
  and a single-agent baseline.
  [OpenAI Evals research index](https://evals.openai.com/),
  [METR task-completion time horizons](https://metr.org/time-horizons/)
- OpenAI announced on 2026-06-03 that hosted Agent Builder and Evals products are being wound
  down, with the Agents SDK recommended for code-owned workflows. This is a direct portability
  warning: eval definitions and raw results must remain exportable and repository-owned.
  [OpenAI: AgentKit update](https://openai.com/index/introducing-agentkit/)
- OpenTelemetry semantic conventions 1.43 moved GenAI conventions to a separate repository, and
  the related agent/tool attributes remain development-stage. Tool arguments and results may be
  sensitive. Stable low-cardinality portfolio fields should therefore be owned by the v1 logical
  contract and mapped to OpenTelemetry where safe.
  [OpenTelemetry semantic conventions](https://opentelemetry.io/docs/specs/semconv/),
  [OpenTelemetry GenAI attribute registry](https://opentelemetry.io/docs/specs/semconv/registry/attributes/gen-ai/)
- W3C Trace Context provides portable distributed trace propagation, while a Baton task ID and
  business run ID serve different purposes. The contract keeps them separate.
  [W3C Trace Context](https://www.w3.org/TR/trace-context/)

**Implication:** evaluate outcome, process safety, evidence quality, cost, latency, and human
burden. Do not grade only the final answer. Do not put prompts, conversation content, free-form
tool arguments, or user data in metric labels.

### 5. Review automation and PR landing

- GitHub protected branches can require reviews, exact status checks, conversation resolution,
  deployments, and a merge queue. A merge queue validates a merge group against the latest base,
  which is stronger than relying on an old green head check.
  [GitHub: Protected branches](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches),
  [GitHub: Merge queues](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/configuring-pull-request-merges/managing-a-merge-queue)
- GitHub Copilot code review can use repository instructions, skills, and MCP context, but several
  capabilities remain preview features and re-reviews may repeat comments. It produces review
  evidence; it does not own merge authority.
  [GitHub: Copilot code review](https://docs.github.com/en/copilot/concepts/agents/code-review)
- Azure Repos similarly reevaluates branch policies on source changes and can expire validation
  after the target branch advances. This supports a provider-neutral base-freshness gate.
  [Azure Repos branch policies](https://learn.microsoft.com/en-us/azure/devops/repos/git/branch-policies)
- SLSA 1.2 now includes a Source Track covering immutable revisions, human-readable diffs,
  identity, change history, technical controls, provenance, and code review at higher levels.
  [SLSA v1.2](https://slsa.dev/spec/v1.2/),
  [SLSA source requirements](https://slsa.dev/spec/v1.2/source-requirements)

**Implication:** `land` must consume normalized evidence for the exact PR head or approved merged
result, current base, required checks, approvals, threads, mergeability, merge result, and
triggered post-merge layers. CI, deployment, health, and authentic acceptance remain distinct.

## Live portfolio interface audit

The audit refreshed remote-tracking refs or queried GitHub directly and then read code/tests from
the exact default-branch heads below. Older handoffs were treated as hypotheses.

| Owner           | Default branch and observed head                      | Current reusable interface                                                                                                                             | Confirmed gap for v1                                                                                                                                                                                                                                                                                                |
| --------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ConvoLens       | `main` @ `11c4adf319f0d3e57d55b2d23253120edcf8fd25`   | Merged v1 planning handoff and product privacy constraints.                                                                                            | No Observatory files exist; pilot contract and evals remain proposed.                                                                                                                                                                                                                                               |
| org-meta        | `master` @ `8b5434a836458ca8bc6414385d03c52875f014a3` | Cross-repository architecture directory and organization documentation.                                                                                | The previously reported `architecture/agent-operating-model.md` is absent from the live default branch. The v1 contract therefore has no current org-meta approval and remains a candidate.                                                                                                                         |
| Retort          | `dev` @ `009761a5df21f1ac76193599f380c0771e2a3542`    | `.agentkit/spec/project.yaml`, `sync --diff`, scaffold cache, three-way preservation, version/spec-hash manifest, doctor and handoff tests.            | No shared role/team/handoff/evidence contract; no distinct `update`, versioned `migrate`, or `land` lifecycle; top-level provenance is too coarse for cross-repo promotion evidence.                                                                                                                                |
| Baton           | `main` @ `17210b6bb2555d340b53344d26fa73f03e3626a6`   | Tasks, task runs, agent registry, activity, relations, messages, `controlled_by`, and `trace_id`.                                                      | Runs do not structurally hold leases, authority, idempotency, artifact/evidence collections, costs, gate results, or promotion decisions.                                                                                                                                                                           |
| Cognitive Mesh  | `dev` @ `50ebd5b0e65fbcf8b75a092641d36ab43c6bf533`    | Agent/team records, orchestration ports, authority scopes, approval adapter, deterministic test adapters, and benchmark documents.                     | The active multi-agent engine uses in-memory task state and a placeholder audit ID; the examined execution contract lacks workspace, lease, trace, idempotency, and portable evidence fields. Auto-approval exists for explicitly pre-approved/benchmark use, so promotion must bind configuration and environment. |
| Sluice          | `dev` @ `b57649366d066680270d38d258dcb1df116178bc`    | Proposed `sluice.agent-workflow.v1` contract with virtual-key identity, aliases, budgets, bounded metadata, retries, and content-free telemetry rules. | Needs task/run/trace adapter mapping and end-to-end proof at Docket; current observe-stage metadata enforcement is not production rejection evidence.                                                                                                                                                               |
| Docket          | `dev` @ `3f51a83ae6cb0e5f3f10c8f18bc27682ca66715c`    | Azure FOCUS ingestion, GitHub usage ingestion, and action/cost stores.                                                                                 | In `ingestion` and `api`, the audit found no `trace_id`, `agent_id`, model, token, or latency fields. Existing `workflow_id` is GitHub workflow usage, not agent-workflow attribution.                                                                                                                              |
| CodeFlow engine | `master` @ `8b74bb2f0d0ce5f49b59620e9022a473976b9600` | PR review analyzer and workflow/report machinery.                                                                                                      | The current analyzer counts reviews/comments/approvals and emits prose recommendations; it does not normalize actionable finding identity, location, severity, state, thread resolution, head SHA, confidence, or evidence.                                                                                         |
| Mystira         | `dev` @ `4cd7620b4df53ca18c8c3552d1d06de0ed8f4b9a`    | Rich agents, skills, guards, hooks, worktree isolation, and handoff history.                                                                           | The live `.claude/agents` roster contains 30 role files and the tree contains many provider-replicated skill copies. It is a comparison corpus, not an appropriate ConvoLens default roster.                                                                                                                        |
| NexaMesh        | `dev` @ `25206a2a62f099f197e4c136176dd501dab34c20`    | Proposed agent/tool ADRs and a strong physical authority/failsafe control model.                                                                       | The inspected agent/tool ADRs remain proposed and defer advanced orchestration to Cognitive Mesh; no implemented federated agent identity, lease, discovery, or handoff contract was found.                                                                                                                         |

### Audit correction to the previous handoff

The previous handoff accurately identified the ownership split, but two descriptions need
precision after live inspection:

- Retort is not starting from zero on update safety. Its current scaffold engine already has
  useful diff, cache, and local-preservation behavior. The missing work is to make versioned
  lifecycle/provenance and the shared v1 contract explicit and testable across adopters.
- The org-meta operating-model ADR reported in prior work is not present on the current default
  branch. Until it is restored or superseded through an org-meta decision, ConvoLens can publish
  a candidate schema and evidence pack but cannot claim portfolio-wide normative adoption.

## Recommended v1 architecture

```text
org-meta doctrine + approved schema
                |
                v
Retort adapters/templates ---- product manifests and thin role/skill files
                |
                v
Baton task/run/lease/evidence ledger <----> provider runtimes
                |                                |-- native single agent/subagents
                |                                `-- gated Cognitive Mesh
                v
Sluice model policy/telemetry ----> Docket attribution
                |
                v
CodeFlow/review providers ----> normalized evidence ----> land/change-integrator
```

The schema accompanying this report is `v1alpha1`: normative in field meaning, but not an
accepted organization standard. It defines documents for a harness manifest, handoff envelope,
evidence bundle, evaluation suite, and promotion decision. Provider adapters may extend the
documents through an explicit `extensions` map; they may not silently change required semantics.

## Decision-ready recommendations

1. Submit the candidate schema and ADR to org-meta; do not mark the epic's schema-approval
   checkpoint complete from ConvoLens alone.
2. Use Baton UUIDs as durable `taskId` values. Add a separate `runId`, lease generation, and
   `idempotencyKey`. Preserve W3C `traceparent` independently when a transport supports it.
3. Make the first Observatory pilot a routing/evaluation pilot using `intake-parser-engineer`,
   `analytics-engineer`, `privacy-reviewer`, `evidence-auditor`, and `change-integrator` only when
   their capabilities are required. Do not instantiate all five for every task.
4. Restrict Cognitive Mesh to read-only planning and evaluation until the promotion suite passes
   with an authenticated identity, isolated workspace adapter, Baton lease, allowlists, bounded
   budget, deadlines, fault tests, and human decision evidence.
5. Implement `land` separately from general orchestration. It consumes evidence but never treats
   a bot comment, aggregate CI summary, deployment health, or model self-review as fabricated
   human/operator acceptance.
6. Compare every team route to the same task executed by the best available single-agent route.
   Promote only when safety is perfect on critical gates and quality/latency/cost or human burden
   shows a measured benefit appropriate to the complexity tier.

## Artifacts produced from this research

- [`ADR-0002`](../adr/0002-agent-harnessing-v1-contracts-and-promotion.md)
- [Candidate JSON Schema](../schemas/agent-harnessing-v1-candidate.schema.json)
- [Evaluation and promotion design](../evals/agent-harnessing-v1-evaluation-design.md)
- [ConvoLens candidate fixtures](../evals/fixtures/agent-harnessing-v1-convolens.json)
