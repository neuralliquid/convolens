# Authentic intake PostgreSQL blocker handoff

Date: 2026-08-01

## Outcome

The operator legitimately reauthenticated the dedicated external profile and the read-only authentic readiness test passed against extension `1.0.21`. The operator then supplied the fresh exact phrase `I authorize one ConvoLens intake` and authorized any visible chat.

The guarded runner selected one chat ephemerally, established and rechecked its stable WhatsApp JID, reviewed 11 loaded messages, and clicked confirmation exactly once. It did not log the chat label, JID, participants, or message content.

No intake was persisted. Production returned an error and no receipt exists, so duplicate, restart, isolation, deletion, candidate, and Baton-publication acceptance remain unstarted.

## Production evidence

Azure Container App `nl-prod-convolens-api` was running and ready on revision `nl-prod-convolens-api--0000042`. Redacted logs showed one logical upload correlation at `2026-08-01T20:02:12Z`. The extension's network helper issued two HTTP attempts under that correlation. Both reached the API and both failed before persistence with PostgreSQL SQLSTATE `22021`:

```text
invalid byte sequence for encoding "UTF8": 0x00
SELECT pg_advisory_xact_lock(hashtextextended($1, 0))
```

The failure occurred when the NUL-delimited local compatibility-lock key was passed as a PostgreSQL text parameter. No production receipt, raw artifact, duplicate result, or candidate was created. The one-intake authorization is exhausted; do not retry it.

## Bounded fix

Draft PR `#170` carries the hotfix from branch `agent/postgres-advisory-lock-key` (initial implementation commit `56e4997aacf046463fd1b5a690b106840f4965ef`). The hotfix:

- retains the NUL-delimited key for collision-safe in-process queueing;
- SHA-256 encodes that key to deterministic 64-character hexadecimal text before the PostgreSQL advisory-lock query;
- adds a regression proving the database key is deterministic and contains no NUL;
- changes the extension network helper to one attempt per explicit confirmation;
- bumps the extension to `1.0.22` and updates release-version assertions.

Credential-free validation passed:

- focused conversation-intake suite: 49/49;
- extension unit/release suite: 153/153;
- headed browser fixtures: 7/7;
- full workspace build: 8/8 packages;
- inspected extension package: 14 expected ZIP payloads with matching sizes and CRCs.

## Next gates

1. Review and merge the hotfix only after exact-head CI and thread-aware review pass.
2. Deploy the exact merge commit through the governed production workflow and verify build identity, readiness, and the PostgreSQL fix in that revision.
3. Reprovision the dedicated profile with the exact deployed extension build.
4. Obtain a new exact one-intake authorization; the authorization recorded here cannot be reused.
5. Run one single-attempt authentic intake. Only after a receipt exists may the remaining duplicate, restart, isolation, deletion, candidate-review, and exactly-one Baton-publication gates proceed under their own authority boundaries.

Do not record cookies, tokens, chat content, participant names, message text, the chat label, or the WhatsApp JID. Production restart, deletion, and Baton publication remain separate external-effect gates.
