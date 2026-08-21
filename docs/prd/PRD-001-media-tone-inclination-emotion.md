# PRD-001: Media tone, inclination, and emotion-indicator analysis

**Status:** Draft — planning, not implementation  
**Date:** 2026-08-21  
**Product:** ConvoLens  
**Canonical Baton task:** `3d7873a0-8ffb-45ad-a285-9a2af9f7647e`  
**Related Baton tasks:**
- ConvoLens voice-note transcription (prerequisite): `1e50aef3-8668-4f2d-a5e7-ee7e66fd6ba7`
- xtox non-retaining transcription: `0de04c4f-9345-4fe3-9831-b891d6942e8f`
- xtox acoustic-feature conversion (blocked on this planning task): `bb280705-7667-4202-bebb-feb8e85ce97c`
- Sluice model aliases (blocked on this planning task): `802c9807-2c7c-4164-84b5-218a07675baf`
- Sluice transcription metadata channel: `95127b7b-830e-4bc9-a3c8-322c2d14d666`

**Follow-on docs:**
- ADR-0003 (accepted): [`../adr/0003-media-tone-split-and-processors.md`](../adr/0003-media-tone-split-and-processors.md)
- SPEC-001: [`../specs/SPEC-001-media-tone-inclination-emotion.md`](../specs/SPEC-001-media-tone-inclination-emotion.md)

This PRD is the ConvoLens product contract. It does not authorize production flags or public claims. Phase 1 DSP may proceed against ADR-0003 and SPEC-001.

---

## 1. Why this exists

Voice notes already carry information that a WhatsApp `.txt` export throws away: how something was said, not only which words were attached as `<attached: …opus>`. Users who import a chat to “see the conversation clearly” currently get a media label and, if the gated transcription path is later activated, a transcript. They do not get delivery, stance, or affect cues.

That gap is real. Closing it badly is worse than leaving it closed. Speech-emotion and “inclination” products routinely over-claim (diagnosing mood, personality, relationship health). ConvoLens product constraints forbid relationship, psychological, and diagnostic claims. This feature must therefore be designed as **bounded, sourced, confidence-aware indicators** that sit on top of deterministic analytics — not as a mood ring.

The voice-note transcription path is already the right spine:

`ConvoLens → xtox → Sluice → Azure AI Foundry Whisper → xtox → ConvoLens`

Tone and inclination should reuse that spine. They should not open a second, product-local path to a model.

---

## 2. Vocabulary (normative)

Do not collapse these three layers. UI copy, storage, and model prompts must keep them distinct.

| Term | Meaning in ConvoLens | Source of truth | Claim class |
| --- | --- | --- | --- |
| **Acoustic tone** | How the *signal* sounds: energy, pitch range, speaking rate, pause ratio, rising vs falling intonation. | Deterministic DSP on the audio (code). | Implemented candidate. Observational. |
| **Conversational inclination** | Stance of *this message toward its content*: question, request, agreement, hedge, emphasis, continuation. Not a life inclination, political lean, or psychological drive. | Transcript text + optional acoustic features, schema-constrained classifier. | Planned. Interpretive, bounded. |
| **Emotion indicator** | A low-confidence *affect cue* suggested for a message (for example “higher energy than this speaker’s median in this thread”). Never a diagnosis, never a person-level trait. | Experimental processor (wav2vec2 SER and/or Content Understanding — see §9.5), plus acoustic proxies. | **D1 resolved:** experimental, opt-in, default off. May be enabled for the current private-preview / invite-only alpha and pulled if copy, eval, or legal review fails. Not a public-launch claim. |

**Inclination is not emotion.** Rising pitch is an acoustic fact. “This sounds like a question” is a stance guess. “This person is anxious” is forbidden.

**Tone is not sentiment.** Text sentiment of a transcript (words) and acoustic tone (voice) can disagree. Sarcasm is the usual example. The product must be able to show both, or show neither, without forcing a fused “true mood.”

Forbidden phrasings in UI, docs, marketing, and model output:

- angry, depressed, narcissistic, toxic, abusive, attached, avoidant, in love, lying
- any DSM-style or workplace-psych label
- any claim about a relationship, a person’s character, or a child’s wellbeing
- speaker identification or “this is the same voice as…”

Allowed phrasings:

