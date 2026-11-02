-- Canonical calendar writes only; feed reads and provider shutdown qualify separately.
begin;
create function public.guard_organization_calendar_closure() returns trigger
 language plpgsql security definer set search_path='' as $$
declare row_data jsonb; old_data jsonb; org uuid;
begin
 -- Revocation removes authority and must remain possible during closure.
 -- Existing table privileges/RLS still decide who may revoke a feed token.
 if tg_op='DELETE' and tg_table_name in ('roadmap_calendar_public_feeds','roadmap_calendar_internal_feeds') then return old; end if;
 if current_setting('transaction_isolation')<>'read committed' then
   raise exception 'Closure boundary requires read committed isolation' using errcode='40001'; end if;
 row_data:=case when tg_op='DELETE' then to_jsonb(old) else to_jsonb(new) end;
 org:=(row_data->>'org_id')::uuid;
 if tg_op='UPDATE' then
   old_data:=to_jsonb(old);
   if row_data->'org_id' is distinct from old_data->'org_id'
     or row_data->'id' is distinct from old_data->'id' then
     raise exception 'Calendar identity cannot change' using errcode='42501'; end if;
 end if;
 begin
   -- Event/revision writers can already hold tuples or the canonical board.
   -- Never wait on the lifecycle's org lock while holding those locks.
   perform 1 from public.organizations where user_id=org for share nowait;
   if not found then
     if tg_op='DELETE' then return old; end if;
     raise exception 'Organization unavailable' using errcode='42501';
   end if;
 exception when lock_not_available then
   raise exception 'Organization is changing; retry calendar edit' using errcode='40001';
 end;
 perform public.guard_organization_closure(org);
 if tg_op='DELETE' then return old; end if;
 return new;
end; $$;
revoke all on function public.guard_organization_calendar_closure() from public,anon,authenticated,service_role;
create trigger calendar_closure before insert or update or delete on public.roadmap_calendar_public_events
 for each row execute function public.guard_organization_calendar_closure();
create trigger calendar_closure before insert or update or delete on public.roadmap_calendar_internal_events
 for each row execute function public.guard_organization_calendar_closure();
create trigger calendar_closure before insert or update or delete on public.roadmap_calendar_public_feeds
 for each row execute function public.guard_organization_calendar_closure();
create trigger calendar_closure before insert or update or delete on public.roadmap_calendar_internal_feeds
 for each row execute function public.guard_organization_calendar_closure();
create trigger calendar_closure before insert or update or delete on public.organization_workspace_calendar_revisions
 for each row execute function public.guard_organization_calendar_closure();
comment on function public.guard_organization_calendar_closure() is
 'Serializes canonical events, feed issuance/rotation and calendar revision writes with closure. Authorized feed revocation and active-parent cascades remain. No public/private read, provider, purge or closure-transition authority is granted.';
commit;
