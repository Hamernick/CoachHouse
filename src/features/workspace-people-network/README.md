# People network

Compact, collapsible ring view above the existing People table. Rings are saved
segments or tags, not inferred relationship strength or availability. Search,
role and selected-segment filters come from the existing People controls.

## Interaction

- Segment/tag switch, responsive group paging, labeled rings, avatar initials or
  photos, hover names, and bounded/searchable group lists for overflow contacts.
- Click an avatar for contact editing/viewing, Add to canvas, Move to group, or
  removal from the current group. Shared Popover/Dropdown primitives provide
  keyboard and touch alternatives to native desktop drag/drop.
- Drag between rings to move that membership. Drag outside the window onto the
  canvas using the same existing person payload and placement flow as table rows.
- A contact can appear on more than one ring. Moving removes only the source
  membership; other memberships remain. Ungrouped checks every saved group,
  including groups on other pages. Dropping there removes only the source group.
- Group changes and filter/layout transitions animate; reduced motion is honored.
  Pending saves disable competing graph actions; failures are announced inline.

## Persistence and access

No new schema or provider. The table owner passes its existing authenticated
segment/tag actions and person editor. Membership add/remove hooks return a
confirmed result and roll back optimistic state on server/transport failure.
Destination membership saves before source removal. If removal fails, both
memberships remain with an explicit partial-failure message; retry is idempotent.
Existing server authorization, organization membership checks and RLS still apply.
The view does not change sharing or infer contacts not already loaded by People.
Canvas placement retains the existing persistence behavior.

## Verification

Acceptance tests cover filtering, overlap, ungrouped membership across pages,
collision spacing and overflow, confirmed write ordering, failed/partial moves,
empty/loading states and accessible contact controls. Authenticated browser
acceptance remains separate: edits/reload, native drag onto each ring and canvas,
read-only access, narrow layouts, reduced motion and focus restoration.
