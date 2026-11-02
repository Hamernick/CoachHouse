-- Join reviewed page publication, guest access and copied assets to closure.
-- Still NOT activation: AI, canonical writers and cleanup remain unqualified.
begin;
create function public.close_organization_publication() returns trigger
 language plpgsql security definer set search_path='' as $$
begin
 if new.state<>'closing' then return new; end if;
 if tg_op='UPDATE' then
   if old.state='closing' then return new; end if;
 end if;
 -- The lifecycle command already holds this lock. Keep the order explicit:
 -- organization -> pages -> invitations/assets, matching all joined writers.
 perform 1 from public.organizations where user_id=new.org_id for update;
 perform 1 from public.organization_workspace_pages where org_id=new.org_id order by id for update;
 update public.organization_workspace_pages set visibility='private',guest_snapshot=null,
   revision=least(revision::bigint+1,2147483647)::integer,updated_at=clock_timestamp(),
   last_operation_id=null,last_operation_actor=null,last_operation_hash=null
   where org_id=new.org_id;
 -- Keep draft/source/version/history records; revoke only the sharing grants.
 -- Even a saturated page revision must not prevent emergency withdrawal.
 update public.workspace_page_invitations g set revoked_at=clock_timestamp()
   from public.organization_workspace_pages p
   where g.page_id=p.id and p.org_id=new.org_id and g.revoked_at is null;
 delete from public.workspace_page_image_grants where org_id=new.org_id;
 delete from public.workspace_page_document_grants where org_id=new.org_id;
 return new;
end; $$;
revoke all on function public.close_organization_publication() from public,anon,authenticated,service_role;
create trigger organization_closure_publication after insert or update of state on public.organization_closures
 for each row execute function public.close_organization_publication();

alter function public.commit_workspace_page(uuid,uuid,uuid,uuid,text,integer,text,jsonb,jsonb,jsonb,timestamptz,jsonb,jsonb,uuid,jsonb,jsonb,jsonb)
 rename to commit_workspace_page_before_closure;
revoke all on function public.commit_workspace_page_before_closure(uuid,uuid,uuid,uuid,text,integer,text,jsonb,jsonb,jsonb,timestamptz,jsonb,jsonb,uuid,jsonb,jsonb,jsonb)
 from public,anon,authenticated,service_role;
create function public.commit_workspace_page(
 p_actor_id uuid,p_org_id uuid,p_page_id uuid,p_operation_id uuid,p_operation_hash text,
 p_expected_revision integer,p_intent text,p_draft jsonb,p_snapshot jsonb,p_expected_graph jsonb,
 p_expected_org_updated_at timestamptz,p_expected_drive_sources jsonb default '[]',
 p_expected_profile jsonb default null,p_canvas_id uuid default null,p_image_assets jsonb default '[]',
 p_document_assets jsonb default '[]',p_form_versions jsonb default '[]'
) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 -- UPDATE first avoids two writers upgrading SHARE to UPDATE below.
 perform 1 from public.organizations where user_id=p_org_id for update;
 perform public.guard_organization_closure(p_org_id);
 return public.commit_workspace_page_before_closure(p_actor_id,p_org_id,p_page_id,p_operation_id,p_operation_hash,
   p_expected_revision,p_intent,p_draft,p_snapshot,p_expected_graph,p_expected_org_updated_at,
   p_expected_drive_sources,p_expected_profile,p_canvas_id,p_image_assets,p_document_assets,p_form_versions);
end; $$;
revoke all on function public.commit_workspace_page(uuid,uuid,uuid,uuid,text,integer,text,jsonb,jsonb,jsonb,timestamptz,jsonb,jsonb,uuid,jsonb,jsonb,jsonb)
 from public,anon,authenticated;
grant execute on function public.commit_workspace_page(uuid,uuid,uuid,uuid,text,integer,text,jsonb,jsonb,jsonb,timestamptz,jsonb,jsonb,uuid,jsonb,jsonb,jsonb) to service_role;

