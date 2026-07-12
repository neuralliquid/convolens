# CLAUDE.md

This file provides guidance to Claude Code when working in this repository.

## Project

**ConvoLens** converts supported conversation exports into deterministic analytics and bounded AI-generated insights.

- Canonical repository: `neuralliquid/convolens`
- Historical name: WhatsSummarize / `whats-summarize`; do not introduce new references using the old name.

## Startup

1. Read `AGENTS.md` when present.
2. Read `docs/agents/mvp-launch-engineer.md` for MVP, deployment, demo, telemetry, privacy, and funding-evidence work.
3. Check Baton for an existing ConvoLens task before creating duplicate work.

## Specialist routing

- Product implementation and launch gate: repository-local MVP Launch Engineer.
- Funding applications: Baton Funding Operations Agent.
- Public claims, screenshots, links, and evidence: Baton Evidence and Claims Auditor.
- AI/cloud cost and forecasts: Baton FinOps and Runway Analyst.

## Baton Integration

Baton is the shared task graph for cross-repo work. When the `baton` MCP server is available, agents should check for existing work with `task_check` at the start of meaningful tasks, create or claim visible work with `task_notify`/`log_agent_message`, update the task when significant new information becomes available, and log completion or blockers before handing off.

## Product constraints

- Support one export format well before adding platform breadth.
- Keep deterministic parsing and analytics useful without an LLM.
- Do not log conversation content in telemetry.
- Require explicit privacy, retention, deletion, and model-processing behavior.
- Do not make relationship, psychological, or diagnostic claims.
- Distinguish implemented, experimental, planned, and blocked capabilities.