- “Higher loudness than other voice notes in this chat”
- “Speaking rate above this message’s transcript median”
- “Rising pitch toward the end of the clip (question-like intonation)”
- “Possible affect cue from voice (experimental, not a diagnosis)” — private-preview alpha only; never categorical angry/sad/happy on the default surface

---

## 3. Problem statement

### 3.1 User problem

A signed-in user imports a WhatsApp export that includes voice notes (and, later, video notes). They can already see that a message is audio. They cannot:

1. hear *how* it was delivered without playing the original file they still hold locally;
2. scan a long thread for delivery shifts (quieter, faster, more pauses) the way they can scan text volume;
3. include voice notes in deterministic analytics except as a media count;
4. (once transcription is live) reconcile a calm transcript with an urgent delivery, or the reverse.

### 3.2 Product problem

Deterministic analytics are a ConvoLens differentiator: they must remain useful without an LLM. Voice notes currently contribute almost nothing to those analytics. If we only send audio to an LLM and ask for “emotion,” we:

- spend money on every clip;
- create unverifiable claims;
- log or retain content in the wrong places;
- skip the cheaper, more honest acoustic layer.

### 3.3 Constraint problem

The same privacy, retention, and production-gate contract that blocks transcription from going live also blocks this feature. Raw audio must not land in ConvoLens storage, logs, metrics, or traces. xtox must process with `retain=false` after that contract is verified. Processors must be named in the consent UI before any byte leaves ConvoLens.

---

## 4. Goals

1. Give voice-note messages a **deterministic acoustic-tone profile** that is useful even when every model is off.
2. Give those messages a **bounded conversational-inclination label** derived primarily from the transcript, optionally conditioned on acoustic features.
3. Expose **experimental emotion indicators** as opt-in, default-off, low-confidence, non-diagnostic cues with an explicit unknown state. Private-preview alpha may enable the flag; it must be pull-able (D1).
4. Keep the existing ownership split: ConvoLens owns product meaning; xtox owns generic media conversion; Sluice owns model routing and cost attribution.
5. Treat **video as audio-first**: extract the soundtrack, run the same pipeline, defer visual models.
6. Reuse transcription consent, quotas, deletion, and production gates rather than inventing a parallel privacy regime.
7. Make every output **sourced** (acoustic | transcript | model-cue), **versioned**, and **deletable** with the conversation.

---

## 5. Non-goals (v1)

- Relationship, personality, deception, or mental-health inference.
- Speaker identification, voiceprints, or cross-chat voice matching (biometric).
- Facial emotion, gaze, or “body language” from video.
- Live / streaming analysis of WhatsApp Web audio.
- DOM capture of decrypted media (still deferred on task `1e50aef3`; v1 stays on export-with-media files).
- Replacing transcripts; this feature does not substitute for words.
- Sending raw audio to an LLM.
- Putting Azure model credentials, FFmpeg, or DSP libraries inside ConvoLens.
- Semantic Kernel, Cognitive Mesh, or Foundry Agent Service as the runtime for v1.
- New messaging platforms. WhatsApp export remains the only supported format.
- Children-specific analysis. If the export appears to include a minor, do not run experimental affect models (see §12).
- Marketing copy that says ConvoLens “detects emotion in your chats” as a launched capability.

---

## 6. Personas and jobs

| Persona | Job to be done | What they must not get |
| --- | --- | --- |
| Individual reviewing their own export | Scan voice notes the way they scan text: volume, timing, delivery | A verdict about the other person |
| Small team using ConvoLens as selected-conversation memory (alpha positioning) | Include voice notes in thread summaries without re-listening to every clip | Contact-center “sentiment score” of a colleague |
| Privacy-conscious user | See every processor named, refuse the extra step, still keep deterministic text analytics | Silent model submission of voice |

This is not a call-center product. Azure Content Understanding / speech analytics for contact centers is a **later, explicit** option, not the default architecture.

---

## 7. Current state (2026-08-21)

### Implemented

- WhatsApp text export parsing, including `<attached: …opus>` / `…ogg (file attached)` markers.
- Extension media classification that prefers video over image thumbnails; audio messages labeled `audio`.
- Per-message transcription UI and API, gated off in production (`FEATURE_VOICE_TRANSCRIPTION`, `XTOX_EPHEMERAL_TRANSCRIPTION_VERIFIED`). Contract: `docs/VOICE-NOTE-TRANSCRIPTION.md`.
- Sibling `message_transcripts` row, excluded from content hashes, cascaded on conversation delete.
- Path: ConvoLens calls xtox `POST /api/transcribe-audio?retain=false`, never Sluice directly.

