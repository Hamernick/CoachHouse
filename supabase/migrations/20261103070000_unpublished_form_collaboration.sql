-- Draft collaborators use canonical form identity, without publication or workspace access.
begin;
create or replace function public.organization_form_source_command_before_closure(p_actor_id uuid,p_command jsonb) returns jsonb
 language plpgsql security definer set search_path='' as $$
declare
 v public.organization_form_versions%rowtype; f public.organization_forms%rowtype;
 b jsonb; next_state jsonb; content jsonb; token text; op_hash text; actor_role text;
 previous public.organization_form_source_operations%rowtype; n integer; entries jsonb; directory jsonb; next_id uuid;
 stamp text:=to_char(clock_timestamp() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"');
begin
 if p_actor_id is null then raise exception 'Form access required' using errcode='42501'; end if;
 if p_command ? 'versionId' then
   select * into v from public.organization_form_versions where id=(p_command->>'versionId')::uuid;
   if not found then raise exception 'Form access required' using errcode='42501'; end if;
 else
   v.org_id:=(p_command->>'organizationId')::uuid; v.form_id:=(p_command->>'formId')::uuid;
 end if;
 perform 1 from public.organizations where user_id=v.org_id for share;
 if p_actor_id<>v.org_id then
   select role into actor_role from public.organization_memberships where org_id=v.org_id and member_id=p_actor_id for share;
 end if;
 -- Publication and source writers use organization -> membership -> board -> form.
 select state into b from public.organization_workspace_boards where org_id=v.org_id for update;
 select * into f from public.organization_forms where org_id=v.org_id and id=v.form_id for update;
 if not (((p_actor_id=v.org_id or coalesce(actor_role,'') in ('owner','admin','staff'))
   and public.can_edit_organization_form(v.org_id,v.form_id,p_actor_id)) or public.can_edit_invited_form(v.org_id,v.form_id,p_actor_id)) then
   raise exception 'Form editing access required' using errcode='42501'; end if;
 select count(*) into n from public.workspace_form_sources(b) s where s.id=v.form_id;
 if n<>1 then raise exception 'Saved form unavailable' using errcode='42501'; end if;
 select s.content into content from public.workspace_form_sources(b) s where s.id=v.form_id;
 token:=public.organization_form_source_token(b,v.form_id);
 if p_command->>'action'='form_source_directory' then
   -- The board lock serializes source changes. Sorted form locks serialize grant
   -- changes before the statement that filters and returns canonical titles.
   perform 1 from public.organization_forms where org_id=v.org_id
     and id in (select s.id from public.workspace_form_sources(b) s) order by id for update;
   with sources as (
     select s.id,(array_agg(s.content))[1] as content from public.workspace_form_sources(b) s group by s.id having count(*)=1
   ), visible as (
     select s.id, s.content->>'title' as title from sources s
     join public.organization_forms source_form on source_form.org_id=v.org_id and source_form.id=s.id
     where (((p_actor_id=v.org_id or coalesce(actor_role,'') in ('owner','admin','staff'))
       and public.can_edit_organization_form(v.org_id,s.id,p_actor_id)) or public.can_edit_invited_form(v.org_id,s.id,p_actor_id))
     and (p_command->>'after' is null or s.id>(p_command->>'after')::uuid)
     order by s.id limit 51
   ), numbered as (select *, row_number() over(order by id) as position from visible)
   select coalesce(jsonb_agg(jsonb_build_object('formId',id,'title',title) order by id) filter(where position<=50),'[]'),
     case when count(*)>50 then (array_agg(id order by id))[50] end into directory,next_id from numbered;
   return jsonb_build_object('forms',directory,'next',next_id);
 end if;
 if p_command->>'action'='form_source_entry' then
   return jsonb_build_object('formId',v.form_id,'title',content->'title','canManageInvitations',
     (f.intake_manager=p_actor_id and (p_actor_id=v.org_id or coalesce(actor_role,'') in ('owner','admin','staff')))
     or public.can_manage_invited_form(v.org_id,v.form_id,p_actor_id));
 end if;
 if p_command->>'action'='read_form_source' then
   return jsonb_build_object('formId',v.form_id,'revision',token,'title',content->'title','description',content->'description','definition',content#>'{widget,definition}');
 end if;
 if p_command->>'action' is distinct from 'save_form_source' or p_command->>'operationId' is null
   or p_command->>'expectedRevision' is null or jsonb_typeof(p_command->'content') is distinct from 'object'
   or octet_length(p_command::text)>262144 then raise exception 'Invalid source command' using errcode='22023'; end if;
 -- The server validates the complete strict definition. SQL also rejects fields
 -- that could become authority/path injection if another trusted caller is added.
 if (p_command->'content') - array['title','description','definition'] <> '{}'::jsonb
   or jsonb_typeof(p_command#>'{content,title}') is distinct from 'string' or length(trim(p_command#>>'{content,title}'))=0 or length(p_command#>>'{content,title}')>240
   or jsonb_typeof(p_command#>'{content,description}') is distinct from 'string' or length(p_command#>>'{content,description}')>10000
   or jsonb_typeof(p_command#>'{content,definition,questions}') is distinct from 'array'
   or jsonb_array_length(p_command#>'{content,definition,questions}')>50 then raise exception 'Invalid source content' using errcode='22023'; end if;
 op_hash:=encode(sha256(convert_to(p_command::text,'UTF8')),'hex');
 select * into previous from public.organization_form_source_operations where org_id=v.org_id and operation_id=(p_command->>'operationId')::uuid;
 if found then
   if previous.actor_id<>p_actor_id or previous.form_id<>v.form_id or previous.operation_hash<>op_hash then raise exception 'Source operation reused' using errcode='23505'; end if;
   return jsonb_build_object('formId',v.form_id,'operationId',previous.operation_id,'revision',previous.revision);
 end if;
 if token is distinct from p_command->>'expectedRevision' then raise exception 'Form changed' using errcode='40001'; end if;
 next_state:=public.patch_organization_form_canvas(b,v.form_id,p_command->'content',stamp);
 if jsonb_typeof(b#>'{workspaceCatalog,entries}')='array' then
   select coalesce(jsonb_agg(jsonb_set(e,'{state}',public.patch_organization_form_canvas(e->'state',v.form_id,p_command->'content',stamp)) order by i),'[]') into entries
     from jsonb_array_elements(b#>'{workspaceCatalog,entries}') with ordinality x(e,i);
   next_state:=jsonb_set(next_state,'{workspaceCatalog,entries}',entries);
 end if;
 update public.organization_workspace_boards set state=next_state,updated_by=p_actor_id where org_id=v.org_id;
 token:=public.organization_form_source_token(next_state,v.form_id);
 insert into public.organization_form_source_operations(org_id,form_id,operation_id,actor_id,operation_hash,revision)
   values(v.org_id,v.form_id,(p_command->>'operationId')::uuid,p_actor_id,op_hash,token);
 return jsonb_build_object('formId',v.form_id,'operationId',p_command->>'operationId','revision',token);
end; $$;
create or replace function public.organization_form_viewer_access_before_closure(p_actor_id uuid,p_command jsonb) returns jsonb
 language plpgsql security definer set search_path='' as $$
declare
 v public.organization_form_versions%rowtype; f public.organization_forms%rowtype;
 invitation public.organization_form_viewer_invitations%rowtype; previous public.organization_form_invitation_operations%rowtype;
 action text:=p_command->>'action'; actor_email text; actor_role text; rows jsonb; op_hash text; target_email text; target_id uuid;
 active_manager boolean; primary_manager boolean; parent_id uuid; n integer; identity jsonb; draft_title text; draft_board jsonb;
begin
 if p_actor_id is null then raise exception 'Form access required' using errcode='42501'; end if;
 if p_command ? 'versionId' then
   select * into v from public.organization_form_versions where id=(p_command->>'versionId')::uuid;
   if not found then raise exception 'Form access required' using errcode='42501'; end if;
 else
   v.org_id:=(p_command->>'organizationId')::uuid; v.form_id:=(p_command->>'formId')::uuid;
 end if;
 perform 1 from public.organizations where user_id=v.org_id for share;
 select lower(email) into actor_email from auth.users where id=p_actor_id and email_confirmed_at is not null for share;
 if actor_email is null then raise exception 'Verified account required' using errcode='42501'; end if;
 select role into actor_role from public.organization_memberships where org_id=v.org_id and member_id=p_actor_id for share;
 if not (p_command ? 'versionId') then
   select state into draft_board from public.organization_workspace_boards where org_id=v.org_id for share;
   select count(*),min(s.content->>'title') into n,draft_title from public.workspace_form_sources(draft_board) s where s.id=v.form_id;
   if n<>1 then raise exception 'Saved form unavailable' using errcode='42501'; end if;
 end if;
 identity:=case when p_command ? 'versionId' then jsonb_build_object('versionId',v.id)
   else jsonb_build_object('organizationId',v.org_id,'formId',v.form_id) end;
 select * into f from public.organization_forms where org_id=v.org_id and id=v.form_id for update;
 active_manager:=f.intake_manager=f.org_id or exists(select 1 from public.organization_memberships m
   where m.org_id=f.org_id and m.member_id=f.intake_manager and m.role in ('owner','admin','staff'));
 if not active_manager then raise exception 'Form access required' using errcode='42501'; end if;
 primary_manager:=f.intake_manager=p_actor_id and (p_actor_id=f.org_id or coalesce(actor_role,'') in ('owner','admin','staff'));
 select g.id into parent_id from public.organization_form_viewer_invitations g
   where g.org_id=f.org_id and g.form_id=f.id and g.accepted_by=p_actor_id and g.response_permission='manage'
   and public.valid_organization_form_invitation(g.id) order by g.created_at desc,g.id limit 1;
 if action in ('viewer_offer','accept_viewer') then
   select * into invitation from public.organization_form_viewer_invitations g
     where g.org_id=f.org_id and g.form_id=f.id and public.valid_organization_form_invitation(g.id)
       and g.revoked_at is null and (g.accepted_by=p_actor_id or (g.accepted_by is null and g.email=actor_email and g.expires_at>clock_timestamp()))
       and (p_command ? 'versionId' or g.response_permission in ('edit','manage'))
       and (action='viewer_offer' or g.id=(p_command->>'invitationId')::uuid)
     order by (g.accepted_by is null) desc,g.created_at desc,g.id limit 1;
   if not found then raise exception 'Invitation unavailable' using errcode='42501'; end if;
   if action='accept_viewer' then
     if invitation.accepted_by is null then
       update public.organization_form_viewer_invitations set accepted_by=p_actor_id,accepted_at=clock_timestamp() where id=invitation.id;
       update public.organization_forms set access_revision=access_revision+1 where org_id=f.org_id and id=f.id;
     end if;
     return identity||jsonb_build_object('invitationId',invitation.id,'accepted',true);
   end if;
   return identity||jsonb_build_object('invitationId',invitation.id,'title',case when p_command ? 'versionId' then v.version->>'title' else draft_title end,'accepted',invitation.accepted_by is not null,'expiresAt',invitation.expires_at,'responsePermission',invitation.response_permission);
 end if;
 if not primary_manager and parent_id is null then
   raise exception 'Form invitation management required' using errcode='42501'; end if;
 if action='viewer_invitations' then
   select coalesce(jsonb_agg(jsonb_build_object('id',g.id,'email',g.email,'accepted',g.accepted_by is not null,'expiresAt',g.expires_at,'responsePermission',g.response_permission) order by g.created_at,g.id),'[]') into rows
     from public.organization_form_viewer_invitations g where g.org_id=f.org_id and g.form_id=f.id
       and public.valid_organization_form_invitation(g.id) and (primary_manager or g.parent_invitation_id=parent_id);
   return jsonb_build_object('formId',f.id,'revision',f.access_revision,'canGrantManage',primary_manager,'invitations',rows);
 end if;
 if action not in ('invite_viewer','revoke_viewer') or p_command->>'operationId' is null
   or (p_command->>'expectedRevision')::integer is null then raise exception 'Invalid invitation command' using errcode='22023'; end if;
 op_hash:=encode(sha256(convert_to(p_command::text,'UTF8')),'hex');
 select * into previous from public.organization_form_invitation_operations where org_id=f.org_id and operation_id=(p_command->>'operationId')::uuid;
 if found then
   if previous.actor_id<>p_actor_id or previous.operation_hash<>op_hash then raise exception 'Invitation operation reused' using errcode='23505'; end if;
   return jsonb_build_object('formId',previous.form_id,'invitationId',previous.invitation_id,'operationId',previous.operation_id,'revision',previous.revision);
 end if;
 if f.access_revision<>(p_command->>'expectedRevision')::integer then raise exception 'Access changed' using errcode='40001'; end if;
 if action='invite_viewer' then
   if not (p_command ? 'versionId') and coalesce(p_command->>'responsePermission','') not in ('edit','manage') then
     raise exception 'Draft invitations require Edit or Manage' using errcode='22023'; end if;
   if p_command ? 'responsePermission' and (jsonb_typeof(p_command->'responsePermission') is distinct from 'string' or p_command->>'responsePermission' not in ('view','correct','edit','manage')) then
     raise exception 'Invalid response permission' using errcode='22023'; end if;
   if not primary_manager and p_command->>'responsePermission'='manage' then
     raise exception 'Only the primary manager can grant Manage' using errcode='42501'; end if;
   target_email:=lower(trim(p_command->>'email'));
   if target_email is null or length(target_email)>320 or target_email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' or target_email=actor_email then
     raise exception 'Choose another email' using errcode='22023'; end if;
   -- A delegate cannot replace another grantor's live access, including their
   -- own primary grant. Primary re-invitation adopts access independently,
   -- with explicit acceptance again. No roster is disclosed by this denial.
   if not primary_manager and exists(select 1 from public.organization_form_viewer_invitations g
     where g.org_id=f.org_id and g.form_id=f.id and g.email=target_email
     and public.valid_organization_form_invitation(g.id) and g.parent_invitation_id is distinct from parent_id) then
     raise exception 'Only access granted by you can change' using errcode='42501'; end if;
   -- Reinvitation never reactivates an old invitation identifier.
   update public.organization_form_viewer_invitations set revoked_at=clock_timestamp() where org_id=f.org_id and form_id=f.id
     and revoked_at is null and (email=target_email or not public.valid_organization_form_invitation(id));
   -- Replacing a Manage grant invalidates and retires its exact children.
   update public.organization_form_viewer_invitations set revoked_at=clock_timestamp()
     where org_id=f.org_id and form_id=f.id and revoked_at is null and not public.valid_organization_form_invitation(id);
   select count(*) into n from public.organization_form_viewer_invitations where org_id=f.org_id and form_id=f.id and revoked_at is null;
   if n>=50 then raise exception 'Viewer limit reached' using errcode='54000'; end if;
   target_id:=(p_command->>'operationId')::uuid;
   insert into public.organization_form_viewer_invitations(id,org_id,form_id,email,invited_by,manager_revision,response_permission,parent_invitation_id)
     values(target_id,f.org_id,f.id,target_email,p_actor_id,f.manager_revision,coalesce(p_command->>'responsePermission','view'),case when primary_manager then null else parent_id end);
 else
   target_id:=(p_command->>'invitationId')::uuid;
   if not primary_manager and not exists(select 1 from public.organization_form_viewer_invitations g
     where g.id=target_id and g.org_id=f.org_id and g.form_id=f.id and g.parent_invitation_id=parent_id
     and public.valid_organization_form_invitation(g.id)) then
     raise exception 'Only access granted by you can change' using errcode='42501'; end if;
   update public.organization_form_viewer_invitations set revoked_at=clock_timestamp() where id=target_id and org_id=f.org_id and form_id=f.id
     and manager_revision=f.manager_revision and revoked_at is null;
   if not found then raise exception 'Access changed' using errcode='40001'; end if;
   update public.organization_form_viewer_invitations set revoked_at=clock_timestamp()
     where parent_invitation_id=target_id and revoked_at is null;
 end if;
 update public.organization_forms set access_revision=access_revision+1 where org_id=f.org_id and id=f.id returning * into f;
 insert into public.organization_form_invitation_operations(org_id,operation_id,form_id,actor_id,operation_hash,invitation_id,revision)
   values(f.org_id,(p_command->>'operationId')::uuid,f.id,p_actor_id,op_hash,target_id,f.access_revision);
 return jsonb_build_object('formId',f.id,'invitationId',target_id,'operationId',p_command->>'operationId','revision',f.access_revision);
end; $$;

create or replace function public.organization_form_source_command(p_actor_id uuid,p_command jsonb) returns jsonb
 language plpgsql security definer set search_path='' as $$
declare org uuid;
begin
 if p_command ? 'versionId' and (p_command ? 'organizationId' or p_command ? 'formId') then
   raise exception 'Choose one form target' using errcode='22023'; end if;
 if p_command ? 'versionId' then
   select org_id into org from public.organization_form_versions where id=(p_command->>'versionId')::uuid;
 else
   select org_id into org from public.organization_forms where org_id=(p_command->>'organizationId')::uuid and id=(p_command->>'formId')::uuid;
 end if;
 if org is null then raise exception 'Form access required' using errcode='42501'; end if;
 perform public.guard_organization_closure(org);
 return public.organization_form_source_command_before_closure(p_actor_id,p_command);
end; $$;
revoke all on function public.organization_form_source_command(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.organization_form_source_command(uuid,jsonb) to service_role;
revoke all on function public.organization_form_source_command_before_closure(uuid,jsonb) from public,anon,authenticated,service_role;

create or replace function public.organization_form_viewer_access(p_actor_id uuid,p_command jsonb) returns jsonb
 language plpgsql security definer set search_path='' as $$
declare org uuid;
begin
 if p_command ? 'versionId' and (p_command ? 'organizationId' or p_command ? 'formId') then
   raise exception 'Choose one form target' using errcode='22023'; end if;
 if p_command ? 'versionId' then
   select org_id into org from public.organization_form_versions where id=(p_command->>'versionId')::uuid;
 else
   select org_id into org from public.organization_forms where org_id=(p_command->>'organizationId')::uuid and id=(p_command->>'formId')::uuid;
 end if;
 if org is null then raise exception 'Form access required' using errcode='42501'; end if;
 perform public.guard_organization_closure(org);
 return public.organization_form_viewer_access_before_closure(p_actor_id,p_command);
end; $$;
revoke all on function public.organization_form_viewer_access(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.organization_form_viewer_access(uuid,jsonb) to service_role;
revoke all on function public.organization_form_viewer_access_before_closure(uuid,jsonb) from public,anon,authenticated,service_role;
commit;
