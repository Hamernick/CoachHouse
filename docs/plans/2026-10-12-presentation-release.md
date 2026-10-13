# Presentation release sprint — October 12

User now authorizes shipping public surfaces and a working guest fiscal MVP; this supersedes earlier no-release/preview-only direction. Target preparation in 15 minutes, use remainder of 45-minute window for gates/deployment/live review. No bypass of quality/security/review gates.

- [x] Scope: homepage, Resources, public Documentation/redirects, Build and pricing.
- [x] Remove competing free-profile/gating work; other branch owns onboarding.
- [x] Independently gate optional fiscal signup/profile import off for this MVP.
- [x] Add private guest Overview and atomic initial reviewer notifications.
- [x] Validate connected database, reviewer isolation, notifications and focused public routes.
- [x] Review pending migration dependency chain, apply only needed migrations with intake off, verify ledger and RLS.
- [x] Configure internal host/reviewers, delivery/retention scheduling and secrets.
- [ ] Activate submission/email flags after release gates; verify actual delivery. Provider webhook tracking remains separately disabled.
- [x] Commit/sync main and scan outgoing changes for secrets; PR #286 merged by Caleb as `7989b377`.
- [ ] Complete current-head hosted quality/review and affected Linux visuals in follow-up PR #289.
- [x] Deploy public pages: Vercel production `dpl_AuzbNEqTBB5Ttpqym5bAun5Sxv2m` Ready on `7989b377`; all six public routes return 200.
- [ ] Activate guest submission/email only after remaining release checks.
- [ ] Live controlled submission: one project, filled fiscal view, overview, two reviewer notifications and three emails; retry makes no duplicates.

Deferred: optional profile import/new onboarding connection, final media/copy polish. Thirteen migrations are applied; all fiscal tables have RLS. Host/reviewer setup and production secrets/schedules are configured. Intake, UI submission and sending flags remain false; no real application or email delivery is claimed.

Production browser review confirms the new Build/menu and Resources interfaces and the fiscal preview with disabled submission. Unauthorized worker requests return 401; guest session/submission requests return 503 while disabled. Database inspection found zero guest submissions or email jobs.

PR #286 was manually merged before aggregate quality passed. Static, acceptance and RLS pass; Next compilation passed but `/admin` initial JavaScript exceeded its 1000 KB budget by 0.7 KB. Visual assertions still targeted the removed homepage drawer. Caleb also merged PR #287 as `408b36c6`; Vercel deployment `dpl_J7WjhGkVocm9R6uvQ7UsU1ZRZFJQ` is Ready. Its hosted static/acceptance/RLS/build/performance checks pass (admin 994.4 KB). PR #289 contains remaining browser contract and reviewed Linux reference corrections. It must pass required checks and independent review before merge. Do not interpret the deployed public pages as fiscal MVP sign-off.

Activation after gates:
1. Verify the deployed main SHA, then enable `FISCAL_GUEST_INTAKE_ENABLED`, `FISCAL_GUEST_SUBMISSION_UI_ENABLED`, `FISCAL_GUEST_EMAILS_ENABLED`, and `FISCAL_STAFF_EMAILS_ENABLED` in production.
2. Redeploy that verified production revision to pick up environment changes. Keep profile import and provider delivery-webhook tracking disabled.
3. Verify guest session creation, draft save/reload, input validation and CAPTCHA without bypassing verification.
4. Caleb submits one controlled application. Verify exactly one private project, populated Fiscal Sponsorship and Overview, Karissa/Joel assignment and in-app notifications.
5. Verify applicant receipt and both reviewer emails. Provider acceptance is distinct from inbox delivery. Retry must not duplicate the project or messages.

Latest scoped verification: Linux reference run `38293346933` passes all 59 public/Documentation/shared-shell cases at `c7716611`. All intended reference changes were visually reviewed; screenshot tolerances unchanged. PR #289 contains the final references; complete current-head quality and independent review remain required. Three pre-existing Workspace Tools snapshot failures (Stripe row removal from the internal lane) remain outside this task and block the aggregate gate. No fiscal production flag was enabled.

October 12 reconciliation: PR #288 merged as `73dd8d15`; its onboarding/free-workspace implementation remains the owning implementation. PR #289 is ready for review and incorporates main with workflow/log conflicts reconciled. Fiscal flags were not changed. See [consolidated product checklist](2026-10-12-public-product-master-checklist.md) for development versus activation work.