### In progress / blocked

- Production transcription gates (xtox auth, non-retaining mode, Sluice `/v1/audio/transcriptions`, Foundry Whisper).
- DOM vs export-file capture of voice audio (deferred).

### Missing

- Acoustic features.
- Inclination / stance.
- Emotion indicators.
- Video soundtrack extraction.
- Conversation-level aggregation of voice delivery.
- Privacy-notice language for affect processing.
- Evaluation set for acoustic + stance outputs.

---

## 8. Where the functionality sits

### 8.1 Recommended split

This split is accepted in ADR-0003 (D3).

```text
User (export file, per-message consent)
        │
        ▼
┌─────────────────────────────────────┐
│ ConvoLens                           │
│  auth, ownership, consent, quotas   │
│  hold audio in request memory only  │
│  store derived JSON, not bytes      │
│  aggregate, render, delete, claims  │
└──────────────┬──────────────────────┘
               │ Mystira user token
               │ retain=false
               ▼
┌─────────────────────────────────────┐
│ xtox                                │
│  transcode (existing)               │
│  audio → acoustic feature JSON      │
│  video → extracted audio (later)    │
│  optional: call Sluice STT / SER    │
│  no ConvoLens ontology              │
└──────────────┬──────────────────────┘
               │ virtual key + ADR-17
               ▼
┌─────────────────────────────────────┐
│ Sluice                              │
│  /v1/audio/transcriptions (Whisper) │
│  later: SER alias (wav2vec2 / CU)   │
│  later: JSON stance completion      │
│  no product copy, no content logs   │
└──────────────┬──────────────────────┘
               ▼
     Azure AI Foundry models
```

### 8.2 ConvoLens owns

- Feature flags and production evidence gates (mirror transcription).
- Consent copy that names **every** processor: xtox, Sluice, Foundry Whisper, and any later SER or LLM alias.
- `message_media_analyses` sibling rows: acoustic profile, inclination, optional cue, model versions, consent timestamp (SPEC-001).
- Conversation-level rollups: median energy, rate, pause ratio per participant **in this intake**, not a personality score.
- UI: per-message chips, thread sparkline of acoustic tone, explicit unknown/failed states.
- Claim language, privacy notice, export of derived features, deletion cascade.
- Bounded narrative: if a summary mentions delivery, it must cite the stored features, not invent affect.
- Refusal to run when transcription gates are not green, unless the user asked for **acoustic-only** (no model) and xtox DSP is available without Sluice.

Acoustic-only is important: it keeps the ConvoLens rule “deterministic analytics useful without an LLM.”

### 8.3 xtox owns

xtox is the ecosystem conversion service (audio → audio, audio → text, and now audio → features). It already has Python transcode (`audio_converter.py` / `audio_service.py`) and Sluice-routed transcription (`transcription_service.py`). The TypeScript `@xtox/transcription-service` package is superseded and must not be revived.

New generic conversions:

| Conversion | Input | Output | Model? |
| --- | --- | --- | --- |
| Acoustic features | opus/ogg/mp3/wav/m4a/webm | versioned DSP metrics, **JSON default or YAML** (`format=json\|yaml`) | No |
| Video demux | mp4/webm | audio bytes (then same as above) | No |
| Optional SER wrap | audio | label document (same format switch) from Sluice | Yes, via Sluice |

**D3 resolved:** extraction lives in xtox with `retain=false`. Serialization is configurable: `audio → JSON` (HTTP default) or `audio → YAML` (same schema, for local/debug/agent-readable dumps). One object model; two encodings. ConvoLens persists the structured object, not a format-specific blob.

Rules:

- `retain=false` is mandatory for ConvoLens callers, same as transcription.
- No ConvoLens-specific field names (`emotionIndicator`, `inclination`) inside xtox. Emit physical metrics (`f0_slope_hz_per_s`, `rms_db`, `pause_ratio`). ConvoLens maps those into product language.
- No Mongo persistence of ConvoLens audio or derived documents when `retain=false`.
- Do not call Foundry with ConvoLens credentials; Sluice virtual keys only.

### 8.4 Sluice owns

