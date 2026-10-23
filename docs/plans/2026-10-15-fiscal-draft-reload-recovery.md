# Fiscal application reload recovery

## Requirement and lane

Caleb reported fiscal draft-save failures during a production database overload, then explicitly requested that refreshing `/documentation/fiscal-sponsorship` preserve his answers. The database incident is being handled in another chat. This run owns reload recovery only; it does not change provider/database settings, Proxy, authentication, submissions, migrations or mail delivery.

Original workstream03 stages3/6, existing fiscal-completion checkout, `fix/fiscal-draft-recovery-20261015` from main `4e1e3681`. Deferred Proxy-test edits from the earlier interrupted investigation are preserved outside Git at the existing private fiscal receipt directory; they are excluded from this PR. Other checkouts/servers and shared SHIP40 owner-host blocker remain intact.

## Decision and behavior

The previous guest implementation deliberately kept unconfirmed answers only in memory. This dated user request supersedes that choice for the enabled public form: keep a bounded, seven-day recovery copy in this tab's sessionStorage. Do not use localStorage or capture internal application data, uploaded documents, account IDs, cookie capabilities or CAPTCHA tokens. Disabled preview remains memory-only. Browser storage is same-origin/tab accessible; this is not an encrypted vault or a new authorization mechanism.

Persist each field edit synchronously, including incomplete and bounded overlong text. Restore answers before the online read completes, so they remain visible during an outage. Preserve the last confirmed baseline and exact pending save/version/request ID. Read the server before replaying a recovered write; recognize an already committed write and safely save newer edits afterward. A changed server baseline produces the existing conflict state and requires an explicit choice before replacement. Do not mark an offline recovery copy as server-saved or permit submission through a failed flush.

Clear the copy after confirmed submission or explicit replacement/reversion; expire it on read after seven days, without extending retention on each keystroke. Closing a tab normally ends its page session; server-confirmed drafts retain their existing separate resume behavior. Storage denial/quota/corruption/oversize cannot break online saves or generate a false recovery guarantee. The old client in an already-open production tab cannot retroactively gain this feature: before refreshing it, confirm Saved online or copy its answers elsewhere.

[MDN sessionStorage](https://developer.mozilla.org/en-US/docs/Web/API/Window/sessionStorage) documents reload survival and page-session scoping. No schema/flag changes are required.

## Validation and handoff

Focused cases cover immediate pre-debounce capture, offline reload, initial-read failure, ambiguous writes, committed writes plus newer edits, baseline reconciliation, concurrent-tab conflict, explicit replacement, overlong input, submission cleanup, retention and blocked/corrupt storage, together with existing draft/controller/submission/public-intake checks. 84 cases across five files pass. Changed-file ESLint, structure, features, boundaries, acceptance manifest and diff checks pass. Full TypeScript still fails with 56 diagnostics across 13 unchanged acceptance-test files; no diagnostic names a changed source/test file. This is not a full typecheck pass. Normal prepush and Graphify status are recorded at PR handoff. User owns actual UI/production retest; no broad browser sweep, synthetic application, deployment or provider mutation. Existing localhost3127 is preserved, but current route readiness is not asserted without a fresh check.

Codex stops at an open PR after focused tests/lint/guardrails and normal prepush. Caleb owns hosted CI/review, merge, deployment and testing with the database recovered. Fiscal remains open until the real application/project/notification/email/account journey passes.


## PR321 review follow-up — stale recovery after failed writes

Confirmed Codex review on9624b907: quota/write errors, oversized envelopes and projection validation could leave a previously valid recovery record behind. Clear the recovery key on each failure path, including validation before calling the storage adapter. Current answers remain in memory, localBackup stays false, and reload cannot restore/autosave the older snapshot. Three new regressions failed before the fix and pass afterward;84focused cases across the five fiscal suites and changed-file ESLint/diff pass. No full TypeScript rerun or build; prior unrelated diagnostics remain. Same PR/branch, normal prepush and Caleb-owned release boundaries retained.
