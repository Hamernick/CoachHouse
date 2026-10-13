# Fiscal application changes — 2026-10-10

Status: implemented and tested locally in `feat/frontpage-20261007`; not deployed. Applies to the shared public/internal application editor, draft persistence and submission validation. Public guest submission remains a preview until the separate guest-intake release gates are complete.

**User direction, 2026-10-10:** No release until all workstreams in the consolidated homepage/product plan are complete. Earlier partial-release or migration-activation sequencing below is historical preparation, not current authorization to activate an early fiscal slice. Continue local implementation and isolated validation; keep production flags, migrations and deployment unchanged.

## Latest local increment — explicit email proof and submission UI

Pending migration `20261010170000_guest_fiscal_email_proof.sql` adds service-only, RLS-protected proof and verified-browser tables. A receipt worker can prepare proof only for its current unexpired applicant-receipt lease. The first nonce/hash/expiry is frozen for identical provider retries. The token is HMAC-signed, its bearer value is never stored, and expiry is seven days. Keep the dedicated `FISCAL_GUEST_LINK_SECRET` (at least 32 characters), sender and canonical origin stable during retry windows; key mismatch fails closed rather than sending different content under the same provider idempotency key. Neither receipt version has shipped; current copy uses `fiscal-guest-v2`.

`POST /api/public/fiscal-sponsorship/verify` requires the existing configured intake boundary, exact origin, signed browser capability, bounded JSON, a valid proof signature and durable IP limits. The database consumes the proof and records verified email/browser scope atomically. A lost response can be retried in the same browser; another browser cannot reuse a consumed link. Verification never sets account-claim fields, creates an account, publishes data or approves the project. Response contains only its reference. Verified sessions cannot extend their original deadline through replay.

