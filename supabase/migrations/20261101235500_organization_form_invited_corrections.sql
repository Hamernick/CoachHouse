-- Explicit answer correction on accepted response invitations. Existing grants
-- stay read-only. Source authoring, workspace access and delegation are separate.
begin;
alter table public.organization_form_viewer_invitations add column response_permission text not null default 'view'
 check(response_permission in ('view','correct'));

create function public.can_correct_invited_form_responses(p_org uuid,p_form uuid,p_actor uuid) returns boolean
 language sql stable set search_path='' as $$
 select public.can_view_invited_form_responses(p_org,p_form,p_actor) and exists(
   select 1 from public.organization_forms f join public.organization_form_viewer_invitations g
     on g.org_id=f.org_id and g.form_id=f.id and g.manager_revision=f.manager_revision and g.invited_by=f.intake_manager
   where f.org_id=p_org and f.id=p_form and g.accepted_by=p_actor and g.revoked_at is null and g.response_permission='correct');
$$;
revoke all on function public.can_correct_invited_form_responses(uuid,uuid,uuid) from public,anon,authenticated,service_role;

create or replace function public.organization_form_viewer_access(p_actor_id uuid,p_command jsonb) returns jsonb
 language plpgsql security definer set search_path='' as $$
declare
 v public.organization_form_versions%rowtype; f public.organization_forms%rowtype;
 invitation public.organization_form_viewer_invitations%rowtype; previous public.organization_form_invitation_operations%rowtype;
 action text:=p_command->>'action'; actor_email text; actor_role text; rows jsonb; op_hash text; target_email text; target_id uuid;
 active_manager boolean; n integer;
