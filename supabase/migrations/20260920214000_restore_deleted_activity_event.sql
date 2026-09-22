-- Document/file activity must retain the existing project/task deletion event.
-- Expand the constraint only; no historical events or project rows are changed.
alter table public.organization_project_activity_events
  drop constraint organization_project_activity_events_event_type_check,
  add constraint organization_project_activity_events_event_type_check
    check (event_type in (
      'created', 'status_changed', 'scheduled', 'published', 'completed',
      'updated', 'deleted', 'uploaded', 'removed', 'restored'
    ));
