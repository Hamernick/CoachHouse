-- Resource matching uses canonical board identity, current source authority and
-- retained known inputs. Unknown historical copies remain a privacy-cutover gate.
begin;
alter table public.organization_resource_opportunity_matches
 add column source_file_ids uuid[] not null default '{}';
-- ALTER holds the table exclusively. Backfill only source metadata, including
-- closed organizations, without changing content, timestamps or lifecycle state.
alter table public.organization_resource_opportunity_matches disable trigger opportunity_closure;
update public.organization_resource_opportunity_matches m set source_file_ids=array(
 select distinct file_id from public.organization_workspace_boards b
 cross join lateral public.workspace_particle_board_files(m.org_id,b.state) d
 where b.org_id=m.org_id and d.record_id='particle:'||m.resource_id::text order by file_id);
alter table public.organization_resource_opportunity_matches enable trigger opportunity_closure;
-- Writes stay behind the verified RPC; its private implementation cannot be
-- called directly to omit source checks or discard retained dependencies.
revoke insert,update on public.organization_resource_opportunity_matches from public,anon,authenticated,service_role;
alter function public.manage_resource_opportunity_matches(text,uuid,uuid,uuid,integer,text,jsonb)
 rename to manage_resource_opportunity_matches_before_sources;
revoke all on function public.manage_resource_opportunity_matches_before_sources(text,uuid,uuid,uuid,integer,text,jsonb)
 from public,anon,authenticated,service_role;

create function public.manage_resource_opportunity_matches(p_action text,p_org_id uuid,p_actor_id uuid,p_resource_id uuid,p_revision integer,p_canvas_id text,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare board jsonb; files uuid[]; file uuid; result jsonb; member_role text; finance_role text;
begin
 if auth.role() is distinct from 'service_role' or p_actor_id is null
  or p_actor_id is distinct from public.organization_activity_actor_id() then
  raise exception 'Verified resource actor required.' using errcode='42501';end if;
 if current_setting('transaction_isolation')<>'read committed' then
  raise exception 'Resource permissions changed; retry.' using errcode='40001';end if;
 perform 1 from public.organizations where user_id=p_org_id for share nowait;
 if not found then raise exception 'Organization unavailable.' using errcode='42501';end if;
 if p_action='list' then
  if not public.organization_closure_read_window(p_org_id) then raise exception 'Organization unavailable.' using errcode='42501';end if;
 else perform public.guard_organization_closure(p_org_id);end if;
 -- Lock real authority rows before checking fresh membership/finance grants.
 if p_actor_id<>p_org_id then
  select role into member_role from public.organization_memberships where org_id=p_org_id and member_id=p_actor_id for share nowait;
  select access_level into finance_role from public.organization_finance_access where org_id=p_org_id and member_id=p_actor_id for share nowait;
  if member_role is distinct from 'board' or finance_role is null
   or (p_action<>'list' and finance_role<>'manager') then
   raise exception 'Finance access denied' using errcode='42501';end if;
 end if;
 select state into board from public.organization_workspace_boards where org_id=p_org_id for share nowait;
 if not found then raise exception 'Resource changed. Reopen matching.' using errcode='40001';end if;
 -- Reject duplicate identities even across canvases; the inner function checks
 -- the exact requested canvas and revision against this same locked board.
 if (select count(*) from public.workspace_particle_board_graphs(board) g
  cross join lateral jsonb_array_elements(public.workspace_particle_array(g.graph->'particles')) p
  where p->>'id'=p_resource_id::text and p->>'type'='activity'
   and (g.canvas<>'root' or not coalesce((board#>>'{workspaceCatalog,defaultDeleted}')::boolean,false)))<>1 then
   raise exception 'Resource changed. Reopen matching.' using errcode='40001';end if;
 -- Serialize this resource's existing matches before checking their retained
 -- inputs. A list/filter cannot skip a dependency previously used for a match.
 perform 1 from public.organization_resource_opportunity_matches
  where org_id=p_org_id and resource_id=p_resource_id order by id for update nowait;
 files:=array(select distinct file_id from (
  select file_id from public.workspace_particle_board_files(p_org_id,board) where record_id='particle:'||p_resource_id::text
  union select unnest(source_file_ids) from public.organization_resource_opportunity_matches where org_id=p_org_id and resource_id=p_resource_id
 ) dependencies order by file_id);
 foreach file in array files loop perform public.assert_workspace_particle_source_view(p_org_id,file,p_actor_id);end loop;
 result:=public.manage_resource_opportunity_matches_before_sources(p_action,p_org_id,p_actor_id,p_resource_id,p_revision,p_canvas_id,p_payload);
 if p_action='put' then
  -- Conservative union: refreshes and detached references never erase a known
  -- input. The caller cannot supply this column or invoke the inner writer.
  update public.organization_resource_opportunity_matches m set source_file_ids=files
   where m.org_id=p_org_id and m.resource_id=p_resource_id
    and m.external_id in(select value#>>'{notice,externalId}' from jsonb_array_elements(p_payload));
 end if;
 return result;
exception when lock_not_available then
 raise exception 'Resource permissions are changing; retry.' using errcode='40001';
end; $$;
revoke all on function public.manage_resource_opportunity_matches(text,uuid,uuid,uuid,integer,text,jsonb) from public,anon,authenticated;
grant execute on function public.manage_resource_opportunity_matches(text,uuid,uuid,uuid,integer,text,jsonb) to service_role;

-- Raw authenticated table reads must not bypass the server projection/RPC.
-- This helper derives the actor from auth.uid(), never a caller/header argument.
create function public.can_read_resource_match_sources(p_org uuid,p_resource uuid,p_files uuid[])
returns boolean language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=auth.uid(); board jsonb;
begin
 if actor is null or not public.can_view_organization_finance(p_org)
  or not public.can_read_workspace_particle_origins(p_org,actor) then return false;end if;
 select state into board from public.organization_workspace_boards where org_id=p_org;
 return not exists(select 1 from (
  select file_id from public.workspace_particle_board_files(p_org,board) where record_id='particle:'||p_resource::text
  union select unnest(p_files)
 ) d left join public.organization_document_files f on f.id=d.file_id and f.org_id=p_org
 where f.id is null or not public.document_file_folder_actor_can(d.file_id,actor,'view'));
end; $$;
revoke all on function public.can_read_resource_match_sources(uuid,uuid,uuid[]) from public,anon,authenticated,service_role;
grant execute on function public.can_read_resource_match_sources(uuid,uuid,uuid[]) to authenticated;
create policy resource_match_source_read on public.organization_resource_opportunity_matches
 as restrictive for select to authenticated
 using(public.can_read_resource_match_sources(org_id,resource_id,source_file_ids));
comment on column public.organization_resource_opportunity_matches.source_file_ids is
 'Server-retained known native inputs. Conservative and non-exhaustive for historical data; never a declaration of provenance completeness.';
commit;
