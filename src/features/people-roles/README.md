# People roles

Search existing roles or create an organization-specific role from the People
role cell or contact form. The table filter also searches built-in and assigned
custom roles. Shared Select primitives are unchanged.

## Persistence and access

- `organizations.profile.people_roles` stores reusable custom role labels.
- `org_people[].customRole` stores the assignment. The existing `category` remains
  the contact's grouping for the org chart and category segments.
- Creating/selecting a custom role in a table cell saves immediately. Contact
  forms save the role with the contact; canceling creates nothing.
- Case-insensitive matching and whitespace normalization prevent duplicates;
  labels are limited to 60 characters. Built-in names resolve to their category.
- Choosing a built-in role clears the assignment but preserves the custom role
  in the organization's catalog for reuse.
- The existing authenticated People actions enforce active-organization access
  and editing permissions. Catalog reads use the same session and RLS.
- Catalog and contact changes share the existing revision-checked profile writer,
  preserving concurrent edits. No migration or external service is required.

## UI

`PersonRolePicker` composes shared Popover/Command/Button primitives, with search,
keyboard navigation, selected state, explicit creation, loading and save errors.
The table keeps compact rounded corners and a read-only label for viewers.
Catalog requests occur only when opening a picker and have no cross-org cache.

## Validation

`tests/acceptance/people-roles.test.ts` covers creation, reuse, persistence,
permissions, membership checks, validation, legacy edits and filtering.
`people-profile-write-concurrency.test.ts` covers simultaneous catalog writes.
Authenticated browser interaction and mobile visual review remain manual gates.
