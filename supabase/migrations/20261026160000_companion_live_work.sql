-- Companion uses user-scoped Supabase sessions held by the OAuth broker.
-- Apply only after review. This file does not configure or deploy OAuth.
create table if not exists public.companion_assignment_drafts (
  user_id uuid not null references public.profiles(id) on delete cascade,
  org_id uuid not null references public.organizations(user_id) on delete cascade,
  module_id uuid not null references public.modules(id) on delete cascade,
  answers jsonb not null default '{}'::jsonb check (jsonb_typeof(answers) = 'object' and octet_length(answers::text) <= 100000),
  revision bigint not null default 0 check (revision >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, org_id, module_id)
);
create table if not exists public.companion_mutation_receipts (
  user_id uuid not null references public.profiles(id) on delete cascade,
  client_id text not null check (length(client_id) between 1 and 200),
  request_id text not null check (request_id ~ '^[A-Za-z0-9_-]{8,100}$'),
  org_id uuid not null references public.organizations(user_id) on delete cascade,
  action text not null,
  fingerprint text not null,
  result jsonb not null,
  created_at timestamptz not null default now(),
  primary key (user_id, client_id, request_id)
);
alter table public.companion_assignment_drafts enable row level security;
alter table public.companion_assignment_drafts force row level security;
alter table public.companion_mutation_receipts enable row level security;
alter table public.companion_mutation_receipts force row level security;
-- No direct table access. Mutations and reads below recheck current authorization.
revoke all on public.companion_assignment_drafts, public.companion_mutation_receipts from public, anon, authenticated;

create or replace function public.companion_authorize(p_org_id uuid, p_edit_organization boolean default false)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid(); member_role text; org_profile jsonb; entitled boolean := false; sub record; tier text; plan_name text;
begin
  if actor is null or p_org_id is null then raise exception 'forbidden'; end if;
  select profile into org_profile from public.organizations where user_id = p_org_id;
  if not found then raise exception 'forbidden'; end if;
  if actor = p_org_id then member_role := 'owner';
  else
    select role::text into member_role from public.organization_memberships
      where org_id = p_org_id and member_id = actor for share;
  end if;
  if member_role is null or member_role not in ('owner','admin','staff','board','member') then raise exception 'forbidden'; end if;
  if p_edit_organization and member_role not in ('owner','admin','staff') then raise exception 'forbidden'; end if;
  select exists(select 1 from public.accelerator_purchases where user_id = actor and status = 'active') into entitled;
  -- Match the app's latest active/trialing non-stub subscription and paid-plan predicate,
  -- including its older member-owned subscription fallback. No Stripe sync or admin bypass.
  if not entitled then
    for sub in
      select distinct on (user_id) user_id, metadata from public.subscriptions
      where user_id in (p_org_id, actor) and status in ('active','trialing')
        and stripe_subscription_id not ilike 'stub_%'
      order by user_id, created_at desc
    loop
      tier := lower(trim(coalesce(sub.metadata->>'plan_tier','')));
      plan_name := lower(trim(coalesce(sub.metadata->>'planName','')));
      if tier in ('organization','operations_support') or (plan_name <> '' and position('free' in plan_name) = 0) then entitled := true; end if;
    end loop;
  end if;
  if not entitled then raise exception 'forbidden'; end if;
  return jsonb_build_object('role', member_role, 'name', coalesce(nullif(org_profile->>'name',''), 'Organization'));
end $$;

