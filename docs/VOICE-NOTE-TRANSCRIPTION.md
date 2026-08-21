# Voice-note transcription

Status: **implemented behind a disabled-by-default production gate**.

ConvoLens supports the WhatsApp export formats it already parses and recognizes attached-file
markers such as `<attached: ...opus>` and `...ogg (file attached)`. A signed-in user can select
the matching exported audio file for an audio message and explicitly consent to transcription.

## Processing path

`ConvoLens -> xtox -> Sluice -> Azure AI Foundry Whisper -> xtox -> ConvoLens`

- ConvoLens verifies that the conversation and audio message belong to the signed-in user before
  making any external request.
- The current Mystira user token is passed to xtox for its own authorization. ConvoLens's internal
  API JWT is never reused as an xtox credential.
- ConvoLens holds the uploaded audio in request memory only. It is not written to ConvoLens raw
  artifact storage, the database, logs, metrics, or traces.
- Operational logs contain only bounded error codes. They do not include filenames, audio,
  transcript text, provider response bodies, or bearer tokens.
- The transcript is stored as a sibling `message_transcripts` record. It is deliberately excluded
  from all conversation content hashes and deduplication identity.

## Consent, retention, and deletion

- Consent is per voice note. The UI names every processor before enabling the action, and the API
  rejects requests without `modelProcessingConsent=true`.
- xtox must process the request with `retain=false`. ConvoLens refuses to send audio unless the
  deployed xtox non-retaining contract has been verified and
  `XTOX_EPHEMERAL_TRANSCRIPTION_VERIFIED=true` is set.
- The returned transcript remains in ConvoLens until it is replaced or the owning conversation is
  deleted. Deleting the conversation cascades to its transcript rows.
- The raw audio is not recoverable from ConvoLens after the request completes. Database backup
  expiry and Azure AI Foundry's tenant data-processing terms remain part of the release privacy
  approval; this feature must stay disabled until those statements match the deployed environment.

## Production activation gates

All gates are required. A merge or healthy endpoint is not sufficient.

1. xtox's production image is healthy and includes the audio implementation.
2. A legitimate Mystira user token from the ConvoLens flow is accepted by xtox with the intended
   audience/scope checks.
3. xtox's `retain=false` behavior is deployed and proves no MongoDB transcript row is created.
4. xtox calls its real configured Sluice hostname, and a representative consented audio request
   reaches Azure AI Foundry and returns a transcript.
5. `XTOX_BASE_URL`, `FEATURE_VOICE_TRANSCRIPTION=true`, and
   `XTOX_EPHEMERAL_TRANSCRIPTION_VERIFIED=true` are deployed to ConvoLens only after gates 1-4.
6. An authenticated ConvoLens user completes the UI flow; deletion removes the transcript from the
   primary ConvoLens database, and evidence contains no conversation content or credentials.

Until then, the UI can render stored transcript state in development, but the API returns a
privacy-safe `503` before transmitting audio.
