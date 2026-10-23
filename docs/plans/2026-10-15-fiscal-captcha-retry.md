# Fiscal verification rejection and retry handling

Workstream 03, stages 3/6. Continues the existing fiscal completion lane after
the draft startup fix in PR323. Branch `fix/fiscal-captcha-errors-20261015`,
base `origin/main` `32f2eec4`; actual localhost remains port 3127.

## Report and evidence

Caleb reports repeated “Please complete the verification again” messages and
HTTP400 from `/api/public/fiscal-sponsorship/applications` after completing
the challenge. That message identifies the server verification rejection path,
before the application write. The previous helper reduced expired/reused tokens,
incorrect secret/sitekey configuration, malformed provider responses, non-2xx
responses and request failures to the same boolean. It recorded no provider
reason. Therefore the exact production rejection cannot be established from
existing application logs. Do not claim this patch proves that cause.

Read-only Vercel inspection confirms a Production HCAPTCHA_SECRET_KEY entry;
its secret value was not revealed or changed. Local keys are non-test, present
and contain no surrounding whitespace; this does not prove they are correctly
paired or that deployed values match. Negative provider probes created no
application and verified no user challenge. Supabase Auth/provider settings
remain unchanged. Caleb did not know the secret's origin and noted he had not
requested CAPTCHA. No removal or bypass was inferred from that feedback.

Reference: [hCaptcha verification errors](https://docs.hcaptcha.com/#siteverify-error-codes-table).
Tokens expire and are single-use; configuration/provider errors require a
different response from an applicant token rejection.

## Changes and boundaries

- Classify verification as verified, challenge rejected, or unavailable. Only
  strictly verified responses permit submission or a recovery-mail request.
- Record an allowlist of provider error codes and a category in `[fiscal-captcha]`
  server warnings. Never record tokens, secrets, IPs, answers, emails or arbitrary
  provider output. Unknown/malformed responses remain unavailable.
- Return an explicit CAPTCHA-unavailable503 before any submission write. Release
  editing and show the server-side problem; do not mislabel it an uncertain
  application write. Preserve identical receipt retries for all other unknown
  write results. Receipt lookup still precedes token verification.
- Recheck the latest challenge after awaiting draft flush. Reject an expired
  token locally; use a replacement completed during the save. Preserve answers.
- No layout, visual fixture, database, provider, flag, secret, permission or
  deployment change. Existing CAPTCHA protection and rate limits stay enforced.

## Local validation and handoff

84 focused cases across submission, recovery, browser retry, draft controller
and reload recovery pass. These cover expired/reused tokens, provider/configuration
failures, private diagnostics, no writes/emails on rejected verification, token
expiry/replacement during save, fresh-token retries and unchanged uncertain-write
idempotency. Changed-file lint, feature and boundary checks pass; normal prepush runs at handoff. No
complete local quality/build or new production submission is part of this run.

Caleb owns hosted gates/review, merge, deployment and the real application/inbox
journey. After deployment, a fresh failure supplies `[fiscal-captcha]` with the
specific safe reason in Vercel runtime logs. Resolve configuration only from that
evidence; do not rotate keys or disable protection speculatively. Shared SHIP40
owner-host blocker is unchanged. Fiscal completion remains open until the real
submission, receipt and staff notification checks pass.
