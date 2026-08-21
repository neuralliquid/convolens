# ConvoLens pointer — Sluice cutover to cel-prod-sluice

Date: 2026-08-21

Canonical handoff lives in Sluice (this is the consumer-side stub):

[`celladore/sluice` `docs/handoffs/2026-08-21-cel-prod-sluice-cutover.md`](https://github.com/celladore/sluice/blob/dev/docs/handoffs/2026-08-21-cel-prod-sluice-cutover.md)

## Decision

Point ConvoLens at **`https://litellm.sluice.celladoresystems.com`**. Do not create `nl-prod-sluice`. Do not keep using `https://litellm.sluice.phoenixvc.tech` once Celladore virtual keys work.

neuralliquid-sub has ConvoLens (`nl-prod-convolens-rg`) and **no** Sluice stack. Cross-sub HTTPS to Celladore is intentional.

## Gate 0 (passed 2026-08-21)

A restricted Celladore key is accepted. Health-green was not the proof.

- `cel-prod-sluice-ca` has `DATABASE_URL`. Foundry Whisper is `Succeeded` in eastus2.
- Existing NeuralLiquid KV `sluice-api-key` (Mystira virtual key) still works on `https://litellm.sluice.phoenixvc.tech` (`convolens-catch-up-v1`) and is **401** on Celladore. Phase 3 did not restore the Mystira key table; mint new keys.
- Celladore-native `vkey-xtox` returns 200/`foundry-whisper` on Celladore and 401 on Mystira.
- Minted Celladore `convolens` key (`convolens-catch-up-v1`, 7d/$5, 30 RPM). Stored as `vkey-convolens` in `cel-prod-sluice-kv` and copied to `nl-prod-convolens-nl-kv` as **`sluice-api-key-celladore`**. Live `sluice-api-key` was not overwritten.

## This-repo files changed this session

- `infra/terraform/env/prod/variables.tf` — `sluice_base_url` default is now Celladore
- `apps/api/.env.example` — same

## Remaining live flip (do as one Production-NeuralLiquid deploy)

Do not overwrite live `sluice-api-key` before the URL change is applied. NeuralLiquid reads the key from KV and the URL from this Terraform default; splitting them 401s catch-up.

1. Copy `sluice-api-key-celladore` over `sluice-api-key` in `nl-prod-convolens-nl-kv` immediately before apply, **or** point `sluice_api_key_secret_name` at `sluice-api-key-celladore` in that apply.
2. Dispatch `deploy-prod.yml` on `main` with `deployment_environment=Production-NeuralLiquid`.
3. Confirm the API revision has `SLUICE_BASE_URL=https://litellm.sluice.celladoresystems.com` and a catch-up call is attributed.
4. GitHub environment `SLUICE_API_KEY` is required only for the legacy Mystira `Production` target (`manage_runtime_secrets_with_terraform=true`). Rotate it to the Celladore key before any further Mystira-sub deploy; do not use that target to finish Whisper.

## Related ConvoLens PRs merged this session

- [#193](https://github.com/neuralliquid/convolens/pull/193) CI concurrency
- [#201](https://github.com/neuralliquid/convolens/pull/201) voice-note scoping
- [#205](https://github.com/neuralliquid/convolens/pull/205) media-tone PRD/ADR/SPEC