begin
 if p_actor_id is null then raise exception 'Form access required' using errcode='42501'; end if;
 select * into v from public.organization_form_versions where id=(p_command->>'versionId')::uuid;
 if not found then raise exception 'Form access required' using errcode='42501'; end if;
 perform 1 from public.organizations where user_id=v.org_id for share;
 select lower(email) into actor_email from auth.users where id=p_actor_id and email_confirmed_at is not null for share;
 if actor_email is null then raise exception 'Verified account required' using errcode='42501'; end if;
 select role into actor_role from public.organization_memberships where org_id=v.org_id and member_id=p_actor_id for share;
 select * into f from public.organization_forms where org_id=v.org_id and id=v.form_id for update;
 active_manager:=f.intake_manager=f.org_id or exists(select 1 from public.organization_memberships m
   where m.org_id=f.org_id and m.member_id=f.intake_manager and m.role in ('owner','admin','staff'));
 if not active_manager then raise exception 'Form access required' using errcode='42501'; end if;
 if action in ('viewer_offer','accept_viewer') then
   select * into invitation from public.organization_form_viewer_invitations g
     where g.org_id=f.org_id and g.form_id=f.id and g.manager_revision=f.manager_revision and g.invited_by=f.intake_manager
       and g.revoked_at is null and (g.accepted_by=p_actor_id or (g.accepted_by is null and g.email=actor_email and g.expires_at>clock_timestamp()))
       and (action='viewer_offer' or g.id=(p_command->>'invitationId')::uuid)
     order by g.created_at desc,g.id limit 1;
   if not found then raise exception 'Invitation unavailable' using errcode='42501'; end if;
   if action='accept_viewer' then
     if invitation.accepted_by is null then
       update public.organization_form_viewer_invitations set accepted_by=p_actor_id,accepted_at=clock_timestamp() where id=invitation.id;
       update public.organization_forms set access_revision=access_revision+1 where org_id=f.org_id and id=f.id;
     end if;
     return jsonb_build_object('invitationId',invitation.id,'versionId',v.id,'accepted',true);
   end if;
   return jsonb_build_object('invitationId',invitation.id,'versionId',v.id,'title',v.version->>'title','accepted',invitation.accepted_by is not null,'expiresAt',invitation.expires_at,'responsePermission',invitation.response_permission);
 end if;
 if f.intake_manager<>p_actor_id or (p_actor_id<>f.org_id and coalesce(actor_role,'') not in ('owner','admin','staff')) then
   raise exception 'Primary form manager required' using errcode='42501'; end if;
 if action='viewer_invitations' then
   select coalesce(jsonb_agg(jsonb_build_object('id',g.id,'email',g.email,'accepted',g.accepted_by is not null,'expiresAt',g.expires_at,'responsePermission',g.response_permission) order by g.created_at,g.id),'[]') into rows
     from public.organization_form_viewer_invitations g where g.org_id=f.org_id and g.form_id=f.id
       and g.manager_revision=f.manager_revision and g.revoked_at is null and (g.accepted_by is not null or g.expires_at>clock_timestamp());
   return jsonb_build_object('formId',f.id,'revision',f.access_revision,'invitations',rows);
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
   if p_command ? 'responsePermission' and (jsonb_typeof(p_command->'responsePermission') is distinct from 'string' or p_command->>'responsePermission' not in ('view','correct')) then
     raise exception 'Invalid response permission' using errcode='22023'; end if;
   target_email:=lower(trim(p_command->>'email'));
   if target_email is null or length(target_email)>320 or target_email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' or target_email=actor_email then
     raise exception 'Choose another email' using errcode='22023'; end if;
   -- Reinvitation never reactivates an old invitation identifier.
   update public.organization_form_viewer_invitations set revoked_at=clock_timestamp() where org_id=f.org_id and form_id=f.id
     and revoked_at is null and (email=target_email or manager_revision<>f.manager_revision or (accepted_by is null and expires_at<=clock_timestamp()));
   select count(*) into n from public.organization_form_viewer_invitations where org_id=f.org_id and form_id=f.id and revoked_at is null;
   if n>=50 then raise exception 'Viewer limit reached' using errcode='54000'; end if;
   target_id:=(p_command->>'operationId')::uuid;
   insert into public.organization_form_viewer_invitations(id,org_id,form_id,email,invited_by,manager_revision,response_permission)
     values(target_id,f.org_id,f.id,target_email,p_actor_id,f.manager_revision,coalesce(p_command->>'responsePermission','view'));
 else
   target_id:=(p_command->>'invitationId')::uuid;
   update public.organization_form_viewer_invitations set revoked_at=clock_timestamp() where id=target_id and org_id=f.org_id and form_id=f.id
     and manager_revision=f.manager_revision and revoked_at is null;
   if not found then raise exception 'Access changed' using errcode='40001'; end if;
 end if;
 update public.organization_forms set access_revision=access_revision+1 where org_id=f.org_id and id=f.id returning * into f;
 insert into public.organization_form_invitation_operations(org_id,operation_id,form_id,actor_id,operation_hash,invitation_id,revision)
   values(f.org_id,(p_command->>'operationId')::uuid,f.id,p_actor_id,op_hash,target_id,f.access_revision);
 return jsonb_build_object('formId',f.id,'invitationId',target_id,'operationId',p_command->>'operationId','revision',f.access_revision);
