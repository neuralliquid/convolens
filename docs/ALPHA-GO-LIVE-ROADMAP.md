# ConvoLens Alpha Go-Live Roadmap

**Status:** Draft go-live contract
**Date:** 2026-07-24
**Recommended release shape:** Invite-only alpha
**Recommended earliest cohort opening:** 2026-07-30, provided every go/no-go gate below is green

## Executive recommendation

Position ConvoLens as:

> A consent-first conversation intake and memory workspace. Bring in the
> WhatsApp conversation you choose, preserve its context, and turn it into
> traceable summaries and follow-up work. WhatsApp is the first connector;
> additional conversation sources will join the same workspace over time.

This is narrower and more defensible than "AI conversation intelligence":

- Meeting assistants already own automatic meeting capture and notes.
- Customer-support suites already own omnichannel inboxes, tickets, and agents.
- WhatsApp engagement platforms already own campaigns, bots, and team inboxes.
- ConvoLens can own **user-controlled intake of selected, high-value
  conversations** across closed messaging surfaces.

The first alpha audience should be small teams and professionals who need to
turn selected WhatsApp threads into structured context and follow-up work. Do
not broaden the promise until this audience activates and returns.

## Competitive positioning

| Product/category | Positioning and strength | What ConvoLens should learn | Where ConvoLens should not compete yet |
| --- | --- | --- | --- |
| Fireflies.ai | Captures meetings through bots, browser/mobile/desktop apps, dialers, files, and APIs; immediately provides summaries, search, analytics, actions, integrations, and enterprise trust controls. | Multiple explicit capture methods feeding one normalized workspace; immediate visible value after capture; searchable source-linked results. | Meeting transcription breadth, hundreds of integrations, enterprise compliance claims. |
| Otter.ai | An AI meeting agent that automatically joins calls, records, transcribes, summarizes, captures slides, and extracts action items. | Make the first captured conversation produce a useful artifact without extra setup. | Calendar-driven meeting automation and live transcription. |
| Read AI | Expands from meetings into emails and messages, then exposes summaries, insights, and answers across devices and AI tools. | The multi-platform destination should be one memory/query layer, not separate dashboards per connector. | Claiming broad channel coverage before connectors are live. |
| WATI | WhatsApp-first customer engagement with campaigns, team inboxes, automation, calling, and a path to more channels. | "Start with WhatsApp, expand naturally" is understandable when the first use case is strong. | Campaigns, outbound messaging, contact-center operations, and WhatsApp Business API infrastructure. |
| Intercom | Omnichannel customer-service inbox, tickets, workflows, reporting, human handoff, and an AI agent across WhatsApp and other channels. | Channel context, clear handoff, visible control, operational reporting, and fast setup are expected in mature products. | Helpdesk replacement, autonomous customer replies, ticketing, and resolution-rate claims. |

### Current ConvoLens advantage

- The user explicitly chooses the chat to send.
- WhatsApp Web capture does not require an always-present meeting bot.
- Text exports and browser capture can converge on the same intake contract.
- A connector-neutral normalized model can later accept more message sources.
- The product can make consent, provenance, and deletion part of the primary
  workflow instead of an enterprise add-on.

### Current positioning risks

- "Conversation intelligence" is interpreted as sales-call analytics or
  customer-service automation.
- "Summarize" is an unearned promise while the extension endpoint only validates
  and acknowledges data.
- "Alpha is open" is unsafe until received conversations are durably stored and
  can be reloaded by the same user.
- A multi-platform promise without a normalized intake contract becomes a list
  of unrelated connector demos.
- The current invited-tester extension distribution cannot support a broad
  self-serve launch.

## Moat thesis

The current product is a **credible wedge, not yet a defensible moat**.
WhatsApp extraction, normalized intake, and LLM summaries are all reproducible.
The defensible product begins when every user-approved intake makes a durable,
source-linked memory system more useful and harder to replace.

The proposed moat is:

