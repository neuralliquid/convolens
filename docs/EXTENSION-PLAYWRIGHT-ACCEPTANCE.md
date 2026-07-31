# Extension Playwright acceptance

The extension has two intentionally separate Playwright surfaces. Neither surface silently reuses a normal Chrome profile.

## Credential-free fixture suite

`pnpm --filter @convolens/chrome-extension test:browser:fixtures` builds and loads the production extension in Playwright's bundled Chromium. Navigation to `web.whatsapp.com` is fulfilled from a synthetic, non-PII fixture and the intake API is a local deterministic recorder.

This suite proves browser injection, explicit review before send, request shape and tracing headers, repeated-capture duplicate rendering, account-change invalidation, page console capture, and service-worker target attribution. It does not prove production authentication, persistence, restart durability, cross-user authorization, deletion, or authentic WhatsApp compatibility.

CI installs the pinned Chromium build and runs this headed MV3 suite under `xvfb-run`. Fixture traces and screenshots contain synthetic data only.

## Durable persistence fixture

`pnpm --filter @convolens/chrome-extension test:browser:persistence` runs the real built API with a temporary SQLite database and local artifact store, then drives the production extension in bundled Chromium. It proves reviewed send, normalized-message and integrity-addressed raw-artifact persistence, deterministic duplicate handling, API-process restart durability, owner isolation, and authenticated deletion of both the database row and raw artifact.

The fixture uses synthetic JWTs and WhatsApp content inside a temporary directory. It does not contact production and cannot replace the staffed authentic run.

## Dedicated operator profile

Install Chromium once with `pnpm exec playwright install chromium`, then choose an absolute profile path outside the repository:

```powershell
$env:CONVOLENS_PW_PROFILE_DIR="$env:LOCALAPPDATA\ConvoLens\Playwright\acceptance-profile"
pnpm --filter @convolens/chrome-extension auth:provision
```

The visible browser opens WhatsApp Web and the ConvoLens login. The operator completes WhatsApp QR and Mystira authentication. The provisioner verifies only authenticated state; it does not print or export cookies or tokens.

Run the read-only authentic check with:

```powershell
$env:CONVOLENS_AUTHENTIC_ACCEPTANCE="1"
pnpm --filter @convolens/chrome-extension test:browser:auth
```

Authentic sending is fail-closed and needs all of these values:

```powershell
$env:CONVOLENS_ALLOW_SEND="1"
$env:CONVOLENS_SEND_CONFIRMATION="I authorize one ConvoLens intake"
$env:CONVOLENS_TEST_CHAT="Dedicated test chat label"
$env:CONVOLENS_TEST_CHAT_JID="whatsapp:stable-test-chat-jid"
pnpm --filter @convolens/chrome-extension test:browser:auth
```

The chat label must match exactly one chat-list row. Before confirmation, the runner focuses that exact WhatsApp tab and requires both the active header and the reviewed payload's stable conversation ID to match the allowlist.

The profile contains sensitive session material. Keep it outside the repository, never upload it as a CI artifact, and do not use a normal personal Chrome profile. Authentic runs force one worker, zero retries, and disable traces, screenshots, and video.

## Evidence boundary

Fixture success is repository evidence only. The read-only authentic test proves session validity and browser injection only. A staffed, explicitly authorized send is required for connected intake, and separate legitimate API/dashboard checks remain required for exact persistence, restart durability, cross-user isolation, and authenticated deletion.