end; $$;
revoke all on function public.organization_form_viewer_access(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.organization_form_viewer_access(uuid,jsonb) to service_role;

create or replace function public.organization_form_intake(p_actor_id uuid,p_command jsonb) returns jsonb
 language plpgsql security definer set search_path='' as $$
declare v public.organization_form_versions%rowtype; page public.organization_workspace_pages%rowtype;
 r public.organization_form_responses%rowtype; previous public.organization_form_corrections%rowtype;
 cursor_row public.organization_form_responses%rowtype; snapshot jsonb; role_name text; manager uuid;
 action text:=p_command->>'action'; rows jsonb; receipt jsonb; row_count integer; hash text; editor boolean;
begin
 select * into v from public.organization_form_versions where id=(p_command->>'versionId')::uuid;
 if not found then raise exception 'Form unavailable' using errcode='42501'; end if;
 -- Same lock order as publication: organization, membership, page, form, response.
 if p_command->>'audience'='guest' and action in ('version','submit') then
   perform 1 from public.organizations where user_id=v.org_id for update;
 else
   perform 1 from public.organizations where user_id=v.org_id for share;
 end if;
 if not found then raise exception 'Form unavailable' using errcode='42501'; end if;
 if p_actor_id is not null and p_actor_id<>v.org_id then
   select role into role_name from public.organization_memberships where org_id=v.org_id and member_id=p_actor_id for share;
 end if;
 if action in ('version','submit') then
   if p_command->>'audience'='public' then
     select * into page from public.organization_workspace_pages where id=v.page_id for share;
     snapshot:=public.read_workspace_page_public(page.published_snapshot#>>'{brand,organizationSlug}',page.link_id)->'snapshot';
   elsif p_command->>'audience'='guest' and p_actor_id is not null then
     snapshot:=public.workspace_page_guest_command(p_actor_id,v.page_id,'{"action":"read"}',null)->'snapshot';
   end if;
   if snapshot is null or not exists(select 1 from jsonb_array_elements(snapshot->'items') i
     where i->>'id'=v.form_id::text and i#>>'{content,intakeVersionId}'=v.id::text) then
     raise exception 'Form unavailable' using errcode='42501'; end if;
 else
   if p_actor_id is null then raise exception 'Form access required' using errcode='42501'; end if;
 end if;
 select intake_manager into manager from public.organization_forms where org_id=v.org_id and id=v.form_id for update;
 editor:=p_actor_id=v.org_id or coalesce(role_name,'') in ('owner','admin','staff');
 if action not in ('version','submit') and not (
   (editor and public.can_review_organization_form(v.org_id,v.form_id,p_actor_id)
     and (action<>'correct' or public.can_edit_organization_form(v.org_id,v.form_id,p_actor_id)))
   or (action in ('responses','response','editor_version') and public.can_view_invited_form_responses(v.org_id,v.form_id,p_actor_id))
   or (action='correct' and public.can_correct_invited_form_responses(v.org_id,v.form_id,p_actor_id))
 ) then raise exception 'Form access required' using errcode='42501'; end if;
 if action='version' or action='editor_version' then return v.version; end if;
 if action='response' then
   select * into r from public.organization_form_responses where version_id=v.id and id=(p_command->>'id')::uuid;
   if not found then raise exception 'Response unavailable' using errcode='42501'; end if;
   return public.organization_form_response_json(r);
 end if;
 if action='responses' then
   if p_command->>'before' is not null then
     select * into cursor_row from public.organization_form_responses where version_id=v.id and id=(p_command->>'before')::uuid;
     if not found then raise exception 'Invalid response cursor' using errcode='22023'; end if;
   end if;
   select coalesce(jsonb_agg(public.organization_form_response_json(t) order by t.submitted_at desc,t.id desc),'[]'),count(*) into rows,row_count
     from (select * from public.organization_form_responses where version_id=v.id
       and (cursor_row.id is null or (submitted_at,id)<(cursor_row.submitted_at,cursor_row.id))
       order by submitted_at desc,id desc limit 50) t;
   return jsonb_build_object('version',v.version,'permissions',jsonb_build_object('canCorrect',(editor and public.can_edit_organization_form(v.org_id,v.form_id,p_actor_id)) or public.can_correct_invited_form_responses(v.org_id,v.form_id,p_actor_id),'canManageAccess',editor and public.can_manage_organization_form(v.org_id,v.form_id,p_actor_id)),'responses',rows,'next',case when row_count=50 then rows->49->>'id' else null end);
 end if;
 if action not in ('submit','correct') or p_command->'version' is distinct from v.version
   or jsonb_typeof(p_command->'answers') is distinct from 'array' or jsonb_array_length(p_command->'answers')>50
   or octet_length((p_command->'answers')::text)>262144 then raise exception 'Invalid answers' using errcode='22023'; end if;
 if exists(select 1 from jsonb_array_elements(p_command->'answers') a where not exists(
   select 1 from jsonb_array_elements(v.version#>'{definition,questions}') q where q->>'id'=a->>'questionId'))
   or (select count(*)<>count(distinct a->>'questionId') from jsonb_array_elements(p_command->'answers') a) then
   raise exception 'Invalid answer identity' using errcode='22023'; end if;
 hash:=p_command->>'hash';
 if hash is null or hash !~ '^[a-f0-9]{64}$' then raise exception 'Invalid receipt' using errcode='22023'; end if;
 select * into r from public.organization_form_responses where version_id=v.id and id=(p_command->>'id')::uuid for update;
 if action='submit' then
   if found then
     if r.original_hash<>hash then raise exception 'Submission identity reused' using errcode='23505'; end if;
   else
     -- Serialized per canonical form, across republished versions. No IPs/answers in rate logs.
     select count(*) into row_count from public.organization_form_responses rr join public.organization_form_versions vv on vv.id=rr.version_id
       where vv.org_id=v.org_id and vv.form_id=v.form_id and rr.submitted_at>clock_timestamp()-interval '1 minute';
     if row_count>=60 then raise exception 'Submission rate exceeded' using errcode='54000'; end if;
     select count(*) into row_count from public.organization_form_responses rr join public.organization_form_versions vv on vv.id=rr.version_id
       where vv.org_id=v.org_id and vv.form_id=v.form_id and rr.submitted_at>clock_timestamp()-interval '1 day';
     if row_count>=1000 then raise exception 'Submission rate exceeded' using errcode='54000'; end if;
     insert into public.organization_form_responses(version_id,id,original_hash,answers)
       values(v.id,(p_command->>'id')::uuid,hash,p_command->'answers') returning * into r;
   end if;
   return jsonb_build_object('id',r.id,'versionId',r.version_id,'submittedAt',r.submitted_at);
 end if;
 if not found then raise exception 'Response unavailable' using errcode='42501'; end if;
 select * into previous from public.organization_form_corrections where version_id=v.id and response_id=r.id
   and operation_id=(p_command->>'operationId')::uuid;
 if found then
   if previous.actor_id<>p_actor_id or previous.operation_hash<>hash then raise exception 'Correction identity reused' using errcode='23505'; end if;
   return public.organization_form_response_json(r);
 end if;
 if r.revision is distinct from (p_command->>'expectedRevision')::integer then raise exception 'Response changed' using errcode='40001'; end if;
 -- Only the selected answer may change. Technical and unrelated fields are immutable.
 if not exists(select 1 from jsonb_array_elements(v.version#>'{definition,questions}') q where q->>'id'=p_command->>'questionId')
   or (select coalesce(jsonb_agg(a order by a->>'questionId'),'[]') from jsonb_array_elements(r.answers) a where a->>'questionId'<>p_command->>'questionId')
     is distinct from (select coalesce(jsonb_agg(a order by a->>'questionId'),'[]') from jsonb_array_elements(p_command->'answers') a where a->>'questionId'<>p_command->>'questionId') then
   raise exception 'Invalid correction' using errcode='22023'; end if;
 update public.organization_form_responses set answers=p_command->'answers',revision=revision+1,updated_at=clock_timestamp()
   where version_id=v.id and id=r.id returning * into r;
 insert into public.organization_form_corrections(version_id,response_id,operation_id,actor_id,operation_hash,question_id,revision)
   values(v.id,r.id,(p_command->>'operationId')::uuid,p_actor_id,hash,(p_command->>'questionId')::uuid,r.revision);
 return public.organization_form_response_json(r);
end; $$;
revoke all on function public.organization_form_intake(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.organization_form_intake(uuid,jsonb) to service_role;
commit;