- Whisper (or successor) via `POST /v1/audio/transcriptions`.
- Virtual keys, ADR-17 metadata, Docket cost events.
- Later aliases, named in ADR-0003 / SPEC-001:
  - `convolens-stance-v1` — schema-constrained stance JSON taking **transcript + feature object**, never raw audio;
  - `convolens-wav2vec2-affect-v1` and `convolens-cu-audio-v1` — experimental SER spikes (D4).

Sluice does not own “what anger means in a WhatsApp family chat.”

### 8.5 Explicitly not in v1

| System | Why not |
| --- | --- |
| **Semantic Kernel** | Lives in Cognitive Mesh as an optional agent framework. ConvoLens v1 is an Express + Next pipeline with one conversion hop. SK adds plugins, planners, and another runtime for no user-visible gain. Reconsider only if the pipeline grows to several branching tools with retries. |
| **Foundry Agent Service / hosted agents** | Same reason. This is a request-response conversion, not a multi-step agent. |
| **Cognitive Mesh** | Wrong product boundary; would pull conversation content into a second platform. |
| **Azure Language sentiment** | Retires 31 Mar 2029; new work should not take that dependency. Text stance, if needed, goes through a Foundry model behind Sluice. |
| **Azure Face / visual emotion** | Limited Access, ethically out of scope, product-constraint violation. |
| **Speaker Recognition** | Biometric. Out. |
| **Direct ConvoLens → Foundry** | Already rejected for transcription (`1e50aef3` decision 2b081d2d). Do not reopen. |
| **Hume, AssemblyAI, etc.** | Extra processors, extra consent, extra data-processing terms. Stay on the existing Azure/Foundry path unless a later ADR proves a gap Foundry cannot fill. |

---

## 9. Code vs model vs LLM

Default: **run it in code unless a model is the only honest way to produce the output.**

### 9.1 Run in code (xtox DSP, ConvoLens aggregation)

These are cheap, deterministic, testable, and useful with models fully off.

- Decode, duration, sample rate, clipping/quality gates (too short, too silent, not audio).
- RMS / approximate loudness, peak, dynamic range.
- Silence / pause ratio.
- Speaking-time ratio.
- Fundamental frequency (F0) mean, range, and **slope** (acoustic inclination: rising vs falling intonation).
- Spectral centroid (brightness) as an optional extra, not shown until we know it helps.
- Per-thread z-scores: this clip vs other clips from the same sender in this intake only.
- Counts and timelines in the dashboard.

Speaking rate: prefer **transcript word timestamps / duration**. If there is no transcript yet, omit rate rather than guessing from energy bursts.

### 9.2 Run through specialized speech models (Sluice → Foundry)

- Speech-to-text (already designed): words, language, duration, optional segments.
- Language identification if Whisper does not already return it.
- **Not** speaker diarization in v1 for 1:1 voice notes; revisit for group video notes later.
- Experimental SER (wav2vec2 and/or Content Understanding custom audio analyzer) as a labeled, default-off processor for private-preview alpha (D1).

Azure Speech in Foundry Tools today is STT, TTS, translation, speaker recognition, and pronunciation/prosody *assessment for learners*. There is still **no first-party “emotion API.”** That is why Language sentiment is not the replacement — wav2vec2 and Content Understanding are the things to spike. See §9.5.

### 9.3 Run through an LLM (Sluice, schema-constrained)

Input: transcript text + the acoustic JSON + a frozen label enum.  
Output: JSON `{ inclination, confidence, evidence_spans[], refused }`.  
Never: raw audio, images, or “how does this person feel about their partner.”

Use the LLM for:

- conversational inclination / stance over the **words**, optionally noting that acoustic slope is rising (question-like) when that feature is present;
- a bounded sentence in the existing summary flow that may *cite* stored features (“Voice note at 21:04 is louder than this sender’s median in this chat”).

Do not use the LLM for:

- inventing emotion labels the acoustic profile does not support;
- fusing text and voice into a single mood;
- any comparison of people (“A is colder than B”).

### 9.4 Decision table

| Output | v1 method | Fallback if that layer is off |
| --- | --- | --- |
| Duration, energy, pauses, F0 slope | Code | Hide the chip; keep media label |
| Transcript | Whisper via existing path | Acoustic-only still allowed |
| Speaking rate | Code on timestamps | Omit |
| Inclination (question / request / hedge / …) | LLM on transcript + features | Omit, or a tiny keyword heuristic on text marked `heuristic` |
| Emotion indicator | Experimental, default off; private-preview alpha may enable (D1) | Unknown; hide control always available |
| Video meaning | Audio track only | Same as audio |
| Thread narrative | Existing bounded summary, citing features | Deterministic charts only |

