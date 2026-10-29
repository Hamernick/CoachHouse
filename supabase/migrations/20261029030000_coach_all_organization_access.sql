-- Account-scoped access; assignments and platform roles remain independent.
alter table public.platform_staff_members
  add column if not exists can_access_all_organizations boolean not null default false;

comment on column public.platform_staff_members.can_access_all_organizations is
  'Allows this coach to access every organization, including those assigned to other coaches, without changing assignments or developer privileges.';
