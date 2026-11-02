\set ON_ERROR_STOP on
begin;
select public.fixture_closure_calendar();
set local role authenticated;
set local request.jwt.claim.sub='10000000-0000-4000-8000-000000000005';
do $$ begin
 if (select count(*) from public.roadmap_calendar_public_events)<>1
 or (select count(*) from public.roadmap_calendar_internal_events)<>1
 or (select count(*) from public.organization_workspace_calendar_revisions)<>1
 or exists(select 1 from public.roadmap_calendar_internal_feeds)
 or exists(select 1 from public.roadmap_calendar_public_feeds) then raise exception 'Member calendar visibility changed'; end if;
 update public.roadmap_calendar_internal_events set title='Unauthorized';
 if found then raise exception 'Read-only member wrote calendar'; end if;
end $$;
set local request.jwt.claim.sub='10000000-0000-4000-8000-000000000006';
do $$ begin
 if exists(select 1 from public.roadmap_calendar_public_events)
 or exists(select 1 from public.roadmap_calendar_internal_events)
 or exists(select 1 from public.organization_workspace_calendar_revisions) then raise exception 'Outsider read calendar'; end if;
end $$;
set local request.jwt.claim.sub='10000000-0000-4000-8000-000000000001';
update public.roadmap_calendar_internal_events set title='Owner edit' where org_id=public.fixture_form_id(1);
reset role;
do $$ declare target text; begin
 if (select title from public.roadmap_calendar_internal_events where org_id=public.fixture_form_id(1))<>'Owner edit' then raise exception 'Owner edit failed'; end if;
 foreach target in array array['roadmap_calendar_public_events','roadmap_calendar_internal_events','roadmap_calendar_public_feeds','roadmap_calendar_internal_feeds','organization_workspace_calendar_revisions'] loop
 begin execute format('update public.%I set org_id=public.fixture_form_id(999) where org_id=public.fixture_form_id(1)',target);
 raise exception 'Reparent admitted'; exception when insufficient_privilege then
 if sqlerrm<>'Calendar identity cannot change' then raise; end if; end;
 end loop;
 foreach target in array array['roadmap_calendar_public_events','roadmap_calendar_internal_events'] loop
 begin execute format('update public.%I set id=public.fixture_form_id(999) where org_id=public.fixture_form_id(1)',target);
 raise exception 'Event identity changed'; exception when insufficient_privilege then
 if sqlerrm<>'Calendar identity cannot change' then raise; end if; end;
 end loop;
end $$;
select public.fixture_closure('request',600,0);
set local role service_role;
do $$ declare target text; command text; begin
 foreach target in array array['roadmap_calendar_public_events','roadmap_calendar_internal_events','roadmap_calendar_public_feeds','roadmap_calendar_internal_feeds','organization_workspace_calendar_revisions'] loop
 foreach command in array array[
 format('insert into public.%1$I select * from public.%1$I where org_id=public.fixture_form_id(1)',target),
 format('update public.%I set org_id=org_id where org_id=public.fixture_form_id(1)',target),
 format('insert into public.%1$I select * from public.%1$I where org_id=public.fixture_form_id(1) on conflict do nothing',target)
 ] loop
 begin execute command; raise exception 'Closing calendar write admitted';
 exception when insufficient_privilege then if sqlerrm<>'Organization unavailable' then raise; end if; end;
 end loop; end loop;
 foreach target in array array['roadmap_calendar_public_events','roadmap_calendar_internal_events','organization_workspace_calendar_revisions'] loop
 begin execute format('delete from public.%I where org_id=public.fixture_form_id(1)',target);
 raise exception 'Closing calendar delete admitted'; exception when insufficient_privilege then
 if sqlerrm<>'Organization unavailable' then raise; end if; end;
 end loop;
 begin perform public.fixture_calendar_board_event(); raise exception 'Closing board event admitted';
 exception when insufficient_privilege then if sqlerrm<>'Organization unavailable' then raise; end if; end;
 update public.roadmap_calendar_public_events set title='Other edit' where org_id=public.fixture_form_id(2);
