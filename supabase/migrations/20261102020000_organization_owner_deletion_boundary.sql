-- Login deletion is not organization closure. Preserve the organization and
-- all cascading children until a separately authorized closure removes it.
-- A foreign key also serializes concurrent organization creation and Auth
-- deletion; an application preflight alone cannot establish that boundary.
begin;
alter table public.organizations
  drop constraint organizations_user_id_fkey,
  add constraint organizations_user_id_fkey
    foreign key (user_id) references auth.users(id) on delete restrict;
comment on constraint organizations_user_id_fkey on public.organizations is
  'Login deletion cannot close an organization. Explicit organization closure owns its lifecycle.';
commit;
