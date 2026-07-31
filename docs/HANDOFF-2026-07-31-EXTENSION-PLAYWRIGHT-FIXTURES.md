# Extension Playwright fixtures handoff

Date: 2026-07-31

## Outcome

Phase 10 adds a real-browser test layer without turning synthetic evidence into an authentic-acceptance claim.

- Playwright loads the production unpacked MV3 extension in bundled Chromium.
- `web.whatsapp.com` is fulfilled from a synthetic, non-PII fixture.
- Production API hosts are DNS-blocked and reviewed uploads go only to a local deterministic recorder.
- Four browser fixtures cover explicit review before send, payload/tracing shape, repeated-capture duplicate rendering, authenticated-owner invalidation, page console capture, and service-worker target attribution.
- A dedicated-profile provisioner supports operator-completed WhatsApp QR and Mystira authentication without printing or exporting session values.
- Authentic checks use one worker, zero retries, and no trace, screenshot, or video capture.
- Authentic sending is disabled unless the operator supplies the acceptance flag, dedicated chat label, send flag, and exact one-intake confirmation phrase.

The commands and evidence boundary are documented in `docs/EXTENSION-PLAYWRIGHT-ACCEPTANCE.md`.

## Local validation

- Chrome extension Node tests: 148 passed, 0 failed.
- Credential-free Playwright extension fixtures: 4 passed, 0 failed.
- Authentic Playwright profile: 2 tests discovered and safely skipped without operator authorization.
- Chrome extension TypeScript and production package verification: passed; 13 expected ZIP entries verified.
- Frozen-lockfile offline install: passed.
- Clean forced monorepo build: 8/8 packages passed; the web build compiled 24 routes.

## Acceptance boundary

No authentic profile was provisioned in this phase, no production login was performed, and no WhatsApp capture was sent. The fixture API does not prove production persistence, restart durability, cross-user authorization, authenticated deletion, or authentic WhatsApp compatibility.

Those outcomes require the dedicated operator profile and explicit, staffed authorization described in the runbook. Session profile material must stay outside the repository and must never be uploaded as a CI artifact.
