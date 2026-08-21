# ADR 0003: Split media tone analysis across ConvoLens, xtox, and Sluice

**Status:** Accepted  
**Date:** 2026-08-21  
**Deciders:** product owner, ConvoLens repository owner, xtox/Sluice coordination  
**Consulted:** PRD-001, voice-note transcription contract, Baton `3d7873a0`  
**Informed:** xtox (`bb280705`), Sluice (`802c9807`)

Canonical product contract: [`../prd/PRD-001-media-tone-inclination-emotion.md`](../prd/PRD-001-media-tone-inclination-emotion.md)

Technical spec: [`../specs/SPEC-001-media-tone-inclination-emotion.md`](../specs/SPEC-001-media-tone-inclination-emotion.md)

Baton: `3d7873a0-8ffb-45ad-a285-9a2af9f7647e`

## Context

Voice-note transcription already chose a path:

`ConvoLens → xtox → Sluice → Azure AI Foundry Whisper → xtox → ConvoLens`

PRD-001 adds acoustic tone, conversational inclination, and experimental emotion indicators on the same media. The open questions were where DSP lives, whether video is visual, which sentiment-class processors to use instead of Azure Language (retiring 2029), and whether Semantic Kernel / Foundry agents belong in v1.

Baton decisions D1–D4 on `3d7873a0` are resolved and are binding for this ADR.

## Decision

### 1. Keep the transcription spine. Do not add a ConvoLens → Foundry path.

ConvoLens never holds model credentials for Whisper, wav2vec2, Content Understanding, or stance LLMs. It passes a Mystira user token to xtox. xtox calls Sluice with a virtual key and ADR-17 metadata. Direct ConvoLens → Foundry was already rejected on transcription (`1e50aef3` decision `2b081d2d`) and is not reopened.

### 2. Three-repo split (D3)

| Repo | Owns | Emits |
| --- | --- | --- |
| **ConvoLens** | Consent, quotas, flags, product mapping, UI copy, aggregation, deletion, claims | Sibling analysis rows, chips, sparklines |
| **xtox** | Generic conversions: transcode, DSP, later video demux, optional SER wrap | Physical metrics and optional model labels. No `emotionIndicator` / `inclination` field names |
| **Sluice** | Whisper, later wav2vec2 and Content Understanding aliases, later stance JSON completion, cost | Provider-neutral model IO |

xtox `retain=false` is mandatory for ConvoLens callers, matching transcription. ConvoLens stores derived structured objects only. Raw audio stays in request memory.

### 3. Code vs model vs LLM

Run it in code unless a model is the only honest producer of the output.

- **Code (Phase 1, unblocked):** xtox DSP — duration, RMS, pause ratio, F0 mean/range/slope, quality gates. ConvoLens within-intake z-scores and charts. Useful with every model off.
- **Speech models (Phase 3 spikes):** wav2vec2 SER and Content Understanding custom audio analyzer, both via Sluice. Default off. Private-preview alpha may enable (D1).
- **LLM (Phase 2):** schema-constrained stance over **transcript + acoustic object**. Never raw audio to an LLM.

Azure Speech is STT and timestamps only. Pronunciation-assessment prosody is not tone. Speaker Recognition is out.

### 4. Serialization (D3)

xtox acoustic conversion has one object model and two encodings:

- `format=json` — HTTP default
- `format=yaml` — same schema, for local/debug/agent-readable dumps

ConvoLens persists the structured object (JSON column), not a format-specific blob.

### 5. Video (D2)

v1 video is soundtrack-only. xtox demuxes audio after acoustic DSP works, **not in the same PR as DSP**. No keyframes, faces, scene affect, or GPT-4o-on-a-frame. UI copy: “Analyzed soundtrack of this video (no visual analysis).”

### 6. Experimental affect processors (D1, D4)

- D1: experimental, opt-in, default off, pull-able without a migration. Enable-able for the current private-preview / invite-only alpha. Not a public-launch claim. Prefer dimensional or remapped cues. Never categorical angry/sad/happy on the default surface.
- D4: **spike both**. wav2vec2 SER first (license-checked; prefer valence/arousal/dominance). Content Understanding custom analyzer second (schema + future soundtrack path). Compare cost, latency, and claim-safety on the same fixtures before naming a Sluice default alias.
- **audeering** wav2vec2 weights are CC-BY-NC-SA / research-only and must not ship on a commercial path.
- Content Understanding: custom schema only. No prebuilt call-center sentiment. No visual fields. GA `2025-11-01` if taken past preview; `2026-06-01-preview` is not a production gate.
- Azure Language sentiment is not adopted.

### 7. Explicit non-runtimes for v1

Semantic Kernel, Foundry Agent Service / hosted agents, and Cognitive Mesh are **out of v1**. This is a request-response conversion, not a multi-tool agent. Revisit SK/agents only if a later ADR shows ≥3 tools with policy branching.

Azure Face, Video Indexer, Speaker Recognition, Hume, and AssemblyAI are out.

## Considered options

### A. All processing inside ConvoLens

Rejected. Would put FFmpeg, DSP, and model credentials in the product repo, duplicate xtox, and reopen the direct-Foundry decision.

### B. ConvoLens → Sluice, skip xtox

Rejected for the same reason transcription was not done this way. xtox is the conversion boundary and the `retain=false` evidence point.

### C. Semantic Kernel or Foundry hosted agents as the pipeline

Rejected for v1. Extra runtime, extra identity, no user-visible gain over Express → xtox → Sluice.

### D. Azure Language sentiment for “emotion”

Rejected. Text-only, retires 31 Mar 2029, contact-center copy, misses delivery.

### E. JSON-only acoustic output

Rejected as the sole encoding. JSON remains the HTTP default; YAML is a configurable twin of the same schema.

## Consequences

- Phase 1 DSP can proceed after SPEC-001 without Whisper being production-live, but still needs the xtox non-retaining evidence gate before ConvoLens sends audio.
- xtox (`bb280705`) implements `audio → features` with `format=json|yaml` and later soundtrack demux.
- Sluice (`802c9807`) plans **two** experimental aliases (wav2vec2 and Content Understanding) plus a later stance completion alias. No Language-sentiment alias.
- Product copy, eval fixtures, and a written privacy note remain gates on Phase 3 even in private preview.
- Implementation PRs that fuse DSP, SER, and video demux, or that send raw audio to an LLM, violate this ADR.

## Follow-on

SPEC-001 is the implementable contract. This ADR does not enable production flags.