create or replace function public.companion_require_lesson(p_module_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'forbidden'; end if;
  perform 1 from public.modules m join public.classes c on c.id = m.class_id
    where m.id = p_module_id and m.is_published and c.is_published for share of m, c;
  if not found then raise exception 'lesson_unavailable'; end if;
end $$;

create or replace function public.companion_read_draft(p_org_id uuid, p_module_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare draft public.companion_assignment_drafts; base jsonb;
begin
  perform public.companion_authorize(p_org_id, false);
  perform public.companion_require_lesson(p_module_id);
  select * into draft from public.companion_assignment_drafts where user_id = auth.uid() and org_id = p_org_id and module_id = p_module_id;
  if found then return jsonb_build_object('answers', draft.answers, 'revision', draft.revision, 'updated_at', draft.updated_at); end if;
  select answers into base from public.assignment_submissions where user_id = auth.uid() and module_id = p_module_id;
  return jsonb_build_object('answers',coalesce(base,'{}'::jsonb),'revision',0,'updated_at',null);
end $$;

create or replace function public.companion_write_assignment(
  p_org_id uuid, p_module_id uuid, p_client_id text, p_request_id text,
  p_expected_revision bigint, p_answers jsonb, p_submit boolean, p_confirmed boolean,
  p_expected_submission_at timestamptz, p_expected_assignment_at timestamptz, p_completed boolean
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid(); draft public.companion_assignment_drafts; prior public.companion_mutation_receipts;
  submitted public.assignment_submissions; assignment public.module_assignments; fp text; result jsonb; action_name text; affected integer;
begin
  perform public.companion_authorize(p_org_id, false);
  perform public.companion_require_lesson(p_module_id);
  if p_client_id is null or length(p_client_id) not between 1 and 200 or p_request_id is null or p_request_id !~ '^[A-Za-z0-9_-]{8,100}$'
     or p_expected_revision is null or p_expected_revision < 0 or p_submit is null
     or p_answers is null or jsonb_typeof(p_answers) <> 'object' or octet_length(p_answers::text) > 100000 then raise exception 'invalid_arguments'; end if;
  if p_submit and p_confirmed is distinct from true then raise exception 'confirmation_required'; end if;
  action_name := case when p_submit then 'submit_assignment' else 'save_draft' end;
  fp := encode(sha256(convert_to(jsonb_build_object('org',p_org_id,'module',p_module_id,'action',action_name,'revision',p_expected_revision,
    'submissionRevision',case when p_submit then p_expected_submission_at else null end,'answers',case when p_submit then null else p_answers end)::text,'UTF8')),'hex');
  perform pg_advisory_xact_lock(hashtextextended(actor::text || ':' || p_client_id || ':' || p_request_id,0));
  select * into prior from public.companion_mutation_receipts where user_id=actor and client_id=p_client_id and request_id=p_request_id;
  if found then
    if prior.fingerprint <> fp then raise exception 'idempotency_conflict'; end if;
    return prior.result || jsonb_build_object('alreadyApplied',true);
  end if;
  perform pg_advisory_xact_lock(hashtextextended(actor::text || ':' || p_org_id::text || ':' || p_module_id::text,0));
  select * into assignment from public.module_assignments where module_id=p_module_id for share;
  if not found then raise exception 'lesson_unavailable'; end if;
  if assignment.updated_at is distinct from p_expected_assignment_at then raise exception 'revision_conflict'; end if;
  select * into submitted from public.assignment_submissions where user_id=actor and module_id=p_module_id for update;
  insert into public.companion_assignment_drafts(user_id,org_id,module_id,answers)
    values(actor,p_org_id,p_module_id,coalesce(submitted.answers,'{}'::jsonb)) on conflict do nothing;
  select * into draft from public.companion_assignment_drafts where user_id=actor and org_id=p_org_id and module_id=p_module_id for update;
  if draft.revision <> p_expected_revision then raise exception 'revision_conflict'; end if;
  if p_submit then
    if submitted.updated_at is distinct from p_expected_submission_at then raise exception 'revision_conflict'; end if;
    -- Assignment is personal in the existing app (module_id,user_id). The app derives
    -- completion uses the existing pure app rule in the authenticated application service.
    -- The derived flag never appears in the MCP input schema, and only affects the actor's progress (same permission as the existing own-user progress writer).
    insert into public.assignment_submissions(module_id,user_id,answers,status)
      values(p_module_id,actor,p_answers,'submitted')
      on conflict(module_id,user_id) do update set answers=excluded.answers,status='submitted',updated_at=clock_timestamp()
      where public.assignment_submissions.updated_at is not distinct from p_expected_submission_at;
    get diagnostics affected = row_count;
    if affected <> 1 then raise exception 'revision_conflict'; end if;
    if p_completed and assignment.complete_on_submit then
      insert into public.module_progress(user_id,module_id,status,completed_at) values(actor,p_module_id,'completed',clock_timestamp())
        on conflict(user_id,module_id) do update set status='completed',completed_at=coalesce(public.module_progress.completed_at,excluded.completed_at),updated_at=clock_timestamp();
    end if;
  else
    update public.companion_assignment_drafts set answers=draft.answers || p_answers, revision=revision+1,updated_at=clock_timestamp()
      where user_id=actor and org_id=p_org_id and module_id=p_module_id;
  end if;
  result := jsonb_build_object('applied',true,'action',action_name);
  insert into public.companion_mutation_receipts(user_id,client_id,request_id,org_id,action,fingerprint,result)
    values(actor,p_client_id,p_request_id,p_org_id,action_name,fp,result);
  return result;
end $$;

create or replace function public.companion_document_retry(p_org_id uuid,p_document_id text,p_client_id text,p_request_id text,p_revision text,p_content text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare prior public.companion_mutation_receipts; fp text;
begin
  perform public.companion_authorize(p_org_id,true);
  fp := encode(sha256(convert_to(jsonb_build_object('org',p_org_id,'document',p_document_id,'revision',p_revision,'content',p_content)::text,'UTF8')),'hex');
  select * into prior from public.companion_mutation_receipts where user_id=auth.uid() and client_id=p_client_id and request_id=p_request_id;
  if not found then return null; end if;
  if prior.action <> 'save_document' or prior.fingerprint <> fp then raise exception 'idempotency_conflict'; end if;
  return prior.result;
end $$;

create or replace function public.companion_save_document(
  p_org_id uuid,p_document_id text,p_client_id text,p_request_id text,p_revision text,p_content text,
  p_expected_profile jsonb,p_expected_updated_at timestamptz,p_confirmed boolean
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid(); org public.organizations; prior jsonb; fp text; result jsonb;
  section_id text; roadmap jsonb; sections jsonb; target jsonb; next_target jsonb; next_sections jsonb;
  target_index integer; matches integer; html text; preserved text; legacy jsonb; legacy_key text; controlled boolean;
begin
  perform public.companion_authorize(p_org_id,true);
  if p_confirmed is distinct from true then raise exception 'confirmation_required'; end if;
  if p_document_id is null or p_document_id not in ('originStory','need','mission','vision','values','theoryOfChange')
    or p_client_id is null or length(p_client_id) not between 1 and 200 or p_request_id is null or p_request_id !~ '^[A-Za-z0-9_-]{8,100}$'
    or p_revision is null or p_revision !~ '^[a-f0-9]{64}$' or p_content is null or length(trim(p_content)) not between 1 and 12000
    or p_expected_profile is null or jsonb_typeof(p_expected_profile) <> 'object' then raise exception 'invalid_arguments'; end if;
  perform pg_advisory_xact_lock(hashtextextended(actor::text || ':' || p_client_id || ':' || p_request_id,0));
  prior := public.companion_document_retry(p_org_id,p_document_id,p_client_id,p_request_id,p_revision,p_content);
  if prior is not null then return prior || jsonb_build_object('alreadyApplied',true); end if;
  select * into org from public.organizations where user_id=p_org_id for update;
  if org.profile is distinct from p_expected_profile or org.updated_at is distinct from p_expected_updated_at then raise exception 'revision_conflict'; end if;
  section_id := case p_document_id when 'mission' then 'mission_vision_values' when 'originStory' then 'origin_story' when 'theoryOfChange' then 'theory_of_change' else p_document_id end;
  roadmap := coalesce(org.profile->'roadmap','{}'::jsonb);
  if jsonb_typeof(roadmap) <> 'object' then raise exception 'document_structure'; end if;
  sections := coalesce(roadmap->'sections','[]'::jsonb);
  if jsonb_typeof(sections) = 'array' then
    select count(*),min(ordinality-1)::integer into matches,target_index from jsonb_array_elements(sections) with ordinality item(value,ordinality) where value->>'id'=section_id;
    if matches > 1 then raise exception 'document_structure'; end if;
    target := case when matches=1 then sections->target_index else jsonb_build_object('id',section_id) end;
  elsif jsonb_typeof(sections) = 'object' then
    target := coalesce(sections->section_id,jsonb_build_object('id',section_id));
  else raise exception 'document_structure'; end if;
  if jsonb_typeof(target) <> 'object' then raise exception 'document_structure'; end if;
  -- Content is plain approved text, never caller-supplied HTML or a profile delta.
  select string_agg('<p>' || replace(replace(replace(replace(paragraph,'&','&amp;'),'<','&lt;'),'>','&gt;'),E'\n','<br>') || '</p>','' order by ordinal)
    into html from regexp_split_to_table(trim(p_content), E'\n{2,}') with ordinality part(paragraph,ordinal);
  controlled := target->'publicProfileStatusControlled' = 'true'::jsonb;
  if controlled is distinct from true then
    -- Same legacy-publication fallback used by resolveLegacyPublicProfileSectionContent.
    if p_document_id in ('mission','vision','values') and jsonb_typeof(target->'lastUpdated')='string' then preserved := coalesce(target->>'content','');
    else
      preserved := '';
      foreach legacy_key in array case p_document_id
        when 'originStory' then array['origin_story','originStory']
        when 'need' then array['need','needStatement','need_statement']
        when 'theoryOfChange' then array['theory_of_change','theoryOfChange']
        else array[p_document_id] end
      loop
        legacy := org.profile->legacy_key;
        if jsonb_typeof(legacy)='string' then preserved := regexp_replace(legacy#>>'{}','^[[:space:]]+|[[:space:]]+$','','g');
        elsif jsonb_typeof(legacy)='array' then
          select string_agg(regexp_replace(value#>>'{}','^[[:space:]]+|[[:space:]]+$','','g'),E'\n' order by ordinal) into preserved
            from jsonb_array_elements(legacy) with ordinality entry(value,ordinal)
            where jsonb_typeof(value)='string' and regexp_replace(value#>>'{}','^[[:space:]]+|[[:space:]]+$','','g')<>'';
        else preserved := ''; end if;
        if coalesce(preserved,'')<>'' then exit; end if;
      end loop;
      preserved := coalesce(preserved,'');
    end if;
  elsif target->>'status'='complete' then preserved := coalesce(target->>'content','');
  else preserved := case when jsonb_typeof(target->'publishedContent')='string' then target->>'publishedContent' else null end;
  end if;
  next_target := target || jsonb_build_object('id',section_id,'content',html,'status','in_progress','lastUpdated',clock_timestamp(),'publicProfileStatusControlled',true);
  if preserved is not null then next_target:=next_target || jsonb_build_object('publishedContent',preserved); else next_target:=next_target-'publishedContent'; end if;
  if jsonb_typeof(sections)='object' then next_sections:=jsonb_set(sections,array[section_id],next_target,true);
  elsif target_index is null then next_sections:=sections || jsonb_build_array(next_target);
  else next_sections:=jsonb_set(sections,array[target_index::text],next_target,false); end if;
  update public.organizations set profile=jsonb_set(org.profile,'{roadmap}',roadmap || jsonb_build_object('sections',next_sections),true),updated_at=clock_timestamp() where user_id=p_org_id;
  fp := encode(sha256(convert_to(jsonb_build_object('org',p_org_id,'document',p_document_id,'revision',p_revision,'content',p_content)::text,'UTF8')),'hex');
  result := jsonb_build_object('applied',true,'action','save_document');
  insert into public.companion_mutation_receipts(user_id,client_id,request_id,org_id,action,fingerprint,result)
    values(actor,p_client_id,p_request_id,p_org_id,'save_document',fp,result);
  return result;
end $$;

-- Supabase default PUBLIC EXECUTE must not expose these entry points to anonymous callers.
revoke all on function public.companion_authorize(uuid,boolean), public.companion_require_lesson(uuid), public.companion_read_draft(uuid,uuid),
  public.companion_write_assignment(uuid,uuid,text,text,bigint,jsonb,boolean,boolean,timestamptz,timestamptz,boolean),
  public.companion_document_retry(uuid,text,text,text,text,text), public.companion_save_document(uuid,text,text,text,text,text,jsonb,timestamptz,boolean) from public,anon;
grant execute on function public.companion_authorize(uuid,boolean), public.companion_read_draft(uuid,uuid),
  public.companion_write_assignment(uuid,uuid,text,text,bigint,jsonb,boolean,boolean,timestamptz,timestamptz,boolean),
  public.companion_document_retry(uuid,text,text,text,text,text), public.companion_save_document(uuid,text,text,text,text,text,jsonb,timestamptz,boolean) to authenticated;
