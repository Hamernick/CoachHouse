# Google privacy and independent Drive disconnect release

## Release scope

Publish the reviewed Google Drive and Calendar privacy disclosures at `/privacy`
and bind new signup consent to document version `2026-09-10.1`. The Terms body
is unchanged; its date, version and content hash move with the bundled policy.
Drive disconnect also stops revoking the entire Google project grant, preserving
the user's other Google integrations as the policy describes. Full account
deletion explicitly retains best-effort Google revocation before local cleanup.

Candidate branch: `fix/google-integration-privacy-20260911`, based directly on
remote `main` at `67501039f5a79db95db87f6ad4842b640a537195`.
Checkout: `/Users/calebhamernick/Development/coach-house-platform-google-privacy-release-20260911`.

The candidate contains three legal-document files, two Drive/account-deletion
implementation files, two compatible consent migrations, eight regression-test
files and one browser-test configuration file, plus this release record and runlog.
The policy/migration files match the rehearsed development checkout. The Drive
switch reuses its local-only behavior, with explicit provider revocation retained
for full account deletion following review. No Calendar
implementation, scheduler, credentials, dependencies or unrelated development
changes are included. Recording continues against the prepared localhost demo.

The two migration files preserve repository history for changes already applied
to the shared database. A read-only query on September 11 confirms both
`20260909150000` and `20260910120000` are recorded. Do not run a broad database
push or reapply them. Existing consent rows and August 12, August 27 and
September 9 version/hash combinations remain valid.

## Why this is a separate release

The Documents/Calendar integration is 136 commits and 755 changed files ahead of
public `main`, before the latest privacy delta. Draft consolidation PR #229 still
conflicts with its base. Publishing that development branch would include
unrelated features. The privacy release starts directly from the current
production code and has no dependency on that consolidation.

## Validation

Independent full `pnpm check:quality` runs validate the demo and final release:

- Combined demo integration with the exact eight-file September 10 privacy delta,
  on browser fixture port 3023: all 21 stages passed in 922.50 seconds, including
  2,530 acceptance tests and 155 browser tests.
- Scoped production candidate, on browser fixture port 3024: all 21 stages passed
  in 439.98 seconds, including 2,290 acceptance tests and 45 browser tests.

Both checkouts have real locked dependency installations, no environment files
or provider credentials, one browser worker and no browser retries. Each gate
includes static checks, snapshots, acceptance, isolated PostgreSQL tests, build,
browser regressions and performance budgets. The generic connected Supabase
fixture writer skips without credentials; it does not write to production.

The first privacy-only run passed static, acceptance, database and build stages,
but its older browser configuration ignored `PLAYWRIGHT_PORT` and targeted port
3000. It was stopped after public/fixture-page checks; no authenticated session
or real workspace mutation was used. The candidate now reuses the existing
development test configuration, which honors the requested port and worker count.
The completed final gate used port 3024 with one worker. No screenshot baseline
was changed to accommodate that environment failure.

Final source review found a policy/behavior mismatch in production's Drive
disconnect: it still called Google's revoke endpoint. Google's documented
[token revocation behavior](https://developers.google.com/identity/protocols/oauth2/web-server#tokenrevoke)
invalidates all clients' grants under the project. Normal Drive disconnect now
clears its stored credentials without revoking that shared grant. PR #233 review
identified account deletion as a separate caller that must retain revocation;
it now explicitly requests best-effort provider revocation. Local credentials
are cleared even if Google is unavailable or the stored key cannot be read.
Regressions use valid synthetic AES-GCM credentials to verify default disconnect,
explicit local disconnect, account deletion and a provider outage. Three review
regressions failed before the follow-up and all 43 focused Drive/routes/account/
legal/auth tests pass afterward. The final full gate includes these changes.

An interrupted browser startup initially returned a fixture-page 404. Its generated
Next cache was preserved outside the checkout, then the complete gate passed from
a fresh cache. No application code or screenshot baseline changed for this recovery.

The scoped release ran seven isolated PostgreSQL suites; the combined demo ran
eight, including Calendar credential/event isolation through the Drive harness.
Each acceptance run has one existing intentional skip. The generic connected
Supabase fixture writer skipped in both environments because credentials are
absent. These runs did not create shared database users or provider test records.

Chrome also verified the built candidate on port 3035: `/privacy` displays
`2026-09-10.1`, separate Google Sign-In/Drive/Calendar sections and a working Drive
anchor. Signup's Terms and Privacy links open the current documents in new tabs;
its consent remains unchecked and no account was submitted. That temporary server
has been stopped. PR #233 provides the hosted review preview.

Evidence lives in the canonical root under
`test-results/google-verification-release-20260911/`: immutable input manifests,
source patches, release baseline, complete logs and quality timing artifacts.

## Deployment and rollback baseline

Live `coachhouse.app` was inspected in Chrome on September 11. Its policy is
still `2026-08-27.1`, with a Google Sign-In section and no separate Drive or
Calendar sections. Vercel marks this deployment **Production / Current / Ready**:

- Team/project: `calebs-projects-58ab1538/coachhouse`.
- Deployment: `dpl_5RR6YMHg1FmgUXqtwnqtjTssQGhP`.
- Source: `67501039f5a79db95db87f6ad4842b640a537195`.

GitHub also records a successful deployment for the secondary
`coach-house-platform` project at this commit. Its dashboard returns Not Found
in the current account, so its current deployment is not independently verified.

Main requires the aggregate `quality` check and one approving code-owner review.
Use an ordinary focused PR and preserve that review requirement. Do not merge
the consolidation PR or bypass protection to publish this policy.

After the reviewed release, verify both hosted check outcomes and the exact
production source commit, then inspect `/privacy`, `/terms` and signup links.
Confirm version `2026-09-10.1` and the separate Google Sign-In, Drive and Calendar
sections. No real signup is needed for the public route smoke check.

If application rollback is required, prefer a forward repair or policy-only
revert that retains the independent Drive disconnect protection. The recorded
prior deployment still has the old project-wide revocation behavior.
Retain the compatible database function
and immutable consent records; do not roll back the database or delete evidence.

## Recording continuation

Once the public policy is verified, finish the ten-second recorder crop/audio/
notification test, film the rehearsed flows with `caleb@bandto.com`, review the
actual footage, then upload it as unlisted. Add the real URL and corrected scope
justification to Google's verification request and resolve its app-name appeal.
The demo files, Vision draft and working Google connections must remain intact.
