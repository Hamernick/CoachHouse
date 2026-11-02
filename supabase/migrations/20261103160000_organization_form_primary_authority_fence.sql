-- Fence retired primary authority without replacing identities or removing a
-- newer independent reviewer grant. Existing closure wrappers remain unchanged.
begin;
create function public.is_active_organization_form_primary(p_org uuid,p_form uuid,p_actor uuid) returns boolean
 language sql stable set search_path='' as $$
 select exists(select 1 from public.organization_forms f where f.org_id=p_org and f.id=p_form
  and f.intake_manager=p_actor and f.primary_revoked_at is null
  and (p_actor=f.org_id or exists(select 1 from public.organization_memberships m
   where m.org_id=f.org_id and m.member_id=p_actor and m.role in ('owner','admin','staff'))));
$$;
revoke all on function public.is_active_organization_form_primary(uuid,uuid,uuid) from public,anon,authenticated,service_role;
comment on function public.is_active_organization_form_primary(uuid,uuid,uuid) is
 'Exact currently active primary form authority. Organization ownership alone never grants access; revoked generations require explicit recovery.';

create or replace function public.can_edit_organization_form(p_org uuid,p_form uuid,p_actor uuid) returns boolean
 language sql stable set search_path='' as $$
 select exists(select 1 from public.organization_forms f where f.org_id=p_org and f.id=p_form
   and (public.is_active_organization_form_primary(f.org_id,f.id,p_actor) or exists(select 1 from public.organization_form_reviewers g
     where g.org_id=f.org_id and g.form_id=f.id and g.member_id=p_actor
       and g.manager_revision=f.manager_revision and g.role in ('edit','manage'))));
$$;

create or replace function public.can_manage_organization_form(p_org uuid,p_form uuid,p_actor uuid) returns boolean
 language sql stable set search_path='' as $$
 select exists(select 1 from public.organization_forms f where f.org_id=p_org and f.id=p_form
   and (public.is_active_organization_form_primary(f.org_id,f.id,p_actor) or exists(select 1 from public.organization_form_reviewers g
     where g.org_id=f.org_id and g.form_id=f.id and g.member_id=p_actor
       and g.manager_revision=f.manager_revision and g.role='manage' and g.granted_by=f.intake_manager)));
$$;

create or replace function public.can_review_organization_form(p_org uuid,p_form uuid,p_actor uuid) returns boolean
 language sql stable set search_path='' as $$
 select exists(select 1 from public.organization_forms f where f.org_id=p_org and f.id=p_form
   and (public.is_active_organization_form_primary(f.org_id,f.id,p_actor) or exists(select 1 from public.organization_form_reviewers g
     where g.org_id=f.org_id and g.form_id=f.id and g.member_id=p_actor and g.manager_revision=f.manager_revision)));
$$;

create or replace function public.valid_organization_form_invitation(p_id uuid) returns boolean
 language sql stable set search_path='' as $$
 select exists(select 1 from public.organization_form_viewer_invitations g
 join public.organization_forms f on f.org_id=g.org_id and f.id=g.form_id
 left join public.organization_form_viewer_invitations p on p.id=g.parent_invitation_id and p.org_id=g.org_id and p.form_id=g.form_id
 where g.id=p_id and g.manager_revision=f.manager_revision and g.revoked_at is null
 and (g.accepted_by is not null or g.expires_at>clock_timestamp())
 and public.is_active_organization_form_primary(f.org_id,f.id,f.intake_manager)
 and ((g.parent_invitation_id is null and g.invited_by=f.intake_manager)
 or (g.response_permission in ('view','correct','edit') and p.parent_invitation_id is null
   and p.invited_by=f.intake_manager and p.manager_revision=f.manager_revision and p.revoked_at is null
   and p.response_permission='manage' and p.accepted_by=g.invited_by)));
$$;

