-- Native intake only. No Google answer queue; no page/organization-wide response grant.
begin;
create table public.organization_forms (
 org_id uuid not null references public.organizations(user_id) on delete cascade,
 id uuid not null,
 intake_manager uuid not null references auth.users(id),
 created_at timestamptz not null default now(),
 primary key(org_id,id)
);
create table public.organization_form_versions (
 id uuid primary key,
 org_id uuid not null,
 form_id uuid not null,
 page_id uuid not null references public.organization_workspace_pages(id),
 version jsonb not null check(jsonb_typeof(version)='object'),
 created_at timestamptz not null default now(),
 foreign key(org_id,form_id) references public.organization_forms(org_id,id) on delete cascade
);
create table public.organization_form_responses (
 version_id uuid not null references public.organization_form_versions(id) on delete cascade,
 id uuid not null,
 original_hash text not null check(original_hash ~ '^[a-f0-9]{64}$'),
 answers jsonb not null check(jsonb_typeof(answers)='array' and jsonb_array_length(answers)<=50 and octet_length(answers::text)<=262144),
 revision integer not null default 1 check(revision>0),
 submitted_at timestamptz not null default clock_timestamp(),
 updated_at timestamptz not null default clock_timestamp(),
 primary key(version_id,id)
);
create index organization_form_responses_order on public.organization_form_responses(version_id,submitted_at desc,id desc);
create index organization_form_versions_form on public.organization_form_versions(org_id,form_id);
create index organization_form_versions_page on public.organization_form_versions(page_id,created_at desc);
create table public.organization_form_corrections (
 version_id uuid not null,
 response_id uuid not null,
 operation_id uuid not null,
 actor_id uuid not null references auth.users(id),
 operation_hash text not null,
 question_id uuid not null,
 revision integer not null,
 corrected_at timestamptz not null default clock_timestamp(),
 primary key(version_id,response_id,operation_id),
 foreign key(version_id,response_id) references public.organization_form_responses(version_id,id) on delete cascade
);
alter table public.organization_forms enable row level security;
alter table public.organization_form_versions enable row level security;
alter table public.organization_form_responses enable row level security;
alter table public.organization_form_corrections enable row level security;
revoke all on public.organization_forms,public.organization_form_versions,public.organization_form_responses,public.organization_form_corrections from public,anon,authenticated,service_role;

-- Same atomic publication transaction, with immutable version ownership added.
alter function public.commit_workspace_page(uuid,uuid,uuid,uuid,text,integer,text,jsonb,jsonb,jsonb,timestamptz,jsonb,jsonb,uuid,jsonb,jsonb) rename to commit_workspace_page_with_assets;
revoke all on function public.commit_workspace_page_with_assets(uuid,uuid,uuid,uuid,text,integer,text,jsonb,jsonb,jsonb,timestamptz,jsonb,jsonb,uuid,jsonb,jsonb) from public,anon,authenticated,service_role;
create function public.commit_workspace_page(
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
   insert into public.organization_forms(org_id,id,intake_manager) values(p_org_id,(v->>'formId')::uuid,p_actor_id)
     on conflict do nothing;
   select intake_manager into manager from public.organization_forms where org_id=p_org_id and id=(v->>'formId')::uuid for update;
   if manager<>p_actor_id then raise exception 'Form manager required' using errcode='42501'; end if;
   insert into public.organization_form_versions(id,org_id,form_id,page_id,version)
     values((v->>'id')::uuid,p_org_id,(v->>'formId')::uuid,p_page_id,v);
 end loop;
 return result;
end; $$;
revoke all on function public.commit_workspace_page(uuid,uuid,uuid,uuid,text,integer,text,jsonb,jsonb,jsonb,timestamptz,jsonb,jsonb,uuid,jsonb,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.commit_workspace_page(uuid,uuid,uuid,uuid,text,integer,text,jsonb,jsonb,jsonb,timestamptz,jsonb,jsonb,uuid,jsonb,jsonb,jsonb) to service_role;

create function public.organization_form_response_json(r public.organization_form_responses) returns jsonb
 language sql immutable set search_path='' as $$
 select jsonb_build_object('id',r.id,'versionId',r.version_id,'answers',r.answers,'revision',r.revision,
   'submittedAt',r.submitted_at,'updatedAt',r.updated_at);
$$;
revoke all on function public.organization_form_response_json(public.organization_form_responses) from public,anon,authenticated,service_role;

-- Server-only commands. The HTTP boundary validates answers using the stored
-- immutable version; the transaction compares that exact version again.
create function public.organization_form_intake(p_actor_id uuid,p_command jsonb) returns jsonb
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
 if action not in ('version','submit') and manager is distinct from p_actor_id then
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
   return jsonb_build_object('version',v.version,'responses',rows,'next',case when row_count=50 then rows->49->>'id' else null end);
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

create function public.list_organization_form_versions(p_actor_id uuid,p_page_id uuid,p_before uuid default null)
 returns jsonb language plpgsql security definer set search_path='' as $$
declare org uuid; role_name text; versions jsonb; cursor_row public.organization_form_versions%rowtype; count_rows integer;
begin
 select org_id into org from public.organization_workspace_pages where id=p_page_id;
 if not found or p_actor_id is null then raise exception 'Page unavailable' using errcode='42501'; end if;
 perform 1 from public.organizations where user_id=org for share;
 if p_actor_id<>org then
   select role into role_name from public.organization_memberships where org_id=org and member_id=p_actor_id for share;
   if role_name is null or role_name not in ('owner','admin','staff') then raise exception 'Form access required' using errcode='42501'; end if;
 end if;
 if p_before is not null then
   select v.* into cursor_row from public.organization_form_versions v join public.organization_forms f on f.org_id=v.org_id and f.id=v.form_id
     where v.id=p_before and v.page_id=p_page_id and f.intake_manager=p_actor_id;
   if not found then raise exception 'Invalid cursor' using errcode='22023'; end if;
 end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',v.id,'title',v.version->>'title','revision',v.version->'revision','createdAt',v.created_at) order by v.created_at desc,v.id desc),'[]'),count(*) into versions,count_rows
   from (select vv.* from public.organization_form_versions vv join public.organization_forms f on f.org_id=vv.org_id and f.id=vv.form_id
     where vv.page_id=p_page_id and vv.org_id=org and f.intake_manager=p_actor_id
       and (p_before is null or (vv.created_at,vv.id)<(cursor_row.created_at,cursor_row.id))
     order by vv.created_at desc,vv.id desc limit 50) v;
 return jsonb_build_object('versions',versions,'next',case when count_rows=50 then versions->49->>'id' else null end);
end; $$;
revoke all on function public.list_organization_form_versions(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.list_organization_form_versions(uuid,uuid,uuid) to service_role;
commit;
