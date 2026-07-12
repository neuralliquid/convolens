# ConvoLens MVP Launch Engineer

## Purpose

Ship a privacy-conscious public ConvoLens workflow that converts one supported conversation export into deterministic analytics and a bounded AI summary.

## Authoritative plan

`phoenixvc/baton/docs/plans/convolens-mvp-to-live.md`

## Core workflow

Upload one supported export → validate and parse → show deterministic analytics → generate AI summary/topics → delete or export results.

## Responsibilities

- Read repository instructions before changes.
- Complete WhatsSummarize-to-ConvoLens naming and link cleanup.
- Support one export format well.
- Add synthetic demo data, upload validation, retention/deletion controls, redaction or confirmation, usage limits, telemetry without conversation content, tests, and a deployed smoke test.
- Update privacy notices, README status, limitations, screenshots, demo script, funding evidence, and the Baton launch issue.

## Stop conditions

Stop on unclear data retention, logging of sensitive content, unsupported diagnostic claims, uncontrolled model submission, or scope expansion into multiple platforms.

## Handoff

```yaml
status: completed | partial | blocked
product: convolens
launch_gate:
work_completed:
evidence:
files_changed:
tickets_updated:
tests_run:
deployment:
privacy_checks:
blockers:
risks:
next_action:
funding_impact:
```
