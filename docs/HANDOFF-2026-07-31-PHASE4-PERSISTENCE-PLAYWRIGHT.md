# Phase 4 persistence and Playwright handoff

Date: 2026-07-31

## Outcome

This slice closes the repository implementation gaps found during the Phase 4/9 live audit:

- extension and manual-upload intakes retain their first accepted raw source in the configured private artifact store alongside normalized PostgreSQL messages;
- artifact keys are owner-scoped without exposing the Mystira user id, and the database records SHA-256, size, and storage status;
- production Blob requests use the Container Apps managed identity already granted `Storage Blob Data Contributor` rather than a disabled shared key;
- duplicate submissions retain the original immutable raw evidence instead of creating orphan artifacts;
- authenticated deletion removes the raw artifact before deleting the owner-scoped database record;
- legacy normalized-only rows are explicitly marked `not-recorded` rather than appearing indefinitely pending;
- selector reports are bounded and persisted in PostgreSQL, while report reads and selector updates require an authenticated admin;
- the dashboard and conversation detail expose raw-source persistence state;
- a headed Playwright fixture runs the actual built API and production extension through send, raw/normalized persistence, duplicate submission, API restart, cross-owner denial, and deletion.

## Commands

```powershell
pnpm --filter @convolens/api run test -- --runInBand --runTestsByPath src/services/__tests__/conversation-intake.service.test.ts src/services/__tests__/selector-report.service.test.ts src/services/__tests__/storage-managed-identity.test.ts src/db/migrations/__tests__/conversation-intake.migration.test.ts src/routes/__tests__/chat-export.routes.test.ts src/routes/__tests__/extension.routes.test.ts
pnpm --filter @convolens/chrome-extension test:browser:persistence
pnpm --filter @convolens/chrome-extension test:browser:fixtures
pnpm run build
```

## Acceptance boundary

This repository fixture is synthetic and credential-free. Until the merged code is deployed and the dedicated operator profile completes the staffed acceptance matrix, it does not prove production Blob persistence, authentic WhatsApp compatibility, production restart durability, or legitimate cross-user behavior.

Phase 9 remains dependent on the unimplemented candidate-review and approval-gated idempotent Baton publication path represented by the open Phase 5/6 tasks. No Baton write, production deployment, or authentic WhatsApp send is performed by this slice.
