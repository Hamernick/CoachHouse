# FiscalSponsorship Feature

## Ownership

- Domain logic: `src/features/fiscal-sponsorship/lib/**`
- Server actions/queries: `src/features/fiscal-sponsorship/server/**`
- UI components: `src/features/fiscal-sponsorship/components/**`
- Hooks/controllers: `src/features/fiscal-sponsorship/hooks/**`

## Rules

- Keep route files in `src/app/**` as composition-only wrappers over this feature.
- Import other features only through their public entrypoint (`@/features/<name>`).
- Keep `lib/**` pure: no React, no UI imports, no route imports.
- Keep `server/**` free of UI/component imports.
- Keep shared UI in `src/components/ui/**`; avoid one-off primitives here.
- Keep acceptance coverage in `tests/acceptance/fiscal-sponsorship.test.ts`.
- Add acceptance tests for user-visible behavior before merging.

## Workflow Notes

- The admin prototype still uses static step data for interaction testing, but
  production surfaces should use persisted application, document, signature, and
  event state.
- The real workflow can now create DocuSeal signing submissions and accept signed
  DocuSeal webhooks at `/api/webhooks/docuseal`. Completed DocuSeal webhooks
  store the executed agreement and available audit certificate in
  `project-assets`, register them as project assets, and link them back to the
  signature packet.
- The organization detail workbench resolves DocuSeal submitter signing URLs
  from stored provider payloads and exposes the private project-asset viewer and
  download URLs for generated, executed, and audit documents. Keep signing in
  DocuSeal unless a future requirement explicitly needs in-app PDF annotation.
- Fiscal document uploads reuse `project-assets` and are classified through
  `fiscal_sponsorship_documents.document_key` for tax, formation, budget,
  fundraising, insurance, grant request, and additional-information support.
- The intended real version should generate application/agreement/grant request
  documents from persisted applicant data, route signable documents through
  DocuSeal, and store executed files plus audit metadata in Documents.

## Public entry

`/documentation/fiscal-sponsorship` houses the public guest application. `/fiscalsponsorship` permanently redirects there. No account is required to submit. A successful submission atomically creates a private staff project, fiscal application, assigned reviewers and notification jobs. Receipt email verification unlocks the applicant status/corrections view without creating an account.

PR #310 implements optional signup/profile reuse and durable linked-account return. `FISCAL_GUEST_PROFILE_IMPORT_ENABLED` gates both the optional import UI and later account-based application access. The profile-import and own-claim/index migrations are already recorded as applied; do not replay older migration checklists. This does not establish that the production flag is enabled or the real journey has passed.

Use [the current completion/release handoff](../../../docs/plans/2026-10-15-fiscal-sponsorship-completion.md) for exact settings, scheduler authorization precedence, signed delivery setup, rollback and the user-controlled application/inbox journey. Public submission, sending, tracking and retention have independent flags. Codex delivers the PR; Caleb owns hosted checks/review, configuration, deployment and production testing unless explicitly delegated.