The email link uses `/documentation/fiscal-sponsorship/verify#verify=…`; fragments stay outside HTTP request logs. The page removes the fragment on mount and makes no verification/session request until the applicant explicitly clicks Verify email. No-referrer/noindex metadata and Analytics/Speed Insights route exclusion add protection. Provider filtering follows [Vercel Analytics beforeSend](https://vercel.com/docs/analytics/package) and [Speed Insights beforeSend](https://vercel.com/docs/speed-insights/package). Verification does not claim an account. The private applicant status/correction flow is now implemented locally (see below); expired-link self-service recovery is still open.

The existing form now supports validated submission/receipt interaction only when **both** `FISCAL_GUEST_INTAKE_ENABLED=true` and `FISCAL_GUEST_SUBMISSION_UI_ENABLED=true`. Both remain off here. Client and server share the strict schema; the adapter converts raw editable answers to server values. Temporary projects require a start date but may explicitly have no proposed end date; any provided end must follow the start. Submission flushes the private draft first, preserves rejected answers and retries the identical uncertain payload. The server's existing receipt-first transaction prevents duplicates. Optional signup/import is now implemented locally (below); integrated confirmation/storage testing remains required before activation.

Retention now also calls `purge_expired_fiscal_guest_proofs`: at most 250 proofs and 250 verified sessions per call, alongside up to 500 drafts. Response adds `proofsDeleted`; `morePossible` conservatively requests another batch. Keep independent retention enabled when intake/mail is paused. No scheduler or production flag was configured.

Validation: 82 focused tests across seven files, isolated guest database suite including proof privileges/replay/expiry/cleanup, scoped lint/types and route/import checks. Focused browser verification used mocked private POST responses; opening alone made no private requests, explicit confirmation succeeded and the screenshot was inspected. Full migrated-storage form integration, actual captcha/provider delivery, optional claim/import, reviewer appearance and broader access audits remain open. No real emails sent.

## Optional verified profile reuse — local checkpoint 7

Pending migration `20261010180000_guest_fiscal_profile_claim.sql` adds private import receipts and service-only preview/save RPCs. Claim authorization requires an unexpired verified application browser capability, the application contact's confirmed `auth.users` email, a real profile row and no different prior claimant. The request endpoint independently revalidates the signed-in user with `getUser`, following [Supabase server-side Auth guidance](https://supabase.com/docs/guides/auth/server-side/creating-a-client). Request JSON cannot supply an actor or destination organization. The configured internal host cannot be an import destination.

`POST /api/public/fiscal-sponsorship/profile` accepts strict preview/save/open operations behind the existing disabled intake flag, exact-origin/HttpOnly-capability checks, bounded JSON and a 30-per-15-minute HMAC IP bucket. References are identifiers, not credentials. Preview exposes only four reusable fields, current corresponding values and a concurrency version; no private application, mailing, review or host data. An explicit open operation selects the already-linked account owner's organization before navigating to `/organization/profile`; reads never switch active organizations.

Saving takes an explicit field selection, preview version and request UUID. In one transaction it creates a private owner profile if absent or updates only selected values, records account linkage separately from host ownership and writes a private idempotency receipt. Unselected existing fields survive. A stale preview returns conflict without partial claim. Repeated acknowledgments do not overwrite later manual edits; a different claim attempt cannot import again. Already-public profiles permit link-only, preventing accidental publication of private application answers. Internal project ownership, reviewer assignment, application status, signing authority and paid/team capabilities are not altered.

The receipt and verification screens offer profile creation plus Not now. `/documentation/fiscal-sponsorship/profile?application=<reference>` reuses existing email/Google signup/login, consent and safe auth return handling. Every import checkbox starts unchecked; selected values are editable. Only plain-text name/description/contact email/phone are accepted. No website was collected and unstructured project location is not substituted for profile address. Profile publishing stays a separate action. The profile route has noindex/no-referrer metadata and is excluded from both telemetry providers.

Validation: 28 tests across profile API, email-proof and public-intake contracts; isolated SQL assertions cover privilege denial, missing/expired/wrong proof, unconfirmed/wrong account, private creation, selected-only updates, unchanged review, replay, stale versions, public-profile exclusion and rollback on receipt failure. Scoped TypeScript/ESLint and route/import checks pass. Browser test used mocked POSTs only and confirmed all choices initially unchecked, selected-only payload and exact retry after an aborted response. Screenshot `/private/tmp/fiscal-profile-selection.png` inspected. Actual email/Google confirmation, full migrated-storage integration and broader free-tier access audit remain open; no real mail/account writes or activation occurred.

The remaining implementation sequence stays in the consolidated product plan: integrated applicant status/correction verification and email recovery/delivery reconciliation, access audits, then remaining homepage/Resources/Documentation/collection review. This optional step is not a separate release.

## Application policy

- Ask for anticipated fundraising amount in USD and Monthly, Annually or Total. Store integer cents and the selected period in `metadata.fundraisingGoal`; never convert an expense budget into recurring income.
- Preserve historical budget rows, expense summary, short description and investor-return answers. New saves do not synchronize these retained rows into the program budget.
- Remove the short public description and investor-return questions from the editor. Neither is required for submission.
- Outside-U.S. operations and lobbying Yes answers require explanation, not automatic rejection. The same explanation field also covers existing legal/compliance concerns. Each Yes answer must be addressed. Reviewers still decide approval.
- Application readiness accepts a known operating location outside the U.S. Existing tax/mailing and other preparation requirements remain.
- Previously stored applications without fundraising-goal metadata retain the legacy budget fallback. Once a goal is supplied, it must be valid and positive at submission. Invalid nonempty amounts cannot be saved silently as blank.
- Generated application summaries include amount plus timeframe and the eligibility explanation. Existing executed agreements and handbook legal text were not rewritten.

## Karissa notification delivery

Migration `20261010120000_fiscal_staff_event_notifications.sql` queues one staff email for each newly committed fiscal event, including submission, document, review and signing events. Draft saves are excluded. Queue writes roll back with the fiscal event; this covers public and internal origins without depending on reviewer assignments.

The worker sends to the confirmed `fs@coachhousesolutions.org` inbox. Messages contain the event type and authenticated project link, not application answers or attachments. Existing project permissions and assigned-coach notifications remain unchanged; receiving email does not grant project access.

The unreleased guest transaction now queues applicant and Joel messages in the guest outbox; Karissa's submission email comes from the global event queue. The guest outbox dispatcher is still separate outstanding work. Apply the guest and staff-notification migrations together before enabling guest submissions.

### Activation checklist

- [ ] Complete required release checks/review and apply the staff queue migration to the intended database. It does not require the guest tables for existing authenticated applications.
- [ ] Deploy `GET /api/internal/cron/fiscal-notifications` and configure Resend credentials, verified sender and the production `NEXT_PUBLIC_SITE_URL`.
- [ ] Configure a scheduler to call that endpoint every minute with `Authorization: Bearer <INTERNAL_CRON_SECRET>`. `CRON_SECRET` is used only when `INTERNAL_CRON_SECRET` is unset. No schedule was activated during development.
- [ ] Confirm Karissa's staff account has authorized access to the linked project. Do not broaden RLS to make a notification link work.
- [ ] Run an approved controlled application event and confirm provider delivery and inbox receipt. No real emails were sent in local tests.
- [ ] Monitor due pending jobs and failed rows. A worker processes at most five jobs per call with an eight-second provider timeout and five-minute lease. A growing queue requires more scheduled invocations or a separately reviewed batch adjustment.

Retries use an immutable event ID as the provider idempotency key, plus a fresh lease token for database acknowledgement. Stale workers cannot acknowledge another worker's lease. Retries back off and stop after eight attempts or 23 hours from the first attempt; [Resend retains idempotency keys for 24 hours](https://resend.com/changelog/idempotency-keys). Do not blindly reset old failed jobs: check provider acceptance first to avoid duplicate emails. Provider acceptance is recorded as `sent`; it is not proof of inbox delivery. No existing event history is backfilled.

## Local verification

- Focused application UI, draft/amount, save, submission, review, agreement and notification acceptance tests passed; international readiness and preserved legacy-budget behavior covered.
- Isolated PostgreSQL guest/queue tests passed: RLS/execute denial, transactional rollback, goal validation, explanation requirements, queue leasing, retries, stale acknowledgements and expired idempotency windows.
- Scoped TypeScript, ESLint, route and import-boundary checks passed.
- Public page returned HTTP 200 with the new fundraising controls. Visual/browser verification remains pending.

Remaining guest-intake work is tracked in `docs/plans/2026-10-09-homepage-product-journey.md`: ownership configuration, public abuse-protected endpoint, reviewer access, applicant/Joel receipts, optional verified signup/claim and end-to-end release review.

## Guest rollout preflight and reviewer boundary — 2026-10-10

User authorized preparing/applying migrations toward release, with homepage work remaining unreleased. Existing repository quality/review requirements still apply; no exception was requested. Do not deploy the full frontpage dirty tree merely to activate backend work.

Read-only checks against `vswzhuwjtgzrkxknrmxu` verified:

- Internal host: Coach House Solutions Group, organization `c5405481-cea7-418a-b0c3-531ec942c047` (user-approved temporary scope).
- Karissa: `fs@coachhousesolutions.org`, staff user `15251245-8bd1-4ea5-ad42-401b9f56f7f8`, coach.
- Joel: `joel@coachhousesolutions.org`, staff user `64cf262e-e526-4601-8a2a-f50d1c11c8c2`, coach.
- No 20261010-or-later migration ledger entries were present at this check. Existing fiscal application non-null columns match the pending transaction's explicit values. This is a bounded schema check, not full production equivalence.

Provider metadata was read through the documented [read-only Management API](https://supabase.com/docs/reference/api/v1-read-only-query); no database writes, emails or role changes were performed.

The review found that organization membership would otherwise expose internally hosted guest applications. New pending migration `20261010130000_guest_fiscal_reviewer_scope.sql` adds restrictive policies to projects and fiscal applications/reviews/documents/signature packets/events. Assigned staff reviewers and developers can read guest records; ordinary host members and unassigned coaches cannot. Ordinary projects retain existing policies. Actor lookup binds authenticated callers to their session identity; only the service role can inspect another actor. No general organization-coach assignment is changed.

Server draft/workflow reads now apply the guest restriction before using elevated access. Review, document and signing authorization accepts the explicit guest project assignment and does not fall back to host-organization assignment after a denial/error. Scoped tests cover both reviewers, revocation, host owner denial, caller impersonation denial, ordinary-project behavior and existing workflow transitions.

Still required before enabling guest intake:

- Project list/detail routing is implemented locally. Complete authenticated browser review for both reviewers and the separate assets/storage/general project-action audit before enabling intake.
- Finish endpoint/abuse controls, guest receipt dispatch, resume/claim and free-profile boundaries. Keep public submission disabled.
- Package backend changes separately, pass required current-revision CI/review, apply the reviewed dependency sequence, then configure the verified internal organization and test with controlled recipients. Apply reviewer-scope migration before releasing code that calls its RPC; lookup failures intentionally deny access.
- Reassess the earlier `20261010090000` account-first migration separately. Guest submission does not itself require its account-creation RPC. Do not indiscriminately push every pending migration.
- Follow up on organization-optional staff projects after this release, preserving explicit staff/project permissions and public/private separation.


## Project-only staff review checkpoint — 2026-10-10

Pending migration `20261010140000_guest_fiscal_project_views.sql` provides assigned guest project listing, verified account-linkage summary, and service-only notification recipients. The project detail route branches into a fiscal-only review screen before loading the host organization's billing, team, credits or programs. The existing fiscal workbench displays read-only applicant answers; its action is labeled View, not Edit. Guest account linkage requires verified email plus a claimed user, organization and timestamp. No email-string-only association.

Guest workflow notifications now use current project reviewer assignments, never host organization members/coaches. Errors fail closed; ordinary projects retain existing recipient routing. This in-app notification routing does not complete applicant receipt/status email delivery. Applicant and Joel durable email dispatch remains outstanding.

Agreement and W-9 preparation/signing currently assume an organization owner/member identity. Guest entrypoints explicitly reject those operations until verified guest signing is implemented; the staff guest view does not expose those actions or a team requirement. Do not remove this guard merely because optional signup has linked an account: the internal host still is not the applicant's legal entity.

Rollout ordering: apply the reviewed 100000, 120000, 130000 and 140000 dependency sequence before deploying callers. Missing RPCs deliberately deny access/delivery, rather than silently routing guest data through the host. The older 090000 account-first migration is still a separate review decision. No production changes or real emails in this checkpoint. Authenticated/mobile/light-dark visual review and baselines remain pending because the new provider schema is not activated.


## Guest submission and receipt transport checkpoint — 2026-10-10

Implemented locally, inactive by default:

- `POST /api/public/fiscal-sponsorship/session`: rate-limited, same-origin issuance of a random, signed, seven-day HttpOnly/SameSite=Strict cookie (Secure and `__Host-` in production). Expiry and signature are checked server-side. JSON never contains the capability. No account is created.
- `POST /api/public/fiscal-sponsorship/applications`: 64KiB streamed-body bound; strict field allowlist; USD fundraising goal mapping; explanation required for lobbying/international/other concerns; hCaptcha siteverify; HMAC IP/email limits; atomic existing guest submission RPC. The response contains only a receipt reference, not internal project/application IDs. A retry with the same capability resolves an already-committed receipt before spending another captcha or email allowance. Ambiguous failures say submission could not be confirmed, not that no write occurred.
- `GET /api/internal/cron/fiscal-guest-notifications`: existing bearer-secret authorization, separate from Karissa's staff-event cron. At most three applicant/Joel jobs per call, eight-second provider timeout, five-minute lease, exponential backoff, stale-lease rejection and stable per-job Resend keys. Automatic ambiguous retries stop after eight attempts or 23 hours. Revoked reviewer assignments prevent unsent reviewer jobs from being claimed. The applicant receives a receipt/reference, not private answers, a staff link or a forced signup.

New pending migration: `20261010150000_guest_fiscal_delivery.sql` (depends on guest submission tables). It adds service-only leased delivery/receipt RPCs and RLS-protected HMAC limit buckets. IP attempts: 20/15 minutes per endpoint; accepted-captcha email attempts: 3/day. Buckets older than their expiry plus one day are pruned in batches of 50 during limit consumption; scheduled retention cleanup remains part of the activation review. Receipt capability lookup returns no answers or account information.

Activation requirements (do not set these merely to demo the unfinished form):

- `FISCAL_GUEST_INTAKE_ENABLED=true`, canonical `NEXT_PUBLIC_SITE_URL`, dedicated server-only `FISCAL_GUEST_RISK_SECRET` of at least 32 characters, `HCAPTCHA_SECRET_KEY`, and `NEXT_PUBLIC_HCAPTCHA_SITE_KEY`. Production rejects dummy captcha credentials, non-HTTPS origins and deployments without a trusted Vercel IP header. Non-Vercel production needs a separately reviewed trusted-proxy adapter. Secret rotation invalidates existing intake cookies; preserve/rotate deliberately.
- `FISCAL_GUEST_EMAILS_ENABLED=true`, existing Resend sender credentials and existing cron bearer secret. Configure this endpoint separately from `/api/internal/cron/fiscal-notifications`; do not combine batches and exceed the 60-second runtime.
- Keep both flags unset until draft/resume, verified return links, optional claim/import, free-tier and attachment/general-project authorization audits, and current-revision CI/security review are complete. No flags or provider settings were changed locally or remotely.
- Receipt copy is now versioned `fiscal-guest-v2` (explicit verification link; neither version has been activated); do not change payload, sender or site origin for in-flight retries. Preserve old payload versions across deployments or wait for the retry window to close before changing them. A provider acceptance ID is not evidence of inbox delivery. Bounce/delivery reconciliation and controlled inbox checks remain open.

Verification: 36 focused tests across four files, scoped TypeScript/ESLint, route/import contracts and isolated PostgreSQL tests passed. Correct frontpage localhost:3000 listener returned the expected disabled 503 JSON without a write. No real captcha verification calls or emails were made; provider behavior was mocked in tests.

Sources consulted: [hCaptcha server verification](https://docs.hcaptcha.com/#server), [Vercel trusted request headers](https://vercel.com/docs/headers/request-headers#x-vercel-forwarded-for), [Resend idempotency retention](https://resend.com/docs/dashboard/emails/idempotency-keys). hCaptcha's LLM markdown endpoints were unavailable; used its official HTML developer guide. Email receipt does not mark an address verified; that requires the separate explicit proof/claim flow.

## Private browser drafts — 2026-10-10

Pending migration `20261010160000_guest_fiscal_drafts.sql` depends on the guest submission schema. No direct anon/authenticated privileges: only the trusted server can read/write drafts. Answers are private database records, not public organization fields. Only the capability hash is stored. This does not claim application-level encryption; normal database security/backup retention still applies.

`POST /api/public/fiscal-sponsorship/draft` accepts either `{ operation: "read" }` or `{ operation: "save", version, requestId, draft }`. It uses the existing intake flag/config, strict same-origin checks, signed HttpOnly cookie, 64KiB streaming bound and durable HMAC IP bucket (100/minute). Drafts explicitly allow unfinished strings; submission validation remains separate. Unknown fields, internal IDs/status, snapshots and removed questions are rejected. `pickGuestFiscalDraft` selects only supported editable fields from the existing editor draft.

- Deadline comes from the server-signed session, never request JSON. Saving cannot renew it. Missing draft returns version 0; successful save increments the version. Expired sessions return 401.
- Store the latest write UUID and compare expected version/payload. Retry that exact write to resolve an uncertain acknowledgment. A stale tab or a reused UUID with changed content returns 409 without exposing/overwriting another tab's changes. The future client must retain unsaved local answers on error/conflict and explicitly offer reload/reconciliation; do not silently overwrite.
- Read/save and submission share the same transaction advisory lock. Successful handoff deletes the draft in the submission transaction. Subsequent reads/saves return only `state: submitted` and the public receipt reference, never private project/application IDs.
- Recovery currently requires the original cookie in the original browser. Clearing cookies or waiting seven days loses access. Email/cross-device recovery remains unfinished; never claim the receipt proves email ownership.

`GET /api/internal/cron/fiscal-guest-draft-retention` requires the existing private cron bearer secret plus `FISCAL_GUEST_RETENTION_ENABLED=true`. It deletes at most 500 expired drafts per call and reports `deleted`/`morePossible`; no answers or capability hashes are returned. Enable a regular schedule, monitor successful runs and drain sustained `morePossible` backlogs before enabling public draft collection. Keep retention enabled if intake or email delivery is paused. Expiry denies reads even if physical cleanup is delayed. No scheduler was configured this increment. Backup retention and request-limit/event/email retention remain separate rollout checks.

Validation: 42 tests across draft/submission/email files, isolated PostgreSQL transaction/RLS/draft/cleanup assertions, scoped TypeScript and changed-file ESLint passed. The public preview has not been connected or enabled. No real emails or remote writes.

### Draft UI connection (later 2026-10-10 checkpoint)

The public form now accepts the server-owned intake enable flag and uses a serialized draft controller when enabled. Debounce is one second; requests have a ten-second timeout. An uncertain save retains the exact UUID/version/payload for retry before newer edits. Responses never overwrite newer typed answers. Conflicts retain local input and require an explicit Load saved draft confirmation. Expiry recovery rereads the new session before saving local answers and detects an existing different draft. Overlong text remains intact with a save error. Only confirmed persistence displays Saved.

Preview mode remains memory-only with no draft/session network calls; no flag was changed. A restored committed submission displays its receipt reference and does not submit again. Ordinary link navigation while dirty uses a shadcn confirmation; browser refresh/close uses beforeunload. Same-page anchors and modified/new-tab links are unaffected. Arbitrary programmatic routing/browser history cannot be assumed protected by the link guard; include those in final navigation review.

Forty focused controller/API/shared-form tests passed, as did scoped TypeScript/ESLint/import checks. A browser check on the verified frontpage localhost:3000 confirmed HTTP 200, the leave confirmation, preserved answers after cancellation, disabled submission and zero private preview requests. Screenshot: `/private/tmp/fiscal-unsaved-navigation.png`. Enabled UI plus migrated storage still needs combined integration review; separate controller/API/SQL results are not a completed guest journey. User appearance review precedes baseline updates.


## Applicant status and corrections — 2026-10-11

Pending `20261011090000_guest_fiscal_followup.sql` and `20261011100000_guest_fiscal_followup_notifications.sql` follow the existing guest migration chain. Neither is applied remotely. `/documentation/fiscal-sponsorship/application?application=<reference>` uses POST `/api/public/fiscal-sponsorship/application` to read status or submit requested corrections. Same-origin, signed HttpOnly capability, a verified unexpired database scope for that exact application, 64KB request bounds and 40 requests per 15-minute HMAC IP bucket apply. No account required; the reference is not a credential.

Only needs-info applications expose editable answer fields. Review notes are applicant-facing as stated by the existing staff review dialog; internal events, snapshots, metadata, reviewer IDs and host IDs remain private. Corrections use the existing strict submission validation, retain the verified contact email, enforce state/version under row locks and atomically update the same application and project name. The private RLS-protected revision records the prior application/review and request hash. A repeated UUID with identical answers returns the prior success without reverting a later review; changed requests and stale state fail. A failed event/outbox insert rolls back the whole correction. No profile import or account entitlement change occurs.

Follow-up outbox records are unique per event/kind/recipient. Applicant messages announce an update without including private answers or review notes. Joel receives resubmission alerts; the existing global milestone queue notifies Karissa. Initial receipt copy/key remain v2; update copy/key use `fiscal-guest-update-v1`. Frozen proof/link preparation accepts only the current unexpired lease for applicant receipts/updates. Reviewer update dispatch reuses assigned-staff recipient validation. Resubmission, approval, decline or needs-info do not themselves send mail inline: disabled workers must later claim the committed outbox jobs.

The page reuses the existing form style. Verified contact email is read-only, failed/uncertain corrections remain in memory, and exact retries cannot create another project. Navigation/discard warnings protect unsent edits; correction drafts do not yet autosave. Expired browser access currently directs the applicant to their latest verification message or fs@coachhousesolutions.org. Automated replacement-link recovery and delivery reconciliation remain unfinished. All flags, production state and real provider delivery remain unchanged.


## Submitted-application access recovery — local, 2026-10-11

Pending `20261011110000_guest_fiscal_recovery.sql` adds recovery-keyed jobs to the existing private outbox and a service-only `request_fiscal_guest_recovery` RPC. Same-origin POST `/api/public/fiscal-sponsorship/recover` accepts only reference, email, request UUID and hCaptcha token. It requires intake/email activation and link-secret configuration, IP limit 10/15 minutes, email limit 3/day, and a ten-minute application cooldown. Unknown/mismatched/limited email requests receive identical 202 JSON. References and email alone never grant application access.

Queue retries retain the same recovery UUID and frozen proof material. Worker copy uses `fiscal-guest-recovery-v1/<job-id>`, contains no application answers/internal links, and requires the existing explicit scanner-safe verification action. A new request leaves existing proofs/sessions intact to avoid unauthenticated revocation. The public recovery page is excluded from analytics and has noindex/no-referrer metadata. Cross-device unsubmitted drafts, provider delivery reconciliation, connected email/auth/storage verification and access audits remain unfinished. All delivery/intake flags remain off; no migration or real email executed.


## Connected flow and provider delivery — local, 2026-10-11

`node supabase/tests/fiscal-final-schema-rls.test.mjs --guest --connected` now runs the migrated database assertions and the actual guest handlers through one draft/submission/verification/correction/profile/recovery sequence. It uses the existing temporary database harness, not a new product environment. Only Captcha, Auth identity and email delivery are simulated; no network backend URLs or real recipients are used. This uncovered and fixed the Address line 2 adapter mismatch (`mailing_street_address_2`). Production/browser confirmation remains a separate check.

Pending migration `20261011120000_fiscal_email_delivery_tracking.sql` stores only verified provider event ID, message ID, event type and timestamps. The existing Resend endpoint still verifies the raw body and Svix signature before storage. Fiscal category events bypass raw campaign history; global bounce/complaint suppression remains intact. Service-only writes deduplicate and reject conflicting event IDs. The assigned-reviewer summary joins outbox provider IDs to receipts, so callbacks may precede worker acknowledgement; terminal outcomes cannot regress to sent/delayed. Unlinked receipts expire after 90 days in bounded batches; linked outcomes are retained with their outbox, preventing a known bounce from reverting to an accepted-only state. Events whose worker never acknowledged a provider ID require provider reconciliation before any manual resend; never reset an uncertain outbox blindly.

Resend documents [delivery event semantics](https://resend.com/docs/webhooks/event-types), [signed delivery payloads and category tags](https://resend.com/docs/webhooks/emails/delivered), and [webhook retry/replay behavior](https://resend.com/docs/webhooks/retries-and-replays). Delivered means recipient mail-server acceptance, not proof of reading/inbox placement. Failed storage responds 503 so the provider can retry. No provider webhook or schedule was configured.

Before eventual activation, apply both new migrations plus the preceding pending chain, then configure `FISCAL_EMAIL_TRACKING_ENABLED=true` independently of sending, subscribe the existing verified Resend webhook to sent/delivered/delivery_delayed/bounced/complained/failed/suppressed events, and verify delivery with controlled recipients. `FISCAL_STAFF_EMAILS_ENABLED=true` now separately enables Karissa's worker; it requires configured mail credentials and an HTTPS canonical site URL, and links to `/projects/<project-id>`. Guest sending remains behind `FISCAL_GUEST_EMAILS_ENABLED`. Keep tracking/retention running when sending is paused. All flags remain unchanged/off in this lane.

Pending migration `20261011130000_guest_fiscal_related_records.sql` intersects existing host policies on related tasks, notes, links, assets, overviews, activity, workstream and signing records. Guest browser writes require authorized server transitions. Storage checks cover canonical org/project paths before attachment creation and historical exact document/asset associations. No new read grants. Server guards separately reject general workspace actions on guest projects because elevated staff clients bypass RLS; the dedicated fiscal reviewer route retains its own assignment gate.

Remaining: real configured browser submission and provider/Auth confirmation; final general-action and free-tier audits; consolidated product review/release requirements. Current localhost points at production and remains preview-only. No replacement persistent testing environment, remote migration, real email/account, commit, push or deployment was made.