> A consent-aware conversation memory graph that connects people, decisions,
> commitments, evidence, and follow-through across the messaging platforms a
> user chooses.

Four reinforcing assets should be built deliberately:

1. **Longitudinal memory:** resolve recurring people, topics, decisions, and
   commitments across conversations without losing source timestamps or quoted
   evidence.
2. **Trust and control:** make selective capture, provenance, access, retention,
   export, and deletion visible product behavior. This is both a switching-cost
   asset and a prerequisite for users to entrust more history.
3. **Outcome workflows:** turn remembered commitments into follow-up work and
   learn which suggested outcomes users accept, correct, dismiss, and complete.
   Raw conversation volume alone is not a moat.
4. **Connector-neutral identity:** map the same person, team, and thread context
   across WhatsApp, exports, email, meetings, and future sources while preserving
   source-specific consent and permissions.

The compounding loop should be measurable:

`select conversation -> preserve provenance -> connect it to prior context ->
produce an accepted outcome -> observe completion/correction -> improve the
next outcome`

### What to build now versus later

| Horizon | Product investment | Defensibility test |
| --- | --- | --- |
| Alpha | Durable intake, evidence-linked artifact, explicit consent, stable identity, deletion/export | A tester trusts ConvoLens with a second conversation and can retrieve the first |
| Early beta | Entity/commitment graph, corrections, cross-conversation search, follow-up state | The second intake produces more useful context than the first |
| Later beta | A second high-value connector and cross-source identity resolution | A user gets value that neither source can provide independently |
| Growth | Team memory, governed sharing, workflow integrations, outcome learning | Removing ConvoLens would lose accumulated decisions and operating context, not merely a summarizer |

### Moat validation gates

- At least 40% of activated alpha users voluntarily add a second conversation
  within seven days.
- At least 30% of viewed artifacts connect to a prior person, decision, topic,
  or commitment by early beta.
- Users accept or correct at least one extracted commitment or decision in 60%
  of activated weeks.
- Provenance links remain available for every generated claim.
- Export is usable and deletion is complete; defensibility must come from value
  and accumulated structure, not lock-in.
- A second connector increases cross-conversation retrieval or follow-through
  for the same cohort before a third connector is funded.

Do not treat proprietary prompts, a particular model, a browser selector, raw
message volume, or a large connector list as a moat. They may improve the
product, but competitors can reproduce them without inheriting the user's
accumulated, governed memory and outcome history.

## Product truth as of 2026-07-24

| Capability | Current state | Alpha implication |
| --- | --- | --- |
| Public landing and feature scope | Alpha wording is now explicit; fake testimonials and unsupported usage claims are removed. | Suitable for a technical preview after deployment. |
| Mystira sign-in | NextAuth works, but the web app also carried a legacy auth context. Chunked cookies and context adoption caused an observed redirect loop. | The local fix must pass production login proof before any invitations. |
| WhatsApp extension identity | Branded icon set and clearer alpha purpose are implemented locally. | Package and installation proof required. |
| WhatsApp selected-chat capture | Extraction and authenticated POST work. | Keep the consent boundary explicit. |
| Timeout/offline behavior | Blocking alerts and raw abort text are replaced locally with inline status and a single persistent retry queue. | Must be tested against a real cold API revision. |
| Durable conversation storage | Implemented in PR #120 with transactional records/messages, stable content-hash idempotency, user-scoped list/detail, and a PostgreSQL production plan. Production deployment and live restart/reload proof remain pending. | Code-complete; keep the functional alpha gate closed until production proof passes. |
| Summary generation from intake | The extension intake route does not queue or generate a summary. | **Stop-ship if the product promises summaries.** |
| Conversation history | PR #120 renders stored conversations and message detail from user-scoped APIs. | Verify the production web token exchange and reload journey before cohort opening. |
| Extension distribution | Direct to invited testers; no self-serve public install path. | Acceptable for a small invite-only cohort only. |
| Privacy, retention, deletion | No complete public policy and in-product deletion flow found. | **Stop-ship for external cohort data.** |
| Monitoring | API health exists; end-to-end intake/auth alerting is not yet proven. | Add business-flow telemetry and alerts before cohort opening. |

