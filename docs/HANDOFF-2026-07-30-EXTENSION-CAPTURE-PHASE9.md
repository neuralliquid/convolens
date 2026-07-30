# Extension Capture Phase 9 Handoff

Date: 2026-07-30

## Outcome

Phase 9 hardens the repository-owned release path for extension 1.0.20. CI now runs the complete extension Node suite, focused API conversation-intake tests, production packaging, and deterministic ZIP inspection after the monorepo build.

The release matrix is recorded in `docs/EXTENSION-CAPTURE-PHASE9-RELEASE-MATRIX.md`. The inspector validates aligned package/manifest versions and exactly 13 expected archive entries by local header, decompression, payload size, and CRC, with no duplicate or unsafe paths.

## Validation to record on the exact PR head

- Chrome extension Node tests: 140 passed, 0 failed.
- Chrome extension TypeScript and popup syntax: passed.
- Focused API conversation-intake service tests: 29 passed, 0 failed.
- Production package and ZIP inspection: passed; 13 expected entries validated by local header, decompression, payload size, and CRC, with no duplicate or unsafe paths.
- Clean uncached monorepo build: 8/8 packages passed; the web build compiled 24 routes.
- ZIP SHA-256: `A6C876CEA1A1F454A682E0651422AACDCB3CDF4048406EB4408D914E5352D696`.
- GitHub CI and exact-head review: pending.

## Acceptance boundary

No deployment or authentic WhatsApp acceptance is claimed. The authorized 12-step operator matrix was not executed. Connected send, exact persisted counts, deduplication, approved API restart persistence, cross-user isolation, authenticated deletion, and console attribution remain operator-held.

The broader production go-live Baton work remains open because its infrastructure, DNS, deployment, and full WhatsApp-to-Baton acceptance scope was not authorized or performed by this repository phase.