end $$;
reset role;
-- Revocation uses production RLS, not a privileged-only bypass.
set local role authenticated;
set local request.jwt.claim.sub='10000000-0000-4000-8000-000000000006';
delete from public.roadmap_calendar_public_feeds;
delete from public.roadmap_calendar_internal_feeds;
reset role;
do $$ begin
 if (select count(*) from public.roadmap_calendar_public_feeds)<>2
 or (select count(*) from public.roadmap_calendar_internal_feeds)<>2 then raise exception 'Outsider revoked token'; end if;
end $$;
set local role authenticated;
set local request.jwt.claim.sub='10000000-0000-4000-8000-000000000001';
delete from public.roadmap_calendar_public_feeds where org_id=public.fixture_form_id(1);
delete from public.roadmap_calendar_internal_feeds where org_id=public.fixture_form_id(1);
reset role;
do $$ begin
 if (select title from public.roadmap_calendar_public_events where org_id=public.fixture_form_id(1))<>'Public event'
 or (select revision from public.organization_workspace_calendar_revisions where org_id=public.fixture_form_id(1))<>1
 or exists(select 1 from public.roadmap_calendar_public_feeds where org_id=public.fixture_form_id(1))
 or exists(select 1 from public.roadmap_calendar_internal_feeds where org_id=public.fixture_form_id(1)) then raise exception 'Denial or revocation readback failed'; end if;
 delete from public.organizations where user_id=public.fixture_form_id(2);
 if not exists(select 1 from auth.users where id=public.fixture_form_id(2))
 or (select count(*) from public.roadmap_calendar_internal_events)<>1
 or (select count(*) from public.organization_workspace_calendar_revisions)<>1 then raise exception 'Active cascade lost identity or closing calendar'; end if;
 perform public.fixture_closure('cancel',601,1);
 if exists(select 1 from public.roadmap_calendar_public_feeds)
 or exists(select 1 from public.roadmap_calendar_internal_feeds)
 or public.read_workspace_page_public('community-table',public.fixture_form_id(10)) is not null
 or exists(select 1 from public.workspace_page_image_grants where org_id=public.fixture_form_id(1)) then raise exception 'Cancel restored publication or grants'; end if;
end $$;
set local role service_role;
select public.fixture_calendar_board_event();
update public.roadmap_calendar_internal_events set title='Explicit retry' where org_id=public.fixture_form_id(1);
insert into public.roadmap_calendar_internal_feeds(org_id,token) values(public.fixture_form_id(1),'synthetic-new');
reset role;
do $$ declare role_name text; begin
 if (select revision from public.organization_workspace_calendar_revisions where org_id=public.fixture_form_id(1))<>2
 or (select title from public.roadmap_calendar_internal_events where org_id=public.fixture_form_id(1))<>'Explicit retry'
 or (select token from public.roadmap_calendar_internal_feeds where org_id=public.fixture_form_id(1))<>'synthetic-new' then raise exception 'Explicit retry failed'; end if;
 foreach role_name in array array['anon','authenticated','service_role'] loop
 if has_function_privilege(role_name,'public.guard_organization_calendar_closure()','EXECUTE')
 or has_function_privilege(role_name,'public.organization_closure_command(uuid,uuid,text,uuid,integer)','EXECUTE') then raise exception 'Closure authority exposed'; end if;
 end loop;
end $$;
select public.fixture_closure('request',602,2);
update public.organization_closures set requested_at='2000-01-01Z',export_until='2000-01-31Z';
set local role service_role;
do $$ declare target text; begin
 foreach target in array array['roadmap_calendar_public_events','roadmap_calendar_internal_events','organization_workspace_calendar_revisions'] loop
 begin execute format('delete from public.%I where org_id=public.fixture_form_id(1)',target);
 raise exception 'Expiry authorized purge'; exception when insufficient_privilege then
 if sqlerrm<>'Organization unavailable' then raise; end if; end;
 end loop;
 delete from public.roadmap_calendar_internal_feeds where org_id=public.fixture_form_id(1);
end $$;
reset role;
rollback;
