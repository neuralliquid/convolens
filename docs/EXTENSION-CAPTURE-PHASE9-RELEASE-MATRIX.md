# Extension Capture Phase 9 Release Matrix

Date: 2026-07-30

This matrix consolidates repository-owned automated evidence. It is not a record of deployment or authentic WhatsApp acceptance.

| Planned surface                                          | Repository evidence                                                                                                                                  | Status                     |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| Popup and launcher initiation                            | `phase3-operation-state.test.ts`, `phase4-launcher.test.ts`, `phase5-preview.test.ts`                                                                | Automated                  |
| Operation terminal states                                | `phase3-operation-state.test.ts`, `phase8-operational-actions.test.ts`                                                                               | Automated                  |
| Loaded, guided, and automatic collection                 | `phase1-capture-safety.test.ts`, `phase6-guided-lifecycle.test.ts`, `phase7-automatic-lifecycle.test.ts`                                             | Automated                  |
| Virtual overlap and repeated messages                    | `guided-capture.test.ts`, `virtualized-capture-fixture.test.ts`                                                                                      | Automated fixtures         |
| Direct/group conversations and sender direction/identity | `phase2-fidelity.test.ts`, `whatsapp-identity.test.ts`, `whatsapp-metadata.test.ts`                                                                  | Automated fixtures         |
| Localized timestamps                                     | `automatic-capture.test.ts`, `whatsapp-metadata.test.ts`                                                                                             | Automated fixtures         |
| Media, captions, unreadable accounting                   | `media-evidence.test.ts`, `phase2-fidelity.test.ts`, `phase5-preview.test.ts`                                                                        | Automated fixtures         |
| Name/phone/unidentified projection                       | `whatsapp-identity.test.ts`, focused API intake tests                                                                                                | Automated fixtures         |
| Cancellation, navigation, popup/tab loss, restart        | `phase3-operation-state.test.ts`, `phase6-guided-lifecycle.test.ts`, `phase7-automatic-lifecycle.test.ts`, `phase8-operational-actions.test.ts`      | Automated lifecycle models |
| Legacy migration, in-memory retry, recapture-required    | `phase1-capture-safety.test.ts`, `phase8-operational-actions.test.ts`                                                                                | Automated                  |
| API new/duplicate and user isolation                     | `conversation-intake.service.test.ts`                                                                                                                | Automated                  |
| Messaging-channel teardown                               | `phase1-capture-safety.test.ts`, `popup-runtime.test.ts`                                                                                             | Automated                  |
| Preload warning attribution                              | No browser performance trace was run; source scanning cannot prove absence across JSX, React APIs, native DOM APIs, CommonJS, aliases, and fixtures | Operator-held runtime evidence |
| Web performance baseline                                 | Clean production build compiles 24 routes; no browser performance trace was run                                                                      | Build evidence only        |
| Tests, typecheck, build, package, version, ZIP           | CI plus `verify-package.mjs` validates aligned 1.0.20 metadata and exactly 13 safe ZIP entries by local header, decompression, payload size, and CRC | Automated                  |

## Operator-held authentic acceptance

The 12-step authorized long-conversation matrix in `EXTENSION-CAPTURE-EXPERIENCE-PLAN.md` has not been executed in this phase. In particular, repository evidence does not prove connected send, exact persistence, deterministic deduplication, persistence after an approved API restart, cross-user isolation, authenticated deletion, or console attribution in an authentic user session.

Packaging, CI, fixture tests, build output, and ZIP inspection must not be used as substitutes for that operator gate.
