-- Explicit read-only response review for existing organization editors.
-- No organization role, page role, assignment or public link grants response access.
begin;
alter table public.organization_forms add column access_revision integer not null default 1 check(access_revision>0);
create table public.organization_form_reviewers (
 org_id uuid not null, form_id uuid not null, member_id uuid not null,
 manager_revision integer not null, granted_by uuid not null, created_at timestamptz not null default now(),
 primary key(org_id,form_id,member_id),
 foreign key(org_id,form_id) references public.organization_forms(org_id,id) on delete cascade,
 foreign key(org_id,member_id) references public.organization_memberships(org_id,member_id) on delete cascade
);
create table public.organization_form_access_operations (
 org_id uuid not null, operation_id uuid not null, form_id uuid not null, actor_id uuid not null,
 operation_hash text not null, member_id uuid not null, enabled boolean not null, revision integer not null,
 created_at timestamptz not null default now(), primary key(org_id,operation_id),
 foreign key(org_id,form_id) references public.organization_forms(org_id,id) on delete cascade
);
alter table public.organization_form_reviewers enable row level security;
alter table public.organization_form_access_operations enable row level security;
revoke all on public.organization_form_reviewers,public.organization_form_access_operations from public,anon,authenticated,service_role;

-- Caller holds the organization/member/form locks appropriate to its operation.
create function public.can_review_organization_form(p_org uuid,p_form uuid,p_actor uuid) returns boolean
 language sql stable set search_path='' as $$
 select exists(select 1 from public.organization_forms f where f.org_id=p_org and f.id=p_form
   and (f.intake_manager=p_actor or exists(select 1 from public.organization_form_reviewers g
     where g.org_id=f.org_id and g.form_id=f.id and g.member_id=p_actor and g.manager_revision=f.manager_revision)));
$$;
revoke all on function public.can_review_organization_form(uuid,uuid,uuid) from public,anon,authenticated,service_role;

create function public.organization_form_review_access(p_actor_id uuid,p_command jsonb) returns jsonb
 language plpgsql security definer set search_path='' as $$
<<access>>
declare
 v public.organization_form_versions%rowtype; f public.organization_forms%rowtype;
 previous public.organization_form_access_operations%rowtype; member uuid; member_role text;
 action text:=p_command->>'action'; rows jsonb; n integer; hash text;
begin
 select * into v from public.organization_form_versions where id=(p_command->>'versionId')::uuid;
 if not found or p_actor_id is null then raise exception 'Form access required' using errcode='42501'; end if;
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
 if f.intake_manager is distinct from p_actor_id then raise exception 'Form manager required' using errcode='42501'; end if;
 if action='review_access' then
   select coalesce(jsonb_agg(jsonb_build_object('id',g.member_id,'email',coalesce(u.email,'Unavailable account')) order by g.member_id),'[]'),count(*) into rows,n
     from public.organization_form_reviewers g join auth.users u on u.id=g.member_id
     where g.org_id=v.org_id and g.form_id=v.form_id and g.manager_revision=f.manager_revision;
   return jsonb_build_object('formId',v.form_id,'revision',f.access_revision,'reviewers',rows);
 end if;
 if action not in ('grant_reviewer','revoke_reviewer') or p_command->>'operationId' is null
   or (p_command->>'expectedRevision')::integer is null then raise exception 'Invalid access command' using errcode='22023'; end if;
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
   insert into public.organization_form_reviewers(org_id,form_id,member_id,manager_revision,granted_by)
     values(v.org_id,v.form_id,member,f.manager_revision,p_actor_id) on conflict do nothing;
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
   or (action='correct' and manager is distinct from p_actor_id)) then
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
   return jsonb_build_object('version',v.version,'permissions',jsonb_build_object('canCorrect',manager=p_actor_id,'canManageAccess',manager=p_actor_id),'responses',rows,'next',case when row_count=50 then rows->49->>'id' else null end);
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

create or replace function public.list_organization_form_versions(p_actor_id uuid,p_page_id uuid,p_before uuid default null)
 returns jsonb language plpgsql security definer set search_path='' as $$
declare org uuid; role_name text; versions jsonb; cursor_row public.organization_form_versions%rowtype; count_rows integer;
begin
 select org_id into org from public.organization_workspace_pages where id=p_page_id;
 if not found or p_actor_id is null then raise exception 'Page unavailable' using errcode='42501'; end if;
 perform 1 from public.organizations where user_id=org for update;
 if p_actor_id<>org then
   select role into role_name from public.organization_memberships where org_id=org and member_id=p_actor_id for share;
   if role_name is null or role_name not in ('owner','admin','staff') then raise exception 'Form access required' using errcode='42501'; end if;
 end if;
 if p_before is not null then
   select v.* into cursor_row from public.organization_form_versions v join public.organization_forms f on f.org_id=v.org_id and f.id=v.form_id
     where v.id=p_before and v.page_id=p_page_id and public.can_review_organization_form(f.org_id,f.id,p_actor_id);
   if not found then raise exception 'Invalid cursor' using errcode='22023'; end if;
 end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',v.id,'title',v.version->>'title','revision',v.version->'revision','createdAt',v.created_at) order by v.created_at desc,v.id desc),'[]'),count(*) into versions,count_rows
   from (select vv.* from public.organization_form_versions vv join public.organization_forms f on f.org_id=vv.org_id and f.id=vv.form_id
     where vv.page_id=p_page_id and vv.org_id=org and public.can_review_organization_form(f.org_id,f.id,p_actor_id)
       and (p_before is null or (vv.created_at,vv.id)<(cursor_row.created_at,cursor_row.id))
     order by vv.created_at desc,vv.id desc limit 50) v;
 return jsonb_build_object('versions',versions,'next',case when count_rows=50 then versions->49->>'id' else null end);
end; $$;
revoke all on function public.list_organization_form_versions(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.list_organization_form_versions(uuid,uuid,uuid) to service_role;
commit;
