# ConvoLens extension runtime/auth handoff — 2026-07-24

> **Archival record. Do not action.**
>
> This document was drafted on 2026-07-24 and never committed; it was recovered
> from the primary checkout on 2026-08-06. The work it describes shipped as
> PR [#116](https://github.com/neuralliquid/convolens/pull/116) and the
> `fix/extension-runtime-auth` branch has since been deleted.
>
> Everything below is preserved in its original present tense. The "in-progress"
> status, the unverified-changes warning, and the "Recommended continuation"
> steps all describe the state on 2026-07-24 and were resolved by #116. It is
> kept for the operator smoke findings — in particular the ESM bundling failure
> and the WhatsApp DOM selector observed at that date — not as live instructions.

## Starting point

- Branch: `fix/extension-runtime-auth`
- Base: `main` at `ed47acb` (PR #115)
- State: implementation is uncommitted and not pushed
- Production baseline was rechecked before this work:
  - `/features` returned HTTP 200
  - `/api/runtime/auth-status` returned `{"mystiraConfigured":true}`
  - the production API `/health` returned HTTP 200
  - deploy run `30101340123` and merge CI run `30101084079` succeeded
- Production deployment remains manual through `Deploy Production`.
- Do not autonomously apply the separately codified Mystira Identity Terraform.

## Operator smoke findings

An unpacked packaged extension was loaded in Playwright Chromium against an
operator-held WhatsApp Business session.

1. The old TypeScript build copied imports into `dist/content.js`, which Chrome
   rejected with `Cannot use import statement outside a module`.
2. After bundling the extension scripts, the content script loaded and rendered
   the `Summarize` button.
3. WhatsApp's current message nodes use
   `.selectable-text.copyable-text[dir]`; the old
   `.selectable-text span[dir="ltr"]` selector extracted no messages.
4. With extraction fixed, the request stopped at the extension's legacy auth:
   `Not authenticated. Please log in first.`
5. The legacy email/password popup called the placeholder
   `/api/auth/login` route. It also read `GET_AUTH_STATUS` from the wrong
   response level.
6. The extension service worker can read the authenticated production NextAuth
   session using `fetch(.../api/auth/session, { credentials: "include" })`.
7. The session access token is opaque and Mystira OIDC `userinfo` rejected it
   with HTTP 401. The in-progress implementation therefore carries the OIDC ID
   token through NextAuth and exchanges it for a short-lived ConvoLens API JWT.

No private chat text, cookies, browser profiles, or session snapshots have been
retained. The temporary `.playwright-cli` and
`apps/chrome-extension/.tmp` directories were deleted.

## In-progress implementation

- `apps/chrome-extension/scripts/build-extension.mjs`
  - bundles the content script as an IIFE and the background worker as ESM
  - copies static assets into a clean `dist`
- `apps/chrome-extension/package.json`
  - uses the bundling script for build/package and adds `esbuild`
- `apps/chrome-extension/src/config.ts`
  - updates the WhatsApp fallback selector
  - adds auth-expiry storage and `SYNC_MYSTIRA_AUTH`
- `apps/chrome-extension/src/background.ts`
  - reads the production NextAuth session
  - exchanges `session.idToken` at `/api/auth/mystira/exchange`
  - stores and refreshes a short-lived ConvoLens API token
- `apps/chrome-extension/popup/`
  - replaces legacy email/password controls with Mystira session connection
  - fixes the nested auth-status response handling
- `apps/web/src/lib/auth.ts` and `apps/web/src/types/next-auth.d.ts`
  - carry the OIDC ID token into the NextAuth JWT/session
- `apps/api/src/services/mystira-auth.service.ts`
  - validates RS256 ID tokens using OIDC discovery and JWKS
  - checks issuer and ConvoLens client audience
  - issues a 15-minute ConvoLens API JWT
- `apps/api/src/routes/auth.routes.ts`
  - exposes rate-limited `POST /api/auth/mystira/exchange`
- `apps/api/src/services/__tests__/mystira-auth.service.test.ts`
  - covers a valid token, wrong audience, and missing signing key
- `infra/terraform/env/prod/main.tf`
  - supplies Mystira discovery and client ID settings to the API container
- `pnpm-lock.yaml`
  - records the extension build dependency

The existing placeholder login/register routes remain, but the revised popup no
longer uses them.

## Verification status

Before the final switch from `userinfo` to ID-token validation, these checks
passed:

- extension typecheck/package
- focused API auth tests
- API build
- production Terraform validation

The final validation run after the ID-token pivot was interrupted for this
handoff. Treat the current changes as unverified until all of the following pass:

```powershell
pnpm --dir apps/api exec jest --config=jest.config.js --runInBand src/services/__tests__/mystira-auth.service.test.ts
pnpm --filter @convolens/api build
pnpm --filter @convolens/web build
Push-Location apps/chrome-extension
npm run package
Pop-Location
terraform -chdir=infra/terraform/env/prod validate
git diff --check
```

Also inspect `git diff` before committing. `popup.html` has a large formatting
diff and should be checked for accidental churn.

## Recommended continuation

1. Start on `fix/extension-runtime-auth` and run the final validation above.
2. Fix any failures and review the complete diff.
3. Commit, push, and open a focused PR; wait for current CI/review before merge.
4. After merge, run the manual production deployment and verify the public
   features page, runtime auth status, and API health.
5. Repackage and extract the extension, then reload it unpacked. A fresh Mystira
   sign-in may be needed so the NextAuth session contains the new `idToken`.
6. With an operator-held benign WhatsApp chat selected, click `Summarize` and
   verify authenticated receipt by the API.

The current chat-export route acknowledges, deduplicates, and records metrics,
but its persistence/summary pipeline is still marked TODO. A successful smoke at
this stage proves authenticated extraction and API receipt, not durable storage
or an AI-generated summary.
