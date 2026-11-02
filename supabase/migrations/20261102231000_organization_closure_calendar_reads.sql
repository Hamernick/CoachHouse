-- Calendar bearer URLs and current RLS readers join closure. No closure activation.
begin;
do $$ begin
 if exists(select 1 from public.organization_closures where state='closing') then
  raise exception 'Reconcile active closures before calendar reader upgrade'; end if;
end $$;
-- Durable publication withdrawal, separate from private event content. Cancellation
-- cannot revive old events. A later explicit publication workflow must reconcile it.
create table public.organization_calendar_publication_revocations (
 event_id uuid primary key references public.roadmap_calendar_public_events(id) on delete cascade,
 org_id uuid not null references public.organizations(user_id) on delete cascade,
 revoked_at timestamptz not null default clock_timestamp()
);
alter table public.organization_calendar_publication_revocations enable row level security;
alter table public.organization_calendar_publication_revocations force row level security;
revoke all on public.organization_calendar_publication_revocations from public,anon,authenticated,service_role;
create function public.close_organization_calendar_access() returns trigger
 language plpgsql security definer set search_path='' as $$
begin
 if new.state<>'closing' then return new; end if;
 if tg_op='UPDATE' and old.state='closing' then return new; end if;
 perform 1 from public.organizations where user_id=new.org_id for update;
 delete from public.roadmap_calendar_public_feeds where org_id=new.org_id;
 delete from public.roadmap_calendar_internal_feeds where org_id=new.org_id;
 insert into public.organization_calendar_publication_revocations(event_id,org_id)
  select id,org_id from public.roadmap_calendar_public_events where org_id=new.org_id
  on conflict(event_id) do nothing;
 return new;
end $$;
revoke all on function public.close_organization_calendar_access() from public,anon,authenticated,service_role;
create trigger organization_closure_calendar_access after insert or update of state on public.organization_closures
 for each row execute function public.close_organization_calendar_access();

create function public.can_read_calendar_during_closure(p_org uuid,p_public_event uuid default null)
 returns boolean language plpgsql security definer set search_path='' as $$
declare private_reader boolean; closing boolean;
begin
 if current_setting('transaction_isolation')<>'read committed' then return false; end if;
 -- RLS also runs for UPDATE selection; never wait on an org while holding an
 -- event tuple. Denied/busy reads expose no rows and are safe to retry.
 perform 1 from public.organizations where user_id=p_org for share nowait;
 if not found then return false; end if;
 private_reader:=auth.uid() is not null and (auth.uid()=p_org or public.is_admin());
 if not private_reader and auth.uid() is not null then
  perform 1 from public.organization_memberships where org_id=p_org and member_id=auth.uid() for share nowait;
  private_reader:=found;
 end if;
 closing:=public.guard_organization_closure(p_org,private_reader);
 if private_reader then return true; end if;
 return p_public_event is not null and not closing
  and not exists(select 1 from public.organization_calendar_publication_revocations where event_id=p_public_event)
  and exists(select 1 from public.organizations where user_id=p_org and is_public_roadmap);
exception when insufficient_privilege or lock_not_available then return false;
end $$;
revoke all on function public.can_read_calendar_during_closure(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function public.can_read_calendar_during_closure(uuid,uuid) to anon,authenticated;
-- Preserve original owner/admin/member/public-roadmap authority through the
-- private helper; anonymous evaluation no longer needs membership-table grants.
drop policy roadmap_calendar_public_events_select on public.roadmap_calendar_public_events;
create policy roadmap_calendar_public_events_select on public.roadmap_calendar_public_events
 for select to anon,authenticated using(public.can_read_calendar_during_closure(org_id,id));
create policy calendar_closure_read on public.roadmap_calendar_internal_events as restrictive
 for select to authenticated using(public.can_read_calendar_during_closure(org_id));
create policy calendar_closure_read on public.organization_workspace_calendar_revisions as restrictive
 for select to authenticated using(public.can_read_calendar_during_closure(org_id));

create function public.read_roadmap_calendar_feed(p_token text,p_type text)
 returns jsonb language plpgsql security definer set search_path='' as $$
declare org uuid; locked_org uuid; events jsonb;
begin
 if p_token is null or length(p_token)<1 or length(p_token)>512 or p_type not in ('public','internal') or p_type is null then return null; end if;
 if current_setting('transaction_isolation')<>'read committed' then return null; end if;
 if p_type='public' then select org_id into org from public.roadmap_calendar_public_feeds where token=p_token;
 else select org_id into org from public.roadmap_calendar_internal_feeds where token=p_token; end if;
 if not found then return null; end if;
 perform 1 from public.organizations where user_id=org for share nowait;
 if not found then return null; end if;
 perform public.guard_organization_closure(org);
 -- Recheck token under lock; rotation/revocation cannot race successful admission.
 if p_type='public' then
  select org_id into locked_org from public.roadmap_calendar_public_feeds where token=p_token and org_id=org for share;
 else
  select org_id into locked_org from public.roadmap_calendar_internal_feeds where token=p_token and org_id=org for share;
 end if;
 if not found or locked_org is distinct from org then return null; end if;
 if p_type='public' then
  select coalesce(jsonb_agg(to_jsonb(e) order by e.starts_at,e.id),'[]') into events from (
   select id,title,description,event_type,starts_at,ends_at,all_day,status,updated_at
   from public.roadmap_calendar_public_events where org_id=org and status='active'
    and not exists(select 1 from public.organization_calendar_publication_revocations r where r.event_id=roadmap_calendar_public_events.id)
  ) e;
 else
  select coalesce(jsonb_agg(to_jsonb(e) order by e.starts_at,e.id),'[]') into events from (
   select id,title,description,event_type,starts_at,ends_at,all_day,status,updated_at
   from public.roadmap_calendar_internal_events where org_id=org and status='active'
  ) e;
 end if;
 return events;
exception when insufficient_privilege or lock_not_available then return null;
end $$;
revoke all on function public.read_roadmap_calendar_feed(text,text) from public,anon,authenticated;
grant execute on function public.read_roadmap_calendar_feed(text,text) to service_role;
comment on function public.read_roadmap_calendar_feed(text,text) is
 'Atomic bearer-token/current-closure calendar projection. Closure revokes both feed types durably. Already returned bytes cannot be recalled; provider synchronization is separate.';
commit;
