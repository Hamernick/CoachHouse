-- Preserve document input identities before run retirement removes target data.
-- These observations are deliberately incomplete: editor text/explicit selections
-- can contain copied sources whose identities were never recorded.
begin;
create table public.workspace_ai_document_origins (
 run_id uuid primary key,
 org_id uuid not null,
 actor_id uuid not null,
 source jsonb,
 observed_at_creation boolean not null,
 captured_at timestamptz not null default clock_timestamp(),
 check(source is null or (jsonb_typeof(source)='object' and octet_length(source::text)<=2000))
);
create index workspace_ai_document_origins_org on public.workspace_ai_document_origins(org_id);
alter table public.workspace_ai_document_origins enable row level security;
alter table public.workspace_ai_document_origins force row level security;
revoke all on public.workspace_ai_document_origins from public,anon,authenticated,service_role;
-- No cascade from runs, application receipts, chats or mutable profile content.
create trigger workspace_ai_document_origins_immutable before update or delete on public.workspace_ai_document_origins
 for each row execute function public.ai_credit_immutable();
create trigger workspace_ai_document_origins_retained before truncate on public.workspace_ai_document_origins
 for each statement execute function public.ai_credit_immutable();

create function public.capture_workspace_ai_document_origin(p_run public.workspace_ai_runs,p_created boolean)
returns void language plpgsql security definer set search_path='' as $$
declare origin_target jsonb:=p_run.target; source jsonb; parent_id uuid; parent_known boolean:=false;
begin
 if p_run.task is distinct from 'document' then return;end if;
 if exists(select 1 from public.workspace_ai_document_origins where run_id=p_run.id) then return;end if;
 -- Never retain prompt, title, body, selection HTML, proposal or arbitrary target
 -- fields. Missing/retired/malformed historical targets remain unresolved.
 if jsonb_typeof(origin_target)='object'
  and jsonb_typeof(origin_target->'sectionId')='string' and length(origin_target->>'sectionId') between 1 and 120
  and (origin_target->>'sectionId') ~ '^[a-zA-Z0-9_:-]+$'
  and (origin_target->>'organizationId' is null or origin_target->>'organizationId'=p_run.org_id::text)
  and (origin_target->>'userId' is null or origin_target->>'userId'=p_run.actor_id::text)
  and (origin_target->'revision' is null or origin_target->'revision'='null'::jsonb or
   (jsonb_typeof(origin_target->'revision')='string' and length(origin_target->>'revision')<=200)) then
  if origin_target->>'revisionSourceRunId' ~* '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$' then
   parent_id:=(origin_target->>'revisionSourceRunId')::uuid;
   select exists(select 1 from public.workspace_ai_runs r where r.id=parent_id and r.id<>p_run.id
    and r.org_id=p_run.org_id and r.actor_id=p_run.actor_id and r.task='document'
    and r.target->>'sectionId'=origin_target->>'sectionId' and r.status='succeeded') into parent_known;
  end if;
  source:=jsonb_build_object('sectionId',origin_target->>'sectionId','revision',origin_target->>'revision',
   'kind',case when origin_target ? 'selection' or origin_target->>'sectionId' like 'selection:%' then 'selection' else 'editor' end,
   'revisionSourceRunId',parent_id,
   'revisionSourceState',case when not (origin_target ? 'revisionSourceRunId') then 'none' when parent_known then 'observed' else 'unresolved' end,
   'complete',false);
 end if;
 insert into public.workspace_ai_document_origins(run_id,org_id,actor_id,source,observed_at_creation)
 values(p_run.id,p_run.org_id,p_run.actor_id,source,p_created) on conflict do nothing;
end $$;
revoke all on function public.capture_workspace_ai_document_origin(public.workspace_ai_runs,boolean) from public,anon,authenticated,service_role;

create function public.retain_workspace_ai_document_origin() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if tg_op='INSERT' then perform public.capture_workspace_ai_document_origin(new,true);
 else perform public.capture_workspace_ai_document_origin(old,false);end if;
 return null;
end $$;
revoke all on function public.retain_workspace_ai_document_origin() from public,anon,authenticated,service_role;
create trigger workspace_ai_document_origins after insert or update of target or delete on public.workspace_ai_runs
 for each row execute function public.retain_workspace_ai_document_origin();
-- Lock out concurrent retirement while observing existing targets. No content,
-- revision, application receipt or credit record is changed by the backfill.
lock table public.workspace_ai_runs in share row exclusive mode;
select public.capture_workspace_ai_document_origin(r,false) from public.workspace_ai_runs r where task='document';
comment on table public.workspace_ai_document_origins is 'Private immutable document source identities. Includes unresolved historical observations; never complete lineage or authorization. No content or client reader. Privacy activation and source retirement remain gated.';
commit;