## Release stages

### Stage 0 — Technical preview deployment

**Target:** 2026-07-24
**Audience:** Maintainers only

- Merge and deploy the auth-loop, chunked-cookie, extension timeout, icon, and
  alpha-copy changes.
- Verify landing, login, callback, dashboard, and import routes in a fresh
  production browser profile.
- Verify the rebuilt ZIP contains every manifest-referenced runtime and icon
  file.
- Verify one selected WhatsApp chat reaches the production API without a modal
  error or duplicate queued upload.
- Keep the extension invite-only.

Exit gate: all current fixes are live and a maintainer can complete the full
flow once without a redirect loop.

### Stage 1 — Make intake durable

**Priority:** P0
**Target:** 2026-07-25 to 2026-07-27

- Define a connector-neutral `ConversationIntake` record:
  - tenant/user ID
  - source platform and source conversation ID
  - display name
  - participants
  - normalized messages
  - source timestamps and captured-at timestamp
  - consent/provenance metadata
  - content hash and idempotency key
  - processing status and error code
- Persist the record and messages transactionally before returning `200`.
- Return a stable intake ID and dashboard URL.
- Add `GET` list/detail endpoints scoped to the signed-in user.
- Render real received conversations on the dashboard.
- Prove add, list, process restart, reload, and duplicate submission behavior
  against the production backing store.
- Decide the alpha promise:
  - either generate a real source-linked summary; or
  - call the product an intake technical preview and remove all summary claims.

Exit gate: a submitted conversation survives a service restart and reloads for
the same user only.

### Stage 2 — Close the first-run loop

**Priority:** P0
**Target:** 2026-07-27 to 2026-07-28

- Use NextAuth/Mystira as the single web auth source; retire the legacy API
  session path from the web shell.
- Add automated coverage for unchunked and chunked secure session cookies.
- Make the post-login callback path deterministic and local-only.
- After intake, show one unambiguous success page:
  - conversation received
  - number of messages
  - processing state
  - link to the stored record
- Add an extension install/download path for invited users that does not depend
  on repository access.
- Add extension version/update guidance and a support contact.
- Run three clean-profile journeys in succession:
  - first sign-in
  - returning sign-in
  - expired session recovery

Exit gate: no login loop, dead end, private-repository instruction, or ambiguous
"sent" state remains.

### Stage 3 — Establish the trust boundary

**Priority:** P0
**Target:** 2026-07-28 to 2026-07-29

- Publish privacy and terms pages linked from the website and extension.
- State exactly:
  - what the extension reads
  - when it reads it
  - where data is transmitted and stored
  - retention period
  - model/provider use
  - whether humans can access content
- Add user-visible delete and export controls.
- Add a retention job and prove deletion from primary storage and queues.
- Review Chrome permissions and host permissions for the narrowest live scope.
- Remove message content, tokens, emails, and chat names from routine logs.
- Verify encryption in transit, encrypted storage, Key Vault-backed secrets, and
  per-user authorization on every conversation endpoint.
- Record consent/provenance without claiming that the sender has obtained legal
  authority on behalf of every participant.

Exit gate: a tester can understand, export, and delete their data without
contacting an engineer.

### Stage 4 — Operate the alpha

**Priority:** P0 before cohort; P1 refinements after
**Target:** 2026-07-29

- Instrument the funnel:
  - landing to sign-in
  - successful callback
  - extension connected
  - extraction started
  - intake received
  - intake persisted
  - summary completed
  - record viewed
- Correlate extension, web, and API requests with a trace/intake ID.
- Alert on auth-loop signals, intake error rate, timeout rate, retry-queue depth,
  processing failures, and unavailable dependencies.
