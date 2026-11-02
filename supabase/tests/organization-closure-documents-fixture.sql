\set ON_ERROR_STOP on
\ir organization-closure-calendar-fixture.sql
-- Replace only the sharing fixture's minimal file stub in this disposable DB.
-- Production tables, quota, policy tracking, room and version functions follow.
drop table public.organization_document_files;
create table public.platform_staff_members(user_id uuid primary key references public.profiles(id),access_level text);
create table public.subscriptions(user_id uuid,status text,metadata jsonb,stripe_subscription_id text,created_at timestamptz default now());
create function public.has_workspace_paid_features(p_org_id uuid) returns boolean
 language sql stable security definer set search_path='' as $$
 select coalesce((select status in ('active','trialing') and metadata->>'plan_tier'='organization'
 from public.subscriptions where user_id=p_org_id and stripe_subscription_id not ilike 'stub_%'
 order by created_at desc limit 1),false);
$$;
\ir ../migrations/20260904113000_add_organization_document_library.sql
\ir ../migrations/20260904183000_count_policy_document_storage.sql
\ir ../migrations/20261014213000_add_document_collaboration_rooms.sql
\ir ../migrations/20261014223000_version_uploaded_document_saves.sql
\ir ../migrations/20261014233000_publish_document_versions.sql
set check_function_bodies=on;
\ir ../migrations/20261102110000_organization_closure_uploaded_documents.sql
-- Omitted default Supabase privileges, only on this local fixture.
grant select on public.platform_staff_members to authenticated;
grant select on storage.objects to service_role;
create function public.fixture_closure_documents() returns void language plpgsql as $$
begin
 truncate public.document_file_versions,public.organization_document_files cascade;
 truncate public.subscriptions;
 perform public.fixture_closure_calendar();
 insert into public.subscriptions(user_id,status,metadata,stripe_subscription_id)
 select public.fixture_form_id(n),'active','{"plan_tier":"organization"}','sub_fixture_'||n from generate_series(1,2) n;
 insert into public.organization_document_files(id,org_id,storage_path,name,mime_type,size_bytes,created_by,updated_at)
 select public.fixture_form_id(1000+n),public.fixture_form_id(n),public.fixture_form_id(n)::text||'/library/source.md',
 'source.md','text/markdown',10,public.fixture_form_id(n),'2026-10-14T00:00:00Z' from generate_series(1,2) n;
 insert into public.document_collaboration_rooms(id,org_id,file_id,generation,base_revision,base_updated_at,checkpoint,created_by,last_sequence,recovery_bytes)
 select public.fixture_form_id(1010+n),public.fixture_form_id(n),public.fixture_form_id(1000+n),public.fixture_form_id(1020+n),
 'source-revision','2026-10-14T00:00:00Z',decode('AQ==','base64'),public.fixture_form_id(n),1,1 from generate_series(1,2) n;
 insert into public.document_collaboration_updates(room_id,sequence,batch_id,generation,actor_id,payload,payload_hash)
 select public.fixture_form_id(1010+n),1,public.fixture_form_id(1030+n),public.fixture_form_id(1020+n),public.fixture_form_id(n),
 decode('AQ==','base64'),sha256(decode('AQ==','base64')) from generate_series(1,2) n;
 -- Actual prior history on org1; org2 has no history so admitted cascades can be tested.
 insert into public.document_file_versions(id,file_id,org_id,actor_id,storage_path,name,mime_type,size_bytes,content_hash,revision,source_updated_at,generation,sequence)
 values(public.fixture_form_id(1041),public.fixture_form_id(1001),public.fixture_form_id(1),public.fixture_form_id(1),
 public.fixture_form_id(1)::text||'/library/history.md','source.md','text/markdown',3,repeat('c',64),'historic','2026-10-13T00:00:00Z',public.fixture_form_id(1021),0);
 perform public.fixture_document_reserve();
 insert into storage.objects(bucket_id,name,metadata)
 values('org-documents',public.fixture_form_id(1)::text||'/library/versions/'||public.fixture_form_id(1001)::text||'/'||public.fixture_form_id(1051)::text||'.md','{"size":3}'),
 ('org-documents',public.fixture_form_id(1)::text||'/library/versions/'||public.fixture_form_id(1001)::text||'/'||public.fixture_form_id(1051)::text||'-previous.md','{"size":10}');
end; $$;
create function public.fixture_document_reserve(request integer default 1051) returns boolean language sql as $$
 select public.reserve_uploaded_document_version(public.fixture_form_id(1001),public.fixture_form_id(1),public.fixture_form_id(request),public.fixture_form_id(1021),
 'source-revision','2026-10-14T00:00:00Z',1,repeat('a',64),repeat('b',64),3);
$$;
create function public.fixture_document_commit(request integer default 1051) returns jsonb language sql as $$
 select public.commit_uploaded_document_version(public.fixture_form_id(1001),public.fixture_form_id(1),public.fixture_form_id(request),public.fixture_form_id(1021),
 'source-revision','2026-10-14T00:00:00Z',1,repeat('a',64),repeat('b',64),3);
$$;
create function public.fixture_document_append() returns jsonb language sql as $$
 select public.append_document_room_update(public.fixture_form_id(1011),public.fixture_form_id(1021),public.fixture_form_id(1033),'Ag==');
$$;
create function public.fixture_document_compact() returns boolean language sql as $$
 select public.compact_document_room(public.fixture_form_id(1011),public.fixture_form_id(1021),1,'AQ==');
$$;
create function public.fixture_document_restore(action text) returns jsonb language plpgsql as $$
declare r public.document_collaboration_rooms%rowtype;
begin
 select * into r from public.document_collaboration_rooms where id=public.fixture_form_id(1011);
 if action='reserve' then
 return to_jsonb(public.reserve_uploaded_document_version(r.file_id,public.fixture_form_id(1),public.fixture_form_id(1053),r.generation,
 r.base_revision,r.base_updated_at,r.canonical_sequence,repeat('b',64),repeat('c',64),3,public.fixture_form_id(1041)));
 end if;
 return public.commit_uploaded_document_version(r.file_id,public.fixture_form_id(1),public.fixture_form_id(1053),r.generation,
 r.base_revision,r.base_updated_at,r.canonical_sequence,repeat('b',64),repeat('c',64),3,public.fixture_form_id(1041),'AQ==');
end; $$;