create or replace function public.commit_workspace_page_before_closure(
 p_actor_id uuid,p_org_id uuid,p_page_id uuid,p_operation_id uuid,p_operation_hash text,
 p_expected_revision integer,p_intent text,p_draft jsonb,p_snapshot jsonb,p_expected_graph jsonb,
 p_expected_org_updated_at timestamptz,p_expected_drive_sources jsonb default '[]',
 p_expected_profile jsonb default null,p_canvas_id uuid default null,p_image_assets jsonb default '[]',
 p_document_assets jsonb default '[]',p_form_versions jsonb default '[]'
) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb; v jsonb; item jsonb; expected_definition jsonb; manager uuid; form_count integer;
begin
 result:=public.commit_workspace_page_with_assets(p_actor_id,p_org_id,p_page_id,p_operation_id,p_operation_hash,
   p_expected_revision,p_intent,p_draft,p_snapshot,p_expected_graph,p_expected_org_updated_at,
   p_expected_drive_sources,p_expected_profile,p_canvas_id,p_image_assets,p_document_assets);
 if (result->>'replayed')::boolean then return result; end if;
 if jsonb_typeof(p_form_versions) is distinct from 'array' or jsonb_array_length(p_form_versions)>50 then
   raise exception 'Invalid form versions' using errcode='22023'; end if;
 if p_intent not in ('publish','share_with_guests') then
   if p_form_versions<>'[]'::jsonb then raise exception 'Unexpected form versions' using errcode='22023'; end if;
   return result;
 end if;
 select count(*) into form_count from jsonb_array_elements(p_snapshot->'items') i where i#>>'{content,kind}'='form';
 if form_count<>jsonb_array_length(p_form_versions) or form_count<>(select count(distinct f->>'id') from jsonb_array_elements(p_form_versions) f) then
   raise exception 'Form selection mismatch' using errcode='22023'; end if;
 for v in select value from jsonb_array_elements(p_form_versions) order by value->>'formId' loop
   select i into item from jsonb_array_elements(p_snapshot->'items') i
     where i->>'id'=v->>'formId' and i#>>'{content,kind}'='form' and i#>>'{content,intakeVersionId}'=v->>'id';
   if not found or v->>'schemaVersion' is distinct from '1' or v->>'revision' is distinct from (p_expected_revision+1)::text
     or v->>'title' is distinct from item->>'title' or v->>'description' is distinct from coalesce(item->>'description','')
     or jsonb_typeof(item#>'{content,definition,questions}') is distinct from 'array'
     or jsonb_array_length(item#>'{content,definition,questions}') not between 1 and 50 then
     raise exception 'Invalid form version' using errcode='22023'; end if;
   -- Compare to the locked canonical graph, never a client-authored definition.
   if not exists(select 1 from jsonb_array_elements(p_expected_graph->'particles') p
     where p->>'id'=v->>'formId' and p->>'type'='activity' and p#>>'{data,widget,kind}'='form'
       and (p#>'{data,source}' is null or p#>'{data,source}'='null'::jsonb)
       and p#>'{data,widget,definition}'=item#>'{content,definition}') then
     raise exception 'Form source changed' using errcode='40001'; end if;
   select jsonb_build_object('questions',jsonb_agg(case when q ? 'options' then
     jsonb_set(q,'{options}',(select jsonb_agg(jsonb_build_object('id','option-'||n,'label',label) order by n)
       from jsonb_array_elements_text(q->'options') with ordinality o(label,n))) else q end order by ordinal))
     into expected_definition from jsonb_array_elements(item#>'{content,definition,questions}') with ordinality qs(q,ordinal);
   if v->'definition' is distinct from expected_definition then raise exception 'Form definition mismatch' using errcode='22023'; end if;
   -- Ownership is established by the authenticated canonical board write, never publication.
   select intake_manager into manager from public.organization_forms where org_id=p_org_id and id=(v->>'formId')::uuid for update;
   if not found or not public.is_active_organization_form_primary(p_org_id,(v->>'formId')::uuid,p_actor_id) then
     raise exception 'Form manager required' using errcode='42501'; end if;
   insert into public.organization_form_versions(id,org_id,form_id,page_id,version)
     values((v->>'id')::uuid,p_org_id,(v->>'formId')::uuid,p_page_id,v);
 end loop;
 return result;
end; $$;

create or replace function public.guard_workspace_form_sources() returns trigger
 language plpgsql security definer set search_path='' as $$
declare
 previous jsonb:='[]'; following jsonb:='[]'; changed uuid; old_content jsonb; new_content jsonb;
 target_org uuid; actor uuid; manager uuid; member_role text;
 invoker text:=coalesce(nullif(current_setting('role',true),'none'),session_user);
begin
 if tg_op='UPDATE' and old.org_id<>new.org_id then
   raise exception 'Workspace organization cannot change' using errcode='42501'; end if;
 if tg_op='DELETE' then target_org:=old.org_id; else target_org:=new.org_id; end if;
 -- An actual organization deletion owns its cascade; deleting a board alone does not delete forms/responses.
 if tg_op='DELETE' and not exists(select 1 from public.organizations where user_id=target_org) then return old; end if;
 if tg_op<>'INSERT' then
   select coalesce(jsonb_agg(jsonb_build_object('id',f.id,'content',f.content) order by f.id,f.content::text),'[]')
     into previous from public.workspace_form_sources(old.state) f;
 end if;
 if tg_op<>'DELETE' then
   select coalesce(jsonb_agg(jsonb_build_object('id',f.id,'content',f.content) order by f.id,f.content::text),'[]')
     into following from public.workspace_form_sources(new.state) f;
 end if;
 if previous=following then
   if tg_op='DELETE' then return old; else return new; end if;
 end if;
 -- JWT subject is authoritative for session writes; updated_by is client-controlled.
 -- Trusted service writes must supply an actor and still satisfy source permissions.
 if invoker='authenticated' then actor:=auth.uid();
 elsif invoker='service_role' or exists(select 1 from pg_catalog.pg_roles where rolname=invoker and rolsuper) then
   if tg_op='DELETE' then actor:=auth.uid(); else actor:=nullif(to_jsonb(new)->>'updated_by','')::uuid; end if;
 end if;
 if actor is null then raise exception 'Verified form actor required' using errcode='42501'; end if;
 if actor<>target_org then
   select role into member_role from public.organization_memberships where org_id=target_org and member_id=actor for share;

 end if;
 -- Board writers already serialize on this row; take canonical form locks in ID order.
 -- Do not acquire an organization lock after the board lock (publication uses org -> board -> form).
 for changed in select distinct (x->>'id')::uuid from jsonb_array_elements(previous||following) x order by 1 loop
   select coalesce(jsonb_agg(x->'content' order by (x->'content')::text),'[]') into old_content
     from jsonb_array_elements(previous) x where x->>'id'=changed::text;
   select coalesce(jsonb_agg(x->'content' order by (x->'content')::text),'[]') into new_content
     from jsonb_array_elements(following) x where x->>'id'=changed::text;
   if old_content=new_content then continue; end if;
   if jsonb_array_length(new_content)>1 then raise exception 'Conflicting form identity' using errcode='22023'; end if;
   if old_content='[]'::jsonb and new_content<>'[]'::jsonb then
     if actor<>target_org and coalesce(member_role,'') not in ('owner','admin','staff') then
       raise exception 'Form creation access required' using errcode='42501'; end if;
     insert into public.organization_forms(org_id,id,intake_manager,creator_id) values(target_org,changed,actor,actor)
       on conflict do nothing;
   end if;
   select intake_manager into manager from public.organization_forms where org_id=target_org and id=changed for update;
   if not found or not (
     ((actor=target_org or coalesce(member_role,'') in ('owner','admin','staff')) and public.can_edit_organization_form(target_org,changed,actor))
     or public.can_edit_invited_form(target_org,changed,actor))
     or (new_content='[]'::jsonb and not public.is_active_organization_form_primary(target_org,changed,actor)) then
     raise exception 'Form source manager required' using errcode='42501'; end if;
 end loop;
 if tg_op='DELETE' then return old; else return new; end if;
end; $$;

create or replace function public.organization_form_intake_before_closure(p_actor_id uuid,p_command jsonb) returns jsonb
 language plpgsql security definer set search_path='' as $$
declare v public.organization_form_versions%rowtype; page public.organization_workspace_pages%rowtype;
 r public.organization_form_responses%rowtype; previous public.organization_form_corrections%rowtype;
 cursor_row public.organization_form_responses%rowtype; snapshot jsonb; role_name text; manager uuid;
 deletion public.organization_form_response_deletions%rowtype;
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
 if action='delete_response' then
   -- Deletion is separate from Edit/Manage delegation, like source removal.
   if not editor or not public.is_active_organization_form_primary(v.org_id,v.form_id,p_actor_id) then
     raise exception 'Primary form manager required' using errcode='42501'; end if;
   if p_command->>'operationId' is null or (p_command->>'expectedRevision')::integer is null
     or (p_command->>'expectedRevision')::integer<1 then
     raise exception 'Invalid deletion' using errcode='22023'; end if;
   select * into deletion from public.organization_form_response_deletions
     where version_id=v.id and response_id=(p_command->>'id')::uuid;
   if found then
     if deletion.actor_id is distinct from p_actor_id or deletion.operation_id is distinct from (p_command->>'operationId')::uuid
       or deletion.response_revision is distinct from (p_command->>'expectedRevision')::integer then
       raise exception 'Deletion identity reused' using errcode='23505'; end if;
   else
     select * into r from public.organization_form_responses where version_id=v.id and id=(p_command->>'id')::uuid for update;
     if not found then raise exception 'Response unavailable' using errcode='42501'; end if;
     if r.revision is distinct from (p_command->>'expectedRevision')::integer then
       raise exception 'Response changed' using errcode='40001'; end if;
     insert into public.organization_form_response_deletions(version_id,response_id,operation_id,actor_id,response_revision,submitted_at)
       values(v.id,r.id,(p_command->>'operationId')::uuid,p_actor_id,r.revision,r.submitted_at) returning * into deletion;
     -- No answer-bearing audit/history. Corrections cascade in this transaction.
     delete from public.organization_form_responses where version_id=v.id and id=r.id;
   end if;
   return jsonb_build_object('id',deletion.response_id,'versionId',v.id,'operationId',deletion.operation_id,'deletedAt',deletion.deleted_at);
 end if;
 if action='version' or action='editor_version' then return v.version; end if;
 if action='response' then
   select * into r from public.organization_form_responses where version_id=v.id and id=(p_command->>'id')::uuid;
   if not found then raise exception 'Response unavailable' using errcode='42501'; end if;
   return public.organization_form_response_json(r);
 end if;
 if action='responses' then
   if p_command->>'before' is not null then
     select * into cursor_row from public.organization_form_responses where version_id=v.id and id=(p_command->>'before')::uuid;
     if not found then
       select response_id,submitted_at into cursor_row.id,cursor_row.submitted_at from public.organization_form_response_deletions where version_id=v.id and response_id=(p_command->>'before')::uuid;
     end if;
     if not found then raise exception 'Invalid response cursor' using errcode='22023'; end if;
   end if;
   select coalesce(jsonb_agg(public.organization_form_response_json(t) order by t.submitted_at desc,t.id desc),'[]'),count(*) into rows,row_count
     from (select * from public.organization_form_responses where version_id=v.id
       and (cursor_row.id is null or (submitted_at,id)<(cursor_row.submitted_at,cursor_row.id))
       order by submitted_at desc,id desc limit 50) t;
   return jsonb_build_object('version',v.version,'permissions',jsonb_build_object('canDelete',editor and public.is_active_organization_form_primary(v.org_id,v.form_id,p_actor_id),'canCorrect',(editor and public.can_edit_organization_form(v.org_id,v.form_id,p_actor_id)) or public.can_correct_invited_form_responses(v.org_id,v.form_id,p_actor_id),'canEditDefinition',(editor and public.can_edit_organization_form(v.org_id,v.form_id,p_actor_id)) or public.can_edit_invited_form(v.org_id,v.form_id,p_actor_id),'canManageAccess',editor and public.can_manage_organization_form(v.org_id,v.form_id,p_actor_id),'canManageInvitations',(editor and public.is_active_organization_form_primary(v.org_id,v.form_id,p_actor_id)) or public.can_manage_invited_form(v.org_id,v.form_id,p_actor_id),'hasPendingInvitation',exists(select 1 from public.organization_form_viewer_invitations pending join auth.users recipient on recipient.id=p_actor_id and recipient.email_confirmed_at is not null and lower(recipient.email)=pending.email where pending.org_id=v.org_id and pending.form_id=v.form_id and pending.accepted_by is null and public.valid_organization_form_invitation(pending.id))),'responses',rows,'next',case when row_count=50 then rows->49->>'id' else null end);
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
   if exists(select 1 from public.organization_form_response_deletions where version_id=v.id and response_id=(p_command->>'id')::uuid) then
     raise exception 'Submission deleted' using errcode='P0002'; end if;
   if found then
     if r.original_hash<>hash then raise exception 'Submission identity reused' using errcode='23505'; end if;
   else
     -- Serialized per canonical form, across republished versions. No IPs/answers in rate logs.
     select count(*) into row_count from public.organization_form_responses rr join public.organization_form_versions vv on vv.id=rr.version_id
       where vv.org_id=v.org_id and vv.form_id=v.form_id and rr.submitted_at>clock_timestamp()-interval '1 minute';
     row_count:=row_count+(select count(*) from public.organization_form_response_deletions d join public.organization_form_versions vv on vv.id=d.version_id
       where vv.org_id=v.org_id and vv.form_id=v.form_id and d.submitted_at>clock_timestamp()-interval '1 minute');
     if row_count>=60 then raise exception 'Submission rate exceeded' using errcode='54000'; end if;
     select count(*) into row_count from public.organization_form_responses rr join public.organization_form_versions vv on vv.id=rr.version_id
       where vv.org_id=v.org_id and vv.form_id=v.form_id and rr.submitted_at>clock_timestamp()-interval '1 day';
     row_count:=row_count+(select count(*) from public.organization_form_response_deletions d join public.organization_form_versions vv on vv.id=d.version_id
       where vv.org_id=v.org_id and vv.form_id=v.form_id and d.submitted_at>clock_timestamp()-interval '1 day');
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

create or replace function public.organization_form_review_access_before_closure(p_actor_id uuid,p_command jsonb) returns jsonb
 language plpgsql security definer set search_path='' as $$
<<access>>
declare
 v public.organization_form_versions%rowtype; f public.organization_forms%rowtype;
 previous public.organization_form_access_operations%rowtype; member uuid; member_role text;
 canonical boolean; delegated public.organization_form_reviewers%rowtype;
 action text:=p_command->>'action'; rows jsonb; n integer; hash text;
begin
 if p_command ? 'versionId' and (p_command ? 'organizationId' or p_command ? 'formId') then
   raise exception 'Choose one form target' using errcode='22023';
 end if;
 if not (p_command ? 'versionId') then
   select org_id,id into v.org_id,v.form_id from public.organization_forms
     where org_id=(p_command->>'organizationId')::uuid and id=(p_command->>'formId')::uuid;
 else
   select * into v from public.organization_form_versions where id=(p_command->>'versionId')::uuid;
 end if;
 if v.org_id is null or p_actor_id is null then raise exception 'Form access required' using errcode='42501'; end if;
 perform 1 from public.organizations where user_id=v.org_id for share;
 if p_actor_id<>v.org_id then
   select role into member_role from public.organization_memberships where org_id=v.org_id and member_id=p_actor_id for share;
   if member_role is null or member_role not in ('owner','admin','staff') then raise exception 'Form access required' using errcode='42501'; end if;
 end if;
 -- Lock target membership before form, matching response/recovery order.
 if action='grant_reviewer' then
   -- The owner is anchored by the locked organization, not an optional membership.
   select u.id into member from auth.users u where u.id=v.org_id
     and u.email_confirmed_at is not null and lower(u.email)=lower(trim(p_command->>'email'));
   if member is null then
     select m.member_id into member from public.organization_memberships m join auth.users u on u.id=m.member_id
       where m.org_id=v.org_id and m.role in ('owner','admin','staff') and u.email_confirmed_at is not null
         and lower(u.email)=lower(trim(p_command->>'email')) for share of m;
   end if;
 elsif action='revoke_reviewer' then
   member:=(p_command->>'memberId')::uuid;
   perform 1 from public.organization_memberships where org_id=v.org_id and member_id=member for share;
 end if;
 select * into f from public.organization_forms where org_id=v.org_id and id=v.form_id for update;
 if action='source_access' then
   return jsonb_build_object('formId',f.id,'canEdit',public.can_edit_organization_form(f.org_id,f.id,p_actor_id),
     'canManageAccess',public.can_manage_organization_form(f.org_id,f.id,p_actor_id));
 end if;
 canonical:=public.is_active_organization_form_primary(f.org_id,f.id,p_actor_id);
 if not public.can_manage_organization_form(f.org_id,f.id,p_actor_id) then raise exception 'Form manager required' using errcode='42501'; end if;
 if action='review_access' then
   select coalesce(jsonb_agg(jsonb_build_object('id',g.member_id,'email',coalesce(u.email,'Unavailable account'),'role',g.role) order by g.member_id),'[]'),count(*) into rows,n
     from public.organization_form_reviewers g join auth.users u on u.id=g.member_id
     where g.org_id=v.org_id and g.form_id=v.form_id and g.manager_revision=f.manager_revision and (canonical or g.granted_by=p_actor_id);
   return jsonb_build_object('formId',v.form_id,'revision',f.access_revision,'canGrantManage',canonical,'reviewers',rows);
 end if;
 if action not in ('grant_reviewer','revoke_reviewer') or p_command->>'operationId' is null
   or (p_command->>'expectedRevision')::integer is null then raise exception 'Invalid access command' using errcode='22023'; end if;
 if action='grant_reviewer' and coalesce(p_command->>'role','view') not in ('view','edit','manage') then
   raise exception 'Invalid form role' using errcode='22023'; end if;
 hash:=encode(sha256(convert_to(p_command::text,'UTF8')),'hex');
 select * into previous from public.organization_form_access_operations where org_id=v.org_id and operation_id=(p_command->>'operationId')::uuid;
 if found then
   if previous.actor_id<>p_actor_id or previous.operation_hash<>hash then raise exception 'Access operation reused' using errcode='23505'; end if;
   return jsonb_build_object('formId',previous.form_id,'operationId',previous.operation_id,'revision',previous.revision);
 end if;
 if f.access_revision<>(p_command->>'expectedRevision')::integer then raise exception 'Access changed' using errcode='40001'; end if;
 if member is null or member=p_actor_id or member=f.intake_manager then raise exception 'Choose an existing organization editor' using errcode='22023'; end if;
 select * into delegated from public.organization_form_reviewers
   where org_id=v.org_id and form_id=v.form_id and member_id=member and manager_revision=f.manager_revision;
 -- Only the canonical manager may grant Manage or replace another grantor's access.
 if not canonical and ((action='grant_reviewer' and coalesce(p_command->>'role','view')='manage')
   or (delegated.member_id is not null and delegated.granted_by<>p_actor_id)) then
   raise exception 'Access delegation not permitted' using errcode='42501'; end if;
 -- A downgrade/revocation ends its delegation chain. Canonical adoption of a
 -- child grant changes granted_by, so independently retained access survives.
 if delegated.role='manage' and (action='revoke_reviewer' or coalesce(p_command->>'role','view')<>'manage') then
   delete from public.organization_form_reviewers where org_id=v.org_id and form_id=v.form_id and granted_by=member;
 end if;
 if action='grant_reviewer' then
   -- Invalidated grants never reappear after manager recovery.
   delete from public.organization_form_reviewers where org_id=v.org_id and form_id=v.form_id and manager_revision<>f.manager_revision;
   select count(*) into n from public.organization_form_reviewers where org_id=v.org_id and form_id=v.form_id;
   if n>=50 and not exists(select 1 from public.organization_form_reviewers where org_id=v.org_id and form_id=v.form_id and member_id=member) then
     raise exception 'Reviewer limit reached' using errcode='54000'; end if;
   insert into public.organization_form_reviewers(org_id,form_id,member_id,manager_revision,granted_by,role)
     values(v.org_id,v.form_id,member,f.manager_revision,p_actor_id,coalesce(p_command->>'role','view'))
     on conflict (org_id,form_id,member_id) do update set role=excluded.role,granted_by=excluded.granted_by;
 else
   delete from public.organization_form_reviewers where org_id=v.org_id and form_id=v.form_id and member_id=member;
   if not found then raise exception 'Access changed' using errcode='40001'; end if;
 end if;
 update public.organization_forms set access_revision=access_revision+1 where org_id=v.org_id and id=v.form_id returning * into f;
 insert into public.organization_form_access_operations(org_id,operation_id,form_id,actor_id,operation_hash,member_id,enabled,revision)
   values(v.org_id,(p_command->>'operationId')::uuid,v.form_id,p_actor_id,hash,member,action='grant_reviewer',f.access_revision);
 return jsonb_build_object('formId',v.form_id,'operationId',p_command->>'operationId','revision',f.access_revision);
end; $$;

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
     public.is_active_organization_form_primary(f.org_id,f.id,p_actor_id)
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
 active_manager:=public.is_active_organization_form_primary(f.org_id,f.id,f.intake_manager);
 if not active_manager then raise exception 'Form access required' using errcode='42501'; end if;
 primary_manager:=public.is_active_organization_form_primary(f.org_id,f.id,p_actor_id);
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

commit;
