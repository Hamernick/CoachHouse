-- Explicit native response deletion. No timed response expiry or organization closure.
begin;
create table public.organization_form_response_deletions (
 version_id uuid not null references public.organization_form_versions(id) on delete cascade,
 response_id uuid not null,
 operation_id uuid not null,
 actor_id uuid references auth.users(id) on delete set null,
 response_revision integer not null check(response_revision>0),
 submitted_at timestamptz not null,
 deleted_at timestamptz not null default clock_timestamp(),
 primary key(version_id,response_id),
 unique(version_id,operation_id)
);
alter table public.organization_form_response_deletions enable row level security;
revoke all on public.organization_form_response_deletions from public,anon,authenticated,service_role;
comment on table public.organization_form_response_deletions is
 'Answer-free deletion suppression and exact-operation receipt. Retain while version admits intake; backup replay and independent suppression storage require qualification before activation.';
create index organization_form_response_deletions_rate on public.organization_form_response_deletions(version_id,submitted_at);

create or replace function public.organization_form_intake(p_actor_id uuid,p_command jsonb) returns jsonb
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
   if not editor or manager is distinct from p_actor_id then
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
   return jsonb_build_object('version',v.version,'permissions',jsonb_build_object('canDelete',editor and manager=p_actor_id,'canCorrect',(editor and public.can_edit_organization_form(v.org_id,v.form_id,p_actor_id)) or public.can_correct_invited_form_responses(v.org_id,v.form_id,p_actor_id),'canEditDefinition',(editor and public.can_edit_organization_form(v.org_id,v.form_id,p_actor_id)) or public.can_edit_invited_form(v.org_id,v.form_id,p_actor_id),'canManageAccess',editor and public.can_manage_organization_form(v.org_id,v.form_id,p_actor_id),'canManageInvitations',(editor and manager=p_actor_id) or public.can_manage_invited_form(v.org_id,v.form_id,p_actor_id),'hasPendingInvitation',exists(select 1 from public.organization_form_viewer_invitations pending join auth.users recipient on recipient.id=p_actor_id and recipient.email_confirmed_at is not null and lower(recipient.email)=pending.email where pending.org_id=v.org_id and pending.form_id=v.form_id and pending.accepted_by is null and public.valid_organization_form_invitation(pending.id))),'responses',rows,'next',case when row_count=50 then rows->49->>'id' else null end);
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
revoke all on function public.organization_form_intake(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.organization_form_intake(uuid,jsonb) to service_role;
commit;
