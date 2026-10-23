# Remove fiscal sponsorship CAPTCHA

Workstream03 stages3/6. Caleb explicitly requested CAPTCHA removal after PR324's
new message confirmed verification remained unavailable. This supersedes the
prior CAPTCHA investigation and preservation requirement for fiscal intake.

Reuse the clean fiscal-completion checkout and actual localhost3127 on
`fix/fiscal-remove-captcha-20261015`, based on main `c79ce4da`.

## Scope

Remove the challenge widgets, client token state/validation, server provider
requests and CAPTCHA-key configuration dependency from fiscal submission and
application-link recovery. Update corrections' shared input adapter. Accept
optional ignored legacy tokens so older open forms remain API-compatible; new
forms send no token. No CAPTCHA dependency remains in fiscal runtime execution.

Preserve strict answer validation/body bounds, same-origin and trusted-IP checks,
signed HttpOnly guest capability, durable IP/email limits, receipt idempotency,
draft/reload recovery, private storage/RLS, email proof and account-claim rules.
Shared Auth CAPTCHA code/dependencies/settings remain outside this fiscal scope.
No migrations, provider settings, secrets, flags, deployments or production content
changes. No new UI container or visual-test fixture.

## Evidence and handoff

104 focused cases across eight files pass: submission/recovery without tokens or
keys/provider calls, legacy compatibility, IP/email limits, failed-save blocking,
retry idempotency, draft/reload preservation, private follow-up and email proof.
The default fiscal SQL/RLS command passes its role/access matrix, atomic guest
handoff assertions and one connected real-handler/storage journey with CAPTCHA
keys absent and all external network calls forbidden. Scoped lint, feature and
import-boundary checks pass. Normal prepush runs before PR handoff.

Caleb owns hosted gates/review, merge/deployment and the real application/mail
test. After deployment refresh the fiscal page to replace any old challenge UI;
the existing server-saved draft and same-tab recovery preserve answers. No new
Vercel variables or CAPTCHA troubleshooting are required. Stop at the open PR;
shared SHIP40 owner-host blocker and other worktrees/servers stay unchanged.
