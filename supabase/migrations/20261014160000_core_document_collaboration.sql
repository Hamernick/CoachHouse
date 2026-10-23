-- Private durable core-document recovery and collaborative editing state.
-- All access goes through server-authenticated document authorization.
create table public.organization_core_document_versions (
 id uuid primary key default gen_random_uuid(),
 org_id uuid not null references public.organizations(user_id) on delete cascade,
 section_id text not null check (length(section_id) between 1 and 160),
 content jsonb not null,
 actor_id uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default clock_timestamp()
);
create index core_document_versions_lookup on public.organization_core_document_versions(org_id, section_id, created_at desc, id);
alter table public.organization_core_document_versions enable row level security;
revoke all on public.organization_core_document_versions from public, anon, authenticated;
grant select, insert, delete on public.organization_core_document_versions to service_role;

-- Normalize both current arrays and legacy keyed sections before taking snapshots.
create function public.core_document_history_entries(profile jsonb)
returns table(document_key text, document_value jsonb)
language sql immutable set search_path = '' as $$
 select 'roadmap:' || (item->>'id'), item - 'lastUpdated'
 from (
  select value as item from jsonb_array_elements(case when jsonb_typeof(profile#>'{roadmap,sections}')='array'
   then profile#>'{roadmap,sections}' else '[]'::jsonb end)
  union all
  select value || jsonb_build_object('id',key) from jsonb_each(case when jsonb_typeof(profile#>'{roadmap,sections}')='object'
   then profile#>'{roadmap,sections}' else '{}'::jsonb end) where jsonb_typeof(value)='object'
 ) entries
 where length(item->>'id') between 1 and 160 and item->>'id' not in ('program','people','board_calendar','next_actions');
$$;
revoke all on function public.core_document_history_entries(jsonb) from public,anon,authenticated;

create function public.capture_core_document_versions() returns trigger
language plpgsql security definer set search_path = '' as $$
declare change record;
begin
 for change in
  select coalesce(b.document_key,a.document_key) as key, b.document_value as previous, a.document_value as current
  from public.core_document_history_entries(coalesce(old.profile,'{}'::jsonb)) b
  full join public.core_document_history_entries(coalesce(new.profile,'{}'::jsonb)) a using(document_key)
  where coalesce(b.document_key,a.document_key) like 'roadmap:%'
    and b.document_value is distinct from a.document_value
 loop
  -- Preserve the pre-upgrade original before its first edit, including deletion.
  if change.previous is not null and not exists (
   select 1 from public.organization_core_document_versions where org_id=new.user_id and section_id=substring(change.key from 9)
  ) then
   insert into public.organization_core_document_versions(org_id,section_id,content,actor_id)
   values(new.user_id,substring(change.key from 9),change.previous,null);
  end if;
  insert into public.organization_core_document_versions(org_id,section_id,content,actor_id)
  values(new.user_id,substring(change.key from 9),coalesce(change.current,'null'::jsonb),public.organization_activity_actor_id());
  -- Latest100 meaningful versions plus the latest daily checkpoint for30days.
  delete from public.organization_core_document_versions v
  where v.org_id=new.user_id and v.section_id=substring(change.key from 9)
   and v.id not in (
    select id from public.organization_core_document_versions where org_id=new.user_id and section_id=substring(change.key from 9)
    order by created_at desc,id desc limit 100
   ) and v.id not in (
    select distinct on ((created_at at time zone 'UTC')::date) id
    from public.organization_core_document_versions where org_id=new.user_id and section_id=substring(change.key from 9)
     and created_at > now()-interval '30 days'
    order by (created_at at time zone 'UTC')::date, created_at desc,id desc
   );
 end loop;
 return new;
end $$;
revoke all on function public.capture_core_document_versions() from public,anon,authenticated;
create trigger core_document_versions after update of profile on public.organizations
 for each row execute function public.capture_core_document_versions();

create table public.organization_core_document_sessions (
 org_id uuid not null references public.organizations(user_id) on delete cascade,
 section_id text not null,
 generation uuid not null,
 version integer not null default 0 check(version>=0),
 document jsonb not null,
 steps jsonb not null default '[]',
 section_revision text,
 section_content text not null,
 primary key(org_id,section_id)
);
alter table public.organization_core_document_sessions enable row level security;
revoke all on public.organization_core_document_sessions from public,anon,authenticated;
grant select,insert,update,delete on public.organization_core_document_sessions to service_role;

create table public.organization_core_document_presence (
 org_id uuid not null references public.organizations(user_id) on delete cascade,
 section_id text not null,
 session_id text not null,
 actor_id uuid not null references auth.users(id) on delete cascade,
 display_name text not null,
 role text not null,
 mode text not null default 'viewing' check(mode in ('viewing','editing')),
 selection jsonb,
 seen_at timestamptz not null default now(),
 primary key(org_id,section_id,session_id)
);
create index core_document_presence_expiry on public.organization_core_document_presence(seen_at);
alter table public.organization_core_document_presence enable row level security;
revoke all on public.organization_core_document_presence from public,anon,authenticated;
grant select,insert,update,delete on public.organization_core_document_presence to service_role;

-- Lock order is always organization then session. Compare both revisions and commit
-- projection + collaborative state together. Caller authenticates/authorizes first.
create function public.commit_core_document_session(
 p_org uuid,p_section text,p_expected_updated_at timestamptz,
 p_expected_generation uuid,p_expected_version integer,
 p_state jsonb,p_profile jsonb default null
) returns boolean language plpgsql security definer set search_path = '' as $$
declare org public.organizations; current_session public.organization_core_document_sessions;
begin
 select * into org from public.organizations where user_id=p_org for update;
 if not found or org.updated_at is distinct from p_expected_updated_at then return false; end if;
 select * into current_session from public.organization_core_document_sessions where org_id=p_org and section_id=p_section for update;
 if found then
  if current_session.generation is distinct from p_expected_generation or current_session.version is distinct from p_expected_version then return false; end if;
 elsif p_expected_generation is not null then return false;
 end if;
 if p_profile is not null then
  update public.organizations set profile=p_profile where user_id=p_org;
 end if;
 insert into public.organization_core_document_sessions(org_id,section_id,generation,version,document,steps,section_revision,section_content)
 values(p_org,p_section,(p_state->>'generation')::uuid,(p_state->>'version')::integer,p_state->'document',p_state->'steps',p_state->>'section_revision',p_state->>'section_content')
 on conflict(org_id,section_id) do update set generation=excluded.generation,version=excluded.version,document=excluded.document,steps=excluded.steps,section_revision=excluded.section_revision,section_content=excluded.section_content;
 return true;
end $$;
revoke all on function public.commit_core_document_session(uuid,text,timestamptz,uuid,integer,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.commit_core_document_session(uuid,text,timestamptz,uuid,integer,jsonb,jsonb) to service_role;
