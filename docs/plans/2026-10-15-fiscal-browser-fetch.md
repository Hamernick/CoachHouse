# Fiscal draft browser fetch receiver

## Reproduction and cause

Caleb still cannot submit despite completed fields/CAPTCHA and the database recovery. A fresh actual production form reproduces the generic draft-save error before any answers or CAPTCHA interaction. Direct live HTTP probes return session200 in367ms and draft read200 in273ms with an empty draft; no answers, applications or emails were created. This isolates a client-startup defect rather than proving every possible account-specific request healthy.

GuestDraftController.post calls the captured native fetch as `this.transport(...)`. That supplies a controller instance as the receiver, which native browser fetch rejects as an illegal invocation before a network request. The existing catch maps that exception to the generic save error and does not log it. Node/mock fetch did not enforce browser receiver rules, so previous focused tests missed it. CAPTCHA/field validation are separate; submission intentionally refuses to proceed through an unconfirmed draft flush.

## Scope

Original03 stages3/6; existing fiscal-completion checkout, new fix/fiscal-browser-transport-20261015 from main80918081 (includes PR321). Detach the transport into a local function before invoking it. Keep URL, body, credentials, cancellation, server authz/capabilities, persistence, conflict checks and submission guards unchanged. No migration/flag/provider/data/email change, default redesign or visual fixture. Preserve existing3127 server and other lanes.

## Checks and handoff

Added a receiver-sensitive regression covering session, read, save acknowledgement and submit flush. It fails before the fix and passes afterward.85focused cases across controller/recovery/draft/submission/public-intake pass, with changed-file ESLint and diff hygiene. No full TypeScript/build/quality rerun; prior unrelated diagnostics remain. Native Chromium independently confirms the original method call throws “Failed to execute fetch on Window: Illegal invocation” and a detached call succeeds. A separate ephemeral headless browser against the actual localhost3127 form reaches session200/draft200 and displays “Your draft will save as you type.” No form field was entered or submitted. Initial CUA/dev-compilation observations were inconclusive; they are not substituted for this final native-browser evidence. Graphify refreshed (21,346 nodes/61,409 edges). User owns final real production application/inbox testing; do not submit synthetic applications, solve CAPTCHA, deploy, merge or poll hosted CI.

References: [Fetch method](https://fetch.spec.whatwg.org/#fetch-method), [maintainer report of the same receiver defect](https://github.com/tada5hi/hapic/issues/1045). The code/test evidence establishes this patch; the analogous report is supporting context, not a substitute for reproduction.