alter function public.workspace_page_guest_command(uuid,uuid,jsonb,text) rename to workspace_page_guest_command_before_closure;
revoke all on function public.workspace_page_guest_command_before_closure(uuid,uuid,jsonb,text) from public,anon,authenticated,service_role;
create function public.workspace_page_guest_command(p_actor_id uuid,p_page_id uuid,p_command jsonb,p_hash text)
 returns jsonb language plpgsql security definer set search_path='' as $$
declare org uuid;
begin
 select org_id into org from public.organization_workspace_pages where id=p_page_id;
 if not found then raise exception 'Page unavailable' using errcode='42501'; end if;
 perform 1 from public.organizations where user_id=org for update;
 perform public.guard_organization_closure(org);
 return public.workspace_page_guest_command_before_closure(p_actor_id,p_page_id,p_command,p_hash);
end; $$;
revoke all on function public.workspace_page_guest_command(uuid,uuid,jsonb,text) from public,anon,authenticated;
grant execute on function public.workspace_page_guest_command(uuid,uuid,jsonb,text) to service_role;

alter function public.read_workspace_page_public(text,uuid) rename to read_workspace_page_public_before_closure;
revoke all on function public.read_workspace_page_public_before_closure(text,uuid) from public,anon,authenticated,service_role;
create function public.read_workspace_page_public(p_organization_slug text,p_link_id uuid)
 returns jsonb language plpgsql security definer set search_path='' as $$
declare org uuid;
begin
 select org_id into org from public.organization_workspace_pages where link_id=p_link_id;
 if not found then return null; end if;
 perform public.guard_organization_closure(org);
 -- Volatile wrapper obtains a fresh snapshot after any lock wait; all original
 -- handle/slug/reservation checks remain inside the existing reader.
 return public.read_workspace_page_public_before_closure(p_organization_slug,p_link_id);
exception when insufficient_privilege then return null;
end; $$;
revoke all on function public.read_workspace_page_public(text,uuid) from public,anon,authenticated;
grant execute on function public.read_workspace_page_public(text,uuid) to service_role;

alter function public.read_workspace_page_image(uuid,text,uuid) rename to read_workspace_page_image_before_closure;
revoke all on function public.read_workspace_page_image_before_closure(uuid,text,uuid) from public,anon,authenticated,service_role;
create function public.read_workspace_page_image(p_asset_id uuid,p_audience text,p_actor_id uuid default null)
 returns jsonb language plpgsql security definer set search_path='' as $$
declare org uuid;
begin
 select org_id into org from public.workspace_page_image_grants where id=p_asset_id;
 if not found then return null; end if;
 if p_audience='guest' then
   perform 1 from public.organizations where user_id=org for update;
 end if;
 perform public.guard_organization_closure(org);
 return public.read_workspace_page_image_before_closure(p_asset_id,p_audience,p_actor_id);
exception when insufficient_privilege then return null;
end; $$;
revoke all on function public.read_workspace_page_image(uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.read_workspace_page_image(uuid,text,uuid) to service_role;

alter function public.read_workspace_page_document(uuid,text,uuid) rename to read_workspace_page_document_before_closure;
revoke all on function public.read_workspace_page_document_before_closure(uuid,text,uuid) from public,anon,authenticated,service_role;
create function public.read_workspace_page_document(p_asset_id uuid,p_audience text,p_actor_id uuid default null)
 returns jsonb language plpgsql security definer set search_path='' as $$
declare org uuid;
begin
 select org_id into org from public.workspace_page_document_grants where id=p_asset_id;
 if not found then return null; end if;
 if p_audience='guest' then
   perform 1 from public.organizations where user_id=org for update;
 end if;
 perform public.guard_organization_closure(org);
 return public.read_workspace_page_document_before_closure(p_asset_id,p_audience,p_actor_id);
exception when insufficient_privilege then return null;
end; $$;
revoke all on function public.read_workspace_page_document(uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.read_workspace_page_document(uuid,text,uuid) to service_role;

-- Prior lifecycle is unexposed. Refuse an unexpected already-closing upgrade
-- atomically; it needs explicit reconciliation, never a silent state reset.
do $$ begin
 if exists(select 1 from public.organization_closures where state='closing') then
   raise exception 'Existing closure requires explicit publication reconciliation before upgrade';
 end if;
end $$;
commit;