Text-only keyword heuristics for inclination (question mark, “please”, “maybe”) are allowed as a **deterministic, labeled** extra. They are not “AI.”

### 9.5 Alternatives to Azure Language sentiment

Do **not** take a new Azure Language sentiment / opinion-mining dependency. That feature retires 31 Mar 2029, it is text-only (so it misses delivery), and new work should sit on Foundry models behind Sluice.

What to explore instead, in order:

| Option | What it actually is | Why it is interesting | Why it is not a drop-in | Alpha use |
| --- | --- | --- | --- | --- |
| **DSP in xtox** (librosa / praat) | Code: energy, pauses, F0 slope | Cheap, deterministic, no emotion claim | Not “sentiment” | **Phase 1 default.** Always on when consented. |
| **wav2vec2 SER** | Fine-tuned speech encoder on the waveform. Foundry catalog has community checkpoints (e.g. `biancazycao-wav2vec2-base-speech-emotion-recognition`). Research models such as audeering’s dimensional wav2vec2 output valence / arousal / dominance. | Audio-native, complementary to transcript inclination; no extra LLM; fits xtox as `audio → label document`. Dimensional scores map to “energy / positivity cue” better than angry/sad. | Categorical labels (angry, happy, sad) are diagnostic-shaped and culturally biased. WhatsApp Opus is a poor match for studio-trained checkpoints. **audeering weights are CC-BY-NC-SA / research-only — not a commercial default.** License every Foundry catalog card before a flag goes true. English-heavy. | **Primary experimental spike** for private-preview alpha. Prefer dimensional (V/A/D) or remap categories to non-diagnostic bins (`higher-arousal`, `unknown`). Quality-gate first. |
| **Content Understanding (Foundry Tools)** | Schema-defined field extraction over audio and video. GA API `2025-11-01`; `2026-06-01-preview` is preview-only. Custom `classify` / `generate` fields (docs show a `Sentiment` field as an example). Also returns `transcriptPhrases` with speaker tags and, for video, keyframes / camera shots. Prebuilt call-center analyzers exist. | One analyzer can emit inclination enum + optional cue from a schema we control. Audio + video in the same product, which matches V1 soundtrack later. Confidence and grounding exist for some field types. | Generative — cost and claim-risk similar to an LLM. Prebuilt “call sentiment” is contact-center copy we must not ship. `transcriptPhrases[].speaker` is diarization, not identity, and must not be stored as a person. Keyframes/faces are **out** (V3 blocked). Heavier than a 15s voice note. Preview APIs are not a production gate. | **Second spike**, not a Phase 1 dependency. Custom schema only (`inclination`, optional `affect_cue`). No prebuilt call-center analyzer. No visual fields. |
| **Azure Speech (Foundry Tools)** | STT, TTS, translation, speaker recognition, pronunciation/prosody assessment for *learners*. Batch/call analytics historically leaned on Language sentiment. | Already on the Whisper path for words and timestamps. | Pronunciation-assessment “prosody” is a tutor score, not conversation affect. Speaker Recognition is biometric (out). No first-party emotion API. | **STT/timestamps only.** Do not wrap pronunciation assessment as tone. |
| **Schema-constrained Foundry LLM** | Transcript + acoustic JSON → inclination enum | Best fit for *conversational inclination* (speech acts over words) | Blind to raw acoustics unless we pass DSP; prompt-injection surface | **Phase 2** for inclination, not for emotion. |
| **emotion2vec / SpeechBrain / openSMILE eGeMAPS** | Open SER / GeMAPS feature sets | eGeMAPS is a published acoustic standard; could live next to DSP | Extra runtime and license surface; still not a sentiment API | Optional DSP-adjacent research; not a processor we name in consent until a spike says so. |

**Recommended alpha stack**

1. DSP JSON/YAML (always, if consented).
2. wav2vec2 spike for experimental affect cues (D1), dimensional if a licensed checkpoint exists, otherwise do not show categorical emotions.
3. Content Understanding custom audio analyzer as a parallel spike for schema + future video soundtrack — compare cost, latency, and claim-safety against wav2vec2 on the same fixtures.
4. Foundry JSON LLM for inclination after transcripts exist.
5. Never Language sentiment, Video Indexer, Face, or Speaker Recognition.