- Add synthetic production probes for web, API health, auth configuration, and
  an authenticated canary intake with non-sensitive test data.
- Define alpha service targets:
  - authentication success rate >= 99%
  - intake persistence success rate >= 99%
  - p95 selected-chat acknowledgement <= 10 seconds when healthy
  - zero cross-user data access
- Write rollback, incident, data-deletion, and extension-revocation runbooks.
- Verify deployment from a saved commit and rollback to the previous version.

Exit gate: failures are visible to operators before a tester needs to report
them.

### Stage 5 — Invite-only alpha cohort

**Target:** 2026-07-30, conditional on all P0 gates
**Audience:** 5–10 invited users

- Start with one primary use case and one onboarding call/email.
- Keep extension distribution controlled.
- Offer an in-product feedback action tied to intake ID and app version.
- Review activation and failures daily during the first week.
- Do not publish testimonials, user counts, accuracy, time-saved, or privacy
  certifications until there is evidence and permission.
- Widen only after two consecutive weeks without a P0 incident.

## Alpha metrics

### Primary

- **Activation:** percentage of signed-in invited users who persist one real
  conversation within 15 minutes.
- **Time to first value:** median time from first landing to viewing the first
  stored conversation artifact.
- **Intake reliability:** persisted intakes divided by accepted submissions.
- **Processing reliability:** usable summaries divided by persisted intakes, if
  summaries are in scope.

### Guardrails

- Authentication redirect loops: 0
- Cross-user authorization failures: 0
- Content-loss incidents: 0
- Duplicate records after automatic retry: < 0.5%
- p95 intake acknowledgement: <= 10 seconds when dependencies are healthy
- Delete requests completed within the published retention commitment: 100%

### Learning

- Percentage choosing extension versus file import
- Percentage returning within seven days
- Top intended outcomes after intake
- Most common failed selector/platform state
- Most requested next connector, captured without promising a delivery date

## Go/no-go checklist

The invite-only alpha is **NO-GO** unless every item is true:

- [ ] Production login completes without a loop in three clean browser profiles.
- [ ] Chunked secure NextAuth cookies reach protected routes.
- [ ] Web and extension use the same signed-in Mystira identity.
- [ ] A received conversation is durably persisted before success is shown.
- [ ] The persisted conversation reloads after an API restart.
- [ ] Duplicate retries do not duplicate the stored conversation.
- [ ] A user cannot access another user's intake by ID.
- [ ] A user can delete and export their own conversation data.
- [ ] Privacy and terms links are live and match actual data handling.
- [ ] Chrome permissions and disclosure satisfy the single-purpose/minimum-scope
      review.
- [ ] The extension has a tester-accessible install and update path.
- [ ] Timeout, offline, expired-token, no-selected-chat, large-chat, and
      selector-change paths have user-facing outcomes.
- [ ] Web, API, auth, persistence, queue, and processing alerts are enabled.
- [ ] Production rollback has been exercised.
- [ ] There are no open P0/P1 defects in the first-use journey.
- [ ] A named operator owns the first-week support and incident window.

## Sources reviewed

Competitive claims are taken from current official product pages:

- Fireflies.ai: <https://fireflies.ai/>
- Otter.ai meeting agent: <https://get.otter.ai/ai-meeting-agent/>
- Read AI: <https://www.read.ai/>
- WATI: <https://www.wati.io/en/>
- Intercom for small business: <https://www.intercom.com/small-business>

Relevant launch and extension guidance:

- Chrome Web Store Limited Use policy:
  <https://developer.chrome.com/docs/webstore/program-policies/limited-use>
- Chrome Web Store user-data and minimum-permission FAQ:
  <https://developer.chrome.com/docs/webstore/program-policies/user-data-faq>
- Azure monitoring and diagnostics:
  <https://learn.microsoft.com/azure/architecture/best-practices/monitoring>
- Azure Well-Architected Framework:
  <https://learn.microsoft.com/azure/well-architected/>
