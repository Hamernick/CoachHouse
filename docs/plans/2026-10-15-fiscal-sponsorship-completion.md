# Fiscal sponsorship completion and release handoff

**Current continuation:** [October16 checklist closeout](2026-10-16-checklist-continuation.md) supersedes older current-status paragraphs below. Runtime PRs291–329 are merged; coachhouse deployment reports success for82a88202. Fiscal staff email, reviewer filtering and remaining user acceptance stay open; then Calendar and formation verification. See the handoff for preserved branches, data holds and testing gaps.


Current lane: original Desktop workstream03, stages3–6 / LIVE-07. Fiscal stays ahead of Calendar and formation verification. Preserve completed credit corrections, public-map work and other lanes.

## Current boundary — October 15

Caleb owns hosted checks/review, merge, Vercel settings, deployment and production verification. Codex stops at the open PR after focused local checks and normal pre-push hooks. No production activation, mail, test application or provider mutation is authorized by this checklist. Further release work requires explicit delegation.

Fiscal implementation PR [#310](https://github.com/Hamernick/CoachHouse/pull/310) is merged at `a0f1c7fb`. The clean fiscal checkout was synchronized to main `9784757b`, including patches #311–314, on local `chore/fiscal-activation-20261015`. The old local fiscal feature branch is preserved; do not recreate its deleted remote branch or replay the merged implementation.

Actual app: <http://localhost:3127/documentation/fiscal-sponsorship>. Localhost uses production Supabase, with task-local sending disabled. Caleb owns interactive testing. After the latest cache regeneration the server started, but the first route request exceeded 60 seconds during compilation; current page availability is not established by the earlier HTTP200 evidence.

Bandto Chrome and authenticated Vercel dashboard access were confirmed October 15. The old CLI403/no-browser checkpoint is historical. Production variable values and current deployment status were not reverified; dashboard access does not prove activation.

## Implemented

- Account/payment-free guest intake, resumable drafts, rate limits and idempotent submission; optional signup and “Not now.”
- One private staff project/application with Fiscal/Overview, fs/Joel assignments and initial in-app notifications.
- Applicant receipt/proof/recovery, Joel submission/correction mail and fs milestone mail; durable jobs, leases, idempotency keys and retry records.
- Verified guest status/corrections and confirmed explicitly linked account return after guest-cookie expiry. Same email alone grants no access.
- Selected-only private name/description/email/phone import and explicit open at `/workspace?drawer=organization`; no automatic publication, paid access, onboarding completion or internal-host membership.
- Signed delivery callbacks and independent retention.

Own-claim/index migrations `20261015040000` and `20261015041000` were applied and independently verified. Do not replay. Prior validation:184focused cases and default fiscal SQL/RLS/connected harness passed. These are implementation evidence, not production verification or current hosted gate results. Historical unrelated `/admin` bundle-budget and broader TypeScript failures remain recorded in the October runlog; Caleb assesses current hosted results.

Private migration/Auth before/apply/verify/rollback receipts remain at `~/.local/share/coach-house/fiscal-completion/2026-10-15/`. Two temporary 3127 Auth callback entries were added and verified; remove only those entries when retiring this lane. Preserve concurrent and production callbacks.

## Production settings — Caleb applies

In the existing Vercel `coachhouse` project, open Settings → Environment Variables and select **Production**. Confirm existing values privately; never paste credentials into Git or chat. This table is the intended configuration, not an observation of current saved settings.

| Variable | Intended value / prerequisite |
| --- | --- |
| `NEXT_PUBLIC_SITE_URL` | `https://coachhouse.app` |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | Existing production project credentials |
| `FISCAL_GUEST_RISK_SECRET` | Stable private secret, at least 32 characters; preserve existing value |
| `FISCAL_GUEST_LINK_SECRET` | Stable private proof-signing secret, at least 32 characters; preserve existing value |
| `RESEND_API_KEY` | Existing authorized sending key; shared sender falls back to `RESEND_AUTH_EMAIL_API_KEY` when absent |
| `RESEND_FROM_EMAIL` | Existing verified Resend sender; preserve approved identity |
| `RESEND_FROM_NAME`, `RESEND_REPLY_TO_EMAIL` | Preserve approved sender/reply settings |
| `CRON_SECRET` | Vercel scheduler bearer secret, matching the fiscal authorization check below |
| `RESEND_WEBHOOK_SECRET` | Secret for the existing signed Resend endpoint; preserve existing callbacks |
| `FISCAL_GUEST_RETENTION_ENABLED` | `true`, independent of intake/sending |
| `FISCAL_EMAIL_TRACKING_ENABLED` | `true` after the signed webhook is configured, before fiscal mail is sent |
| `FISCAL_GUEST_INTAKE_ENABLED` | `true` after prerequisites and intended revision are ready |
| `FISCAL_GUEST_SUBMISSION_UI_ENABLED` | `true` to expose submission; intake must also be enabled |
| `FISCAL_GUEST_EMAILS_ENABLED` | `true` after sender, scheduler and delivery tracking are ready |
| `FISCAL_STAFF_EMAILS_ENABLED` | `true` after the same mail prerequisites |
| `FISCAL_GUEST_PROFILE_IMPORT_ENABLED` | `true` for optional profile linking/import and later linked-account access; Caleb verifies matching-account flow |

Scheduler authorization in `staff-email-dispatch.ts` checks **`INTERNAL_CRON_SECRET` first**, then `CRON_SECRET`. Vercel's configured scheduler bearer must equal the effective expected value. If both variables exist with different values, built-in cron requests can fail401. Reconcile their consumers before changing shared secrets; do not rotate or delete one blindly.

Existing schedules in `vercel.json`:

| Route | UTC schedule | Effect |
| --- | --- | --- |
| `/api/internal/cron/fiscal-guest-notifications` | Every minute | Applicant/reviewer mail |
| `/api/internal/cron/fiscal-notifications` | Every minute | fs milestone mail |
| `/api/internal/cron/fiscal-guest-draft-retention` | `17 3 * * *` | Expired drafts/proofs and enabled delivery-event retention |

**Mail cron GET requests perform sends.** Inspect configuration/records; do not invoke them as read-only smoke tests. Retention GET also deletes expired records. Do not manually run either for this documentation handoff.

## Activation order — Caleb operates

1. Review the intended revision's required checks/reviews; confirm the production database is the already-migrated project and the private host plus fs/Joel reviewers remain configured. Do not infer this from old zero-submission counts.
2. Confirm canonical origin, stable secrets, verified sender and matching scheduler bearer. Keep submission/mail paused until these are ready.
3. Configure the signed Resend endpoint `https://coachhouse.app/api/webhooks/resend` with its matching secret and fiscal events: `email.sent`, `email.delivered`, `email.delivery_delayed`, `email.bounced`, `email.complained`, `email.failed`, `email.suppressed`. Preserve other existing consumers. Enable tracking before fiscal sending: `fiscal-delivery.ts` returns an error for a recognized fiscal event while tracking is disabled. Record a genuine signed event from the controlled journey; configuration alone is not delivery proof.
4. Apply the intended flags above and redeploy the selected main revision to Production. Confirm the deployment is Ready and assigned to `coachhouse.app`; saved variables alone do not update an existing deployment. Codex does not trigger or poll this stage by default.
5. Run the controlled journey below. Keep private references/provider IDs outside Git. Stop and report any defect; Codex can prepare a focused fix PR.

## Controlled journey — Caleb tests

| Check | Required result |
| --- | --- |
| Guest application | Draft resumes; one real submission creates one private application/project without account/payment |
| Staff review | Fiscal/Overview populated; fs and Joel assigned; two initial in-app notifications |
| Mail | Applicant receipt/verification, Joel new-application alert and `fs@coachhousesolutions.org` milestone email |
| Retry | Ordinary retry does not duplicate projects/messages; do not reset uncertain jobs or repeat a purchase |
| Follow-up | Reviewer requests information; applicant verifies and corrects the same application; staff notified |
| Optional account | “Not now” preserves guest flow; new/existing email or Google account returns to the application; matching confirmed identity required |
| Selected import | Only selected contact/profile fields copy; existing unselected values and private review/legal/budget data remain unchanged |
| Later return | Linked applicant can find status/corrections after leaving; account access does not indefinitely depend on guest proof |
| Isolation | Other accounts and unassigned staff cannot view/correct private answers; same email alone does not grant access |
| Delivery | Provider acceptance, signed delivered/bounce events and actual inbox receipt recorded separately |

No agent-created synthetic production application or test email. No broad browser sweep or visual fixture. The user is the primary UI/inbox tester.

## Rollback and stop point

For an intake incident, Caleb pauses relevant submission/intake/sending flags and redeploys. Keep retention and configured tracking active for existing records/in-flight receipts. Preserve stable secrets, applications, proofs, outbox records, idempotency keys and uncertain provider IDs; never reset/replay uncertain mail blindly. A disabled profile-import flag also hides linked-account application entry, so use it deliberately.

Codex's stop point is this checklist PR. Fiscal remains **implemented, pending Caleb's activation and real journey**, not functionally verified in production. After Caleb confirms the journey, reconcile the original 03 packet/log/index; then continue Calendar → formation verification. Shared SHIP revision 40 owner-host blocker is preserved; this handoff does not force a new claim or waive release gates.


## October 15 — production outage and reload recovery follow-up

Caleb identified a database overload in another chat while testing draft persistence. That incident remains separate. New user requirement: a page refresh must preserve unconfirmed form answers. [Bounded same-tab recovery plan](2026-10-15-fiscal-draft-reload-recovery.md) changes the earlier memory-only fallback for the enabled public form, preserves server version/idempotency/conflict checks, and leaves activation/data/provider work untouched. The current old-client tab still needs an online Saved acknowledgement or a manual copy before refreshing. Codex hands off a focused fix PR; Caleb owns deployment and retest.