**D4 resolved:** spike both. wav2vec2 is the first experimental affect cue; Content Understanding custom audio analyzer is the second spike and the schema/video-shaped path. DSP is not blocked on either.

---

## 10. Video

WhatsApp video notes are already classified in the extension and shown as `Video`. They are in scope **as containers of audio**, not as a computer-vision product.

### Phase V0 — already done

Detect and label video messages. Do not download attachments in the extension capture path unless a later capture ADR says otherwise.

### Phase V1 — recommended with audio v1 or immediately after

xtox demux: video file → audio track → same acoustic (+ optional STT) pipeline. ConvoLens UI: “Analyzed soundtrack of this video (no visual analysis).”

### Phase V2 — planned, separate PRD

On-screen text / burnt-in captions via OCR (xtox already lists OCR as a high-priority generic library). Still no faces.

### Phase V3 — blocked

Facial affect, scene emotion, “who is on camera,” lip-sync identity. Azure Face Limited Access, biometrics, and ConvoLens claim rules all say no. Do not “just add GPT-4o vision on a frame.”

**D2 resolved:** V1 is soundtrack-only. Demux in xtox after acoustic audio works, not in the same pull request as DSP. No visual models.

---

## 11. Phased product requirements

Status key: **P** planned · **E** experimental · **B** blocked · **I** implemented (none of this feature is I yet).

### Phase 0 — Planning (this task)

- [x] Baton parent with PRD, ADR, tech spec required (`3d7873a0`)
- [x] This PRD
- [x] ADR-0003 (split, code vs model, SK/Foundry, JSON/YAML)
- [x] Technical spec (schema, flags, eval)
- [x] Resolve D1 (experimental, private-preview alpha, pull-able)
- [x] Resolve D2 (video soundtrack-only)
- [x] Resolve D3 (xtox DSP, JSON default / YAML configurable)
- [x] Resolve D4 (spike both wav2vec2 and Content Understanding)

### Phase 1 — Acoustic tone only (recommended first ship)

Depends on: xtox non-retaining processing verified; not on Whisper being live.

- Per consented audio message, ConvoLens sends bytes to xtox feature conversion (`retain=false`).
- Store versioned acoustic object beside the message (JSON on the wire by default); cascade delete.
- UI: three boring chips — loudness, pause ratio, intonation slope — plus “unknown” when quality fails.
- Thread view: sparkline of loudness over time for voice notes only.
- Deterministic analytics include voice-note delivery without any LLM.
- Same per-user hourly quota family as transcription, or a sibling limiter (`VOICE_NOTE_ANALYSES_PER_HOUR`).
- Telemetry: counts, latency, error codes. No features, no audio, no transcript.

Success: a user who refuses model processing can still see acoustic chips.

### Phase 2 — Inclination from transcript

Depends on: Phase 1 + production transcription gates.

- After a transcript exists, ConvoLens (or xtox on ConvoLens’s behalf) calls a Sluice JSON alias with transcript + acoustic JSON.
- Store inclination enum + confidence + evidence spans.
- UI: a second chip, visually distinct from acoustic tone (“stance: request”, not “emotion: needy”).
- Summary prompt may cite inclination and acoustic chips; it may not upgrade them to feelings.

### Phase 3 — Emotion indicators (D1: experimental for private-preview alpha)

- Separate consent checkbox: “Experimental voice affect cue (not a diagnosis).”
- Default off. Unknown is the default display. Alpha operators may enable the flag; it must be pull-able without a migration (hide chips, keep stored rows until delete).
- Prefer dimensional or remapped cues over categorical angry/sad/happy.
- Never shown on public screenshots, marketing, or funding evidence without the Evidence auditor.
- Evaluation set and error analysis required before the flag may go true even in private preview.
- Processor choice is D4: spike both; DSP does not wait on either.

### Phase 4 — Video soundtrack

- xtox demux + Phase 1/2 on the extracted audio.
- Explicit UI that vision was not used.

---

## 12. Privacy, legal, and claims

Reuse `docs/VOICE-NOTE-TRANSCRIPTION.md` and extend it; do not fork a weaker policy.

