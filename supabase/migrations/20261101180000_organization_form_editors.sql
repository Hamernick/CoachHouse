-- Form-scoped Edit grants. Publication, source removal and delegation stay manager-only.
begin;
alter table public.organization_form_reviewers add column role text not null default 'view' check(role in ('view','edit'));
-- Caller holds the active organization/member and canonical form fences.
create function public.can_edit_organization_form(p_org uuid,p_form uuid,p_actor uuid) returns boolean
 language sql stable set search_path='' as $$
 select exists(select 1 from public.organization_forms f where f.org_id=p_org and f.id=p_form
   and (f.intake_manager=p_actor or exists(select 1 from public.organization_form_reviewers g
     where g.org_id=f.org_id and g.form_id=f.id and g.member_id=p_actor
       and g.manager_revision=f.manager_revision and g.role='edit')));
$$;
revoke all on function public.can_edit_organization_form(uuid,uuid,uuid) from public,anon,authenticated,service_role;
create or replace function public.organization_form_review_access(p_actor_id uuid,p_command jsonb) returns jsonb
 language plpgsql security definer set search_path='' as $$
<<access>>
declare
 v public.organization_form_versions%rowtype; f public.organization_forms%rowtype;
 previous public.organization_form_access_operations%rowtype; member uuid; member_role text;
 action text:=p_command->>'action'; rows jsonb; n integer; hash text;
begin
 if action='source_access' then
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
   select m.member_id into member from public.organization_memberships m join auth.users u on u.id=m.member_id
     where m.org_id=v.org_id and m.role in ('owner','admin','staff') and u.email_confirmed_at is not null
       and lower(u.email)=lower(trim(p_command->>'email')) for share of m;
 elsif action='revoke_reviewer' then
   member:=(p_command->>'memberId')::uuid;
   perform 1 from public.organization_memberships where org_id=v.org_id and member_id=member for share;
 end if;
 select * into f from public.organization_forms where org_id=v.org_id and id=v.form_id for update;
 if action='source_access' then
   return jsonb_build_object('formId',f.id,'canEdit',public.can_edit_organization_form(f.org_id,f.id,p_actor_id));
 end if;
 if f.intake_manager is distinct from p_actor_id then raise exception 'Form manager required' using errcode='42501'; end if;
 if action='review_access' then
   select coalesce(jsonb_agg(jsonb_build_object('id',g.member_id,'email',coalesce(u.email,'Unavailable account'),'role',g.role) order by g.member_id),'[]'),count(*) into rows,n
     from public.organization_form_reviewers g join auth.users u on u.id=g.member_id
     where g.org_id=v.org_id and g.form_id=v.form_id and g.manager_revision=f.manager_revision;
   return jsonb_build_object('formId',v.form_id,'revision',f.access_revision,'reviewers',rows);
 end if;
 if action not in ('grant_reviewer','revoke_reviewer') or p_command->>'operationId' is null
   or (p_command->>'expectedRevision')::integer is null then raise exception 'Invalid access command' using errcode='22023'; end if;
 if action='grant_reviewer' and coalesce(p_command->>'role','view') not in ('view','edit') then
   raise exception 'Invalid form role' using errcode='22023'; end if;
 hash:=encode(sha256(convert_to(p_command::text,'UTF8')),'hex');
 select * into previous from public.organization_form_access_operations where org_id=v.org_id and operation_id=(p_command->>'operationId')::uuid;
 if found then
   if previous.actor_id<>p_actor_id or previous.operation_hash<>hash then raise exception 'Access operation reused' using errcode='23505'; end if;
   return jsonb_build_object('formId',previous.form_id,'operationId',previous.operation_id,'revision',previous.revision);
 end if;
 if f.access_revision<>(p_command->>'expectedRevision')::integer then raise exception 'Access changed' using errcode='40001'; end if;
 if member is null or member=p_actor_id then raise exception 'Choose an existing organization editor' using errcode='22023'; end if;
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
revoke all on function public.organization_form_review_access(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.organization_form_review_access(uuid,jsonb) to service_role;

create or replace function public.organization_form_intake(p_actor_id uuid,p_command jsonb) returns jsonb
 language plpgsql security definer set search_path='' as $$
declare v public.organization_form_versions%rowtype; page public.organization_workspace_pages%rowtype;
 r public.organization_form_responses%rowtype; previous public.organization_form_corrections%rowtype;
 cursor_row public.organization_form_responses%rowtype; snapshot jsonb; role_name text; manager uuid;
 action text:=p_command->>'action'; rows jsonb; receipt jsonb; row_count integer; hash text;
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
   if p_actor_id is null or (p_actor_id<>v.org_id and (role_name is null or role_name not in ('owner','admin','staff'))) then
     raise exception 'Form access required' using errcode='42501'; end if;
 end if;
 select intake_manager into manager from public.organization_forms where org_id=v.org_id and id=v.form_id for update;
 if action not in ('version','submit') and (not public.can_review_organization_form(v.org_id,v.form_id,p_actor_id)
   or (action='correct' and not public.can_edit_organization_form(v.org_id,v.form_id,p_actor_id))) then
   raise exception 'Form access required' using errcode='42501'; end if;
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
   return jsonb_build_object('version',v.version,'permissions',jsonb_build_object('canCorrect',public.can_edit_organization_form(v.org_id,v.form_id,p_actor_id),'canManageAccess',manager=p_actor_id),'responses',rows,'next',case when row_count=50 then rows->49->>'id' else null end);
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
   if member_role is null or member_role not in ('owner','admin','staff') then
     raise exception 'Form source access required' using errcode='42501'; end if;
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
     insert into public.organization_forms(org_id,id,intake_manager,creator_id) values(target_org,changed,actor,actor)
       on conflict do nothing;
   end if;
   select intake_manager into manager from public.organization_forms where org_id=target_org and id=changed for update;
   if not found or not public.can_edit_organization_form(target_org,changed,actor)
     or (new_content='[]'::jsonb and manager is distinct from actor) then
     raise exception 'Form source manager required' using errcode='42501'; end if;
 end loop;
 if tg_op='DELETE' then return old; else return new; end if;
end; $$;
revoke all on function public.guard_workspace_form_sources() from public,anon,authenticated,service_role;
commit;
