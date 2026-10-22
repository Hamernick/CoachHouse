-- The existing roadmap action remains the document writer. This transaction
-- adds a durable AI application receipt to its existing organization CAS.
create table public.workspace_ai_document_applications (
  run_id uuid primary key references public.workspace_ai_runs(id) on delete restrict,
  section_id text not null,
  saved_revision text not null,
  content_hash text not null check (length(content_hash)=64),
  saved_at timestamptz not null default clock_timestamp()
);
alter table public.workspace_ai_document_applications enable row level security;
revoke all on public.workspace_ai_document_applications from public,anon,authenticated;
grant select,insert on public.workspace_ai_document_applications to service_role;
create trigger workspace_ai_applications_immutable before update or delete on public.workspace_ai_document_applications
  for each row execute function public.ai_credit_immutable();

create function public.commit_workspace_ai_document(p_id uuid,p_org_id uuid,p_actor_id uuid,
  p_expected_updated_at timestamptz,p_expected_section_revision text,p_profile jsonb,p_section jsonb,p_content_hash text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare run public.workspace_ai_runs; application public.workspace_ai_document_applications;
begin
  if not public.can_use_workspace_ai(p_org_id,p_actor_id) then raise exception 'AI access denied' using errcode='42501'; end if;
  select * into run from public.workspace_ai_runs where id=p_id and org_id=p_org_id and actor_id=p_actor_id for update;
  if not found or run.status<>'succeeded' or run.settled_at is null
    or run.target->>'sectionId' is distinct from p_section->>'id' then raise exception 'AI application target unavailable'; end if;
  select * into application from public.workspace_ai_document_applications where run_id=p_id;
  if found then return jsonb_build_object('replayed',true,'application',to_jsonb(application)); end if;
  if run.target->>'revision' is distinct from p_expected_section_revision
    or p_section->>'isPublic' is distinct from 'false' or p_section->>'status' is distinct from 'in_progress'
    or nullif(p_section->>'lastUpdated','') is null or jsonb_typeof(p_profile) is distinct from 'object'
    or p_content_hash is null or length(p_content_hash)<>64 then raise exception 'Invalid AI document application'; end if;
  update public.organizations set profile=p_profile where user_id=p_org_id and updated_at=p_expected_updated_at;
  if not found then raise exception 'AI document changed before saving' using errcode='40001'; end if;
  insert into public.workspace_ai_document_applications(run_id,section_id,saved_revision,content_hash)
    values(p_id,p_section->>'id',p_section->>'lastUpdated',p_content_hash) returning * into application;
  return jsonb_build_object('replayed',false,'application',to_jsonb(application));
end $$;

create or replace function public.read_workspace_ai_run(p_id uuid,p_org_id uuid,p_actor_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
  if not public.can_use_workspace_ai(p_org_id,p_actor_id) then return null; end if;
  perform public.recover_workspace_ai_runs(p_org_id);
  return (select to_jsonb(r)||jsonb_build_object('application',
    (select to_jsonb(a) from public.workspace_ai_document_applications a where a.run_id=r.id))
    from public.workspace_ai_runs r where id=p_id and org_id=p_org_id and actor_id=p_actor_id);
end $$;
revoke all on function public.commit_workspace_ai_document(uuid,uuid,uuid,timestamptz,text,jsonb,jsonb,text) from public,anon,authenticated;
grant execute on function public.commit_workspace_ai_document(uuid,uuid,uuid,timestamptz,text,jsonb,jsonb,text) to service_role;