| Rule | Application here |
| --- | --- |
| Explicit per-item consent | New analysis is a new action, or a clearly itemized extra on the transcribe action. Bundling “transcribe + emotion” behind one unlabeled button is forbidden. |
| Name processors | xtox, Sluice, Foundry Whisper, and any SER/LLM alias. |
| No raw audio in ConvoLens | Request memory only. |
| No content in telemetry | Acoustic summaries in logs are still content-adjacent; log only `analysis_version`, `feature_count`, error codes. |
| Deletion | Derived rows cascade with the conversation; user can delete analysis without deleting the transcript (tech spec). |
| Production gates | Same seven-gate shape as transcription, plus “DSP path verified” for Phase 1. |
| Biometrics | Do not store embeddings of the voice. Do not identify speakers. F0 statistics for one clip are features, not a voiceprint; do not keep a gallery. |
| Minors | If participant metadata or the user marks the chat as involving a minor, disable Phase 3 entirely and consider disabling Phase 2. Phase 1 acoustic chips may remain. Confirm in legal review. |
| Jurisdictions | Some EU interpretations treat emotion inference as high-risk / biometric-adjacent. D1 is “experimental and pull-able,” not “legal clearance.” A written privacy note remains a gate before any public cohort. |
| Funding / public claims | Distinguish implemented / experimental / planned / blocked. No screenshot of “sad” labels. |

---

## 13. UX requirements

- Acoustic chips use physical words (loudness, pauses, rising pitch), not emoji faces.
- Inclination chips use speech-act words (question, request, hedge, agreement, emphasis).
- Emotion indicators, if any, use a muted treatment, a tooltip that says they are experimental and not a diagnosis, and an always-visible “hide cues” control.
- Failed quality (too short, music-only, overlapping speech) shows **Unknown**, not Neutral. Neutral is a claim.
- Playing the original file remains the user’s job; ConvoLens does not become a media host.
- Analytics without any voice analysis still render; empty state explains the opt-in.

Copy review is a launch gate. The Evidence and Claims Auditor should see the strings before the flag goes true.

---

## 14. Gaps this request would miss if we only “added emotion”

These are in the design on purpose. If a later implementation drops them, that is a regression against this PRD.

1. **Acoustic layer first.** Emotion models on Opus voice notes will be noisy. DSP still helps.
2. **Unknown ≠ neutral.**
3. **Within-chat baselines, not population norms.** A quiet person is not “sad” because they are quieter than a research corpus.
4. **Sarcasm / disagreement between text and voice.** Show both channels; do not fuse.
5. **Code-switching and language.** Whisper language + do not run English-only SER on other languages.
6. **Compressed Opus quality.** WhatsApp voice notes are not studio audio; quality gates must fail closed.
7. **Quota and cost.** Whisper + SER + LLM per voice note will dominate unit economics. Docket must see the extra aliases. Phase 1 DSP should be near-zero model cost.
8. **Shared rate limiter** before API replicas > 1 (already called out for transcription).
9. **User correction.** Allow hiding or dismissing a cue; do not allow “correcting” someone else’s supposed emotion as ground truth we then train on.
10. **Eval set.** Synthetic + consented fixtures; never production chat content in eval repos.
11. **Prompt injection.** Voice transcripts are untrusted input to the stance LLM. Schema + allow-list labels only.
12. **Music, PTTs of groups, forwarded voice notes.** Skip or mark `not_applicable`.
13. **Retention of features vs raw.** Features are still personal data. Same deletion story.
14. **Screenshot / sharing.** Derived analysis is in scope for export and for “what leaves the account.”
15. **Accessibility.** Chips need text alternatives; do not encode meaning only in color.
16. **Children and third-party voices.** Consent of the ConvoLens user is not consent of everyone on the recording.
17. **No second pipeline.** Temptation to call Foundry from ConvoLens “just for this” would split auth, billing, and gates.

---

## 15. Technology recommendation (for the ADR)

Ordered preference:

1. **xtox + FFmpeg + a DSP library (librosa or praat-parselmouth)** for Phase 1. Python already sits in xtox; do not add a Node DSP stack in ConvoLens. Output JSON by default, YAML when requested (`format=json|yaml`).
2. **Existing Sluice Whisper path** for words and timestamps (Phase 2 dependency).
3. **Sluice-routed Foundry chat/completions or responses model** with JSON schema / strict enum for inclination. Reuse the ConvoLens catch-up virtual-key pattern only if scopes are separated; do not overload `convolens-catch-up-v1`.
4. **wav2vec2 SER** as the first experimental affect spike (audio-native). License-check the checkpoint. Prefer dimensional V/A/D. Do not ship audeering CC-BY-NC-SA weights in a commercial path.
5. **Content Understanding custom audio analyzer** as the second spike (schema + future video). GA `2025-11-01` only if we take it past preview. No prebuilt call-center sentiment, no keyframes, no speaker identity.
6. **Docket** for cost of (3)–(5).
7. **Semantic Kernel** only if a later ADR shows the pipeline has ≥3 tools with policy branching. Default is no.
8. **Foundry Prompt/Hosted Agents** same bar as SK. Default is no.
9. **Azure Language sentiment:** do not adopt.
10. **Video Indexer / Azure Face / Speaker Recognition:** do not adopt.

---

## 16. Decisions (Baton `3d7873a0`)

| ID | Question | Status | Resolution |
| --- | --- | --- | --- |
| **D1** | Ship emotion indicators as experimental opt-in cues, or keep them off until legal review? | **Resolved** | Experimental, opt-in, default off. Enable for the current private-preview / invite-only alpha; pull without a migration if copy, eval, or legal review fails. Not a public-launch claim. Written privacy note still required before any public cohort. |
| **D2** | Video in v1 = audio track only? | **Resolved** | Soundtrack only. xtox demuxes after acoustic audio DSP, not in the same PR. No visual models, keyframes, faces, or scene affect. UI states that vision was not used. |
| **D3** | Acoustic extraction in xtox as generic audio→JSON with `retain=false`? | **Resolved** | Yes, in xtox, `retain=false`. Serialization is configurable: JSON (HTTP default) or YAML (same schema). ConvoLens maps physical metrics to copy. |
| **D4** | wav2vec2 vs Content Understanding as the private-alpha SER default? | **Resolved** | Spike both. wav2vec2 (license-checked, prefer dimensional V/A/D) first; Content Understanding custom audio analyzer second (schema + future soundtrack path). Compare cost, latency, and claim-safety on the same fixtures before naming a default alias. DSP is not blocked. |

D1–D4 are resolved. Phase 1 DSP may proceed after ADR-0003 and the tech spec. SER spikes and video demux are follow-on PRs, not the DSP PR.

---

## 17. Success criteria

Planning succeeds when:

- This PRD, ADR-0003, and the tech spec are linked on `3d7873a0`.
- D1–D4 are resolved.
- xtox (`bb280705`) and Sluice (`802c9807`) tasks have a clear, ratified ownership paragraph.

Phase 1 succeeds when:

- A consented WhatsApp voice-note file produces acoustic chips without any LLM.
- Refusing consent leaves text analytics intact.
- Logs/metrics contain no audio, transcript, or feature vector.
- Deleting the conversation removes analysis rows.
- Quality failures show Unknown.
- Production remains gated until the transcription-style evidence list is green for the DSP path.

Phase 2 succeeds when inclination labels are an enum with evidence spans, and summaries that mention delivery cite stored features.

---

## 18. Risks

| Risk | Mitigation |
| --- | --- |
| Users (and agents) read “tone” as “emotion” | Vocabulary table is normative; copy review is a gate |
| SER bias across language/culture/gender | Default off; Unknown; no categorical angry/sad; language gate; pull-able flag |
| Unit cost explosion | Phase 1 has no model; Phase 2 is JSON-only on text; quotas |
| Parallel pipeline to Foundry | Forbidden; reuse xtox |
| Legal classification as biometric emotion inference | D1 experimental + pull; no voice gallery; no person-level traits; privacy note before public |
| Transcription still gated off, so this never ships | Phase 1 DSP does not wait on Whisper |
| Scope creep into video faces | Phase V3 blocked |
| SK/Mesh over-architecture | Named as non-goal |

---

## 19. Next documents

Planning on `3d7873a0` is complete: PRD-001, ADR-0003, SPEC-001, D1–D4.

Implementation slices (SPEC-001 §12), separate PRs:

1. xtox DSP (`bb280705`) — `POST /api/extract-acoustic-features`, JSON/YAML, `retain=false`.
2. ConvoLens Phase 1 — `message_media_analyses`, media-analysis route, acoustic chips, 503-until-gated.
3. Video soundtrack demux (D2) — follow-on.
4. Inclination after Whisper gates.
5. Affect spikes — wav2vec2 and Content Understanding in parallel (D4).
