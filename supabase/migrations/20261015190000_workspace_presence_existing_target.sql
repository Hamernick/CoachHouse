-- Validate the target without an extra application/database round trip.
create or replace function public.sync_workspace_support_presence(p_org uuid,p_session uuid,p_path text,p_position jsonb default null,p_editing boolean default false)
returns jsonb language plpgsql security definer set search_path='' as $$
declare supported boolean; result jsonb;
begin
 supported := public.workspace_supports_org(p_org);
 if auth.uid() is null or not (supported or p_org=auth.uid() or exists(select 1 from public.organization_memberships where org_id=p_org and member_id=auth.uid())) then
 raise exception 'Workspace presence access denied' using errcode='42501'; end if;
 -- A fallback account ID is not necessarily a persisted organization.
 -- Hold the parent key through the upsert so concurrent deletion cannot race it.
 perform 1 from public.organizations where user_id=p_org for key share;
 if not found then
  raise exception 'Workspace presence target unavailable' using errcode='PT404';
 end if;
 delete from public.workspace_support_presence where seen_at < now()-interval '30 seconds';
 if supported then
  if length(p_path)>200 or p_path not like '/%' or
   (p_position is not null and (jsonb_typeof(p_position->'x') is distinct from 'number' or jsonb_typeof(p_position->'y') is distinct from 'number'
   or (p_position->>'x')::numeric not between 0 and 1 or (p_position->>'y')::numeric not between 0 and 1)) then
   raise exception 'Invalid workspace presence'; end if;
  insert into public.workspace_support_presence(org_id,session_id,actor_id,path,position,editing,seen_at)
   values(p_org,p_session,auth.uid(),p_path,p_position,p_editing,now())
   on conflict(org_id,actor_id,session_id) do update set path=excluded.path,position=excluded.position,editing=excluded.editing,seen_at=now();
 end if;
 select coalesce(jsonb_agg(row_to_json(participant)),'[]'::jsonb) into result from (
  select p.session_id,p.actor_id,coalesce(nullif(pr.full_name,''),'Coach House staff') as name,
   'Coach House support' as role,p.path,p.position,p.editing
  from public.workspace_support_presence p
  join public.workspace_support_grants g on g.user_id=p.actor_id and g.revoked_at is null
  join public.platform_staff_members s on s.user_id=p.actor_id and s.access_level in ('developer','coach')
  join auth.users u on u.id=p.actor_id and (u.banned_until is null or u.banned_until<now())
  left join public.profiles pr on pr.id=p.actor_id
  where p.org_id=p_org and p.seen_at>now()-interval '15 seconds'
  order by p.seen_at desc limit 20
 ) participant;
 return result;
end $$;
revoke all on function public.sync_workspace_support_presence(uuid,uuid,text,jsonb,boolean) from public,anon;
grant execute on function public.sync_workspace_support_presence(uuid,uuid,text,jsonb,boolean) to authenticated;
