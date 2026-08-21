# ConvoLens pointer — Sluice cutover to cel-prod-sluice

Date: 2026-08-21

Canonical handoff lives in Sluice (this is the consumer-side stub):

[`celladore/sluice` `docs/handoffs/2026-08-21-cel-prod-sluice-cutover.md`](https://github.com/celladore/sluice/blob/dev/docs/handoffs/2026-08-21-cel-prod-sluice-cutover.md)

## Decision

Point ConvoLens at **`https://litellm.sluice.celladoresystems.com`**. Do not create `nl-prod-sluice`. Do not keep using `https://litellm.sluice.phoenixvc.tech` once Celladore virtual keys work.

neuralliquid-sub has ConvoLens (`nl-prod-convolens-rg`) and **no** Sluice stack. Cross-sub HTTPS to Celladore is intentional.

## This-repo files to change next session

- `infra/terraform/env/prod/variables.tf` — `sluice_base_url` default is still phoenixvc.tech
- `apps/api/.env.example` — same
- GitHub environment `SLUICE_BASE_URL` / `SLUICE_API_KEY` for Production and Production-NeuralLiquid (key must be a Celladore LiteLLM virtual key, not the Mystira one)

Do not flip until the Sluice handoff Gate 0 (restricted key accepted on the Celladore gateway) passes. Health-green is not enough.

## Related ConvoLens PRs merged this session

- [#193](https://github.com/neuralliquid/convolens/pull/193) CI concurrency
- [#201](https://github.com/neuralliquid/convolens/pull/201) voice-note scoping
- [#205](https://github.com/neuralliquid/convolens/pull/205) media-tone PRD/ADR/SPEC
