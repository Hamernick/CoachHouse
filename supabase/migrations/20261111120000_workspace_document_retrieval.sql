-- Derived, actor-scoped retrieval only. No canonical source or grant changes.
-- Activation requires a qualified embedding/accounting adapter; keep unconfigured.
-- Rollback: disable the adapter first; these two derived tables may then be dropped.
begin;
create schema if not exists extensions;
create extension if not exists vector with schema extensions;
create table public.workspace_document_indexes (
 org_id uuid not null references public.organizations(user_id) on delete cascade,
 actor_id uuid not null references auth.users(id) on delete cascade,
 canvas_key uuid not null,
 revision integer not null default 0 check(revision>=0),
 signature text not null default '', model text not null default '', dimensions integer not null default 0,
 updated_at timestamptz not null default now(),
 primary key(org_id,actor_id,canvas_key)
);
create table public.workspace_document_chunks (
 org_id uuid not null, actor_id uuid not null, canvas_key uuid not null,
 chunk_key text not null check(length(chunk_key)=64), source_id text not null check(source_id ~ '^(document|file):[^:]+$'),
 fingerprint text not null check(fingerprint ~ '^[a-f0-9]{64}$'), source_revision text not null,
 start_offset integer not null check(start_offset>=0), end_offset integer not null check(end_offset>start_offset and end_offset-start_offset<=480),
 fts tsvector not null, embedding extensions.vector not null,
 primary key(org_id,actor_id,canvas_key,chunk_key),
 foreign key(org_id,actor_id,canvas_key) references public.workspace_document_indexes on delete cascade
);
alter table public.workspace_document_indexes enable row level security;
alter table public.workspace_document_indexes force row level security;
alter table public.workspace_document_chunks enable row level security;
alter table public.workspace_document_chunks force row level security;
revoke all on public.workspace_document_indexes,public.workspace_document_chunks from public,anon,authenticated,service_role;
-- No direct grants/policies: only the server-bound RPC can reach derived data.
create index workspace_document_chunks_fts on public.workspace_document_chunks using gin(fts);

create function public.workspace_document_retrieval(p_org_id uuid,p_actor_id uuid,p_canvas_id uuid,p_operation text,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path='' set statement_timeout='10s' as $$
declare
 scope_id uuid:=coalesce(p_canvas_id,'00000000-0000-0000-0000-000000000000'::uuid);
 actor uuid; current_row public.workspace_document_indexes; chunk jsonb; vector_value extensions.vector; result jsonb;
 query_vector extensions.vector; query_terms tsquery; search_mode text; dims integer;
begin
 actor:=(nullif(current_setting('request.headers',true),'')::jsonb->>'x-coach-house-actor-id')::uuid;
 if auth.role() is distinct from 'service_role' or actor is null or actor is distinct from p_actor_id
  or not public.can_read_workspace_ai(p_org_id,actor) then raise exception 'Retrieval unavailable.' using errcode='42501';end if;
 if p_operation is null or p_operation not in ('state','replace','search') or jsonb_typeof(p_payload) is distinct from 'object' then
  raise exception 'Invalid retrieval operation.' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended('document-retrieval:'||p_org_id::text||actor::text||scope_id::text,0));
 if not public.can_read_workspace_ai(p_org_id,actor) then raise exception 'Retrieval unavailable.' using errcode='42501';end if;
 select * into current_row from public.workspace_document_indexes where org_id=p_org_id and actor_id=actor and canvas_key=scope_id;
 if p_operation='state' then
  select coalesce(jsonb_agg(chunk_key order by chunk_key),'[]') into result from public.workspace_document_chunks
   where org_id=p_org_id and actor_id=actor and canvas_key=scope_id and current_row.model=p_payload->>'model'
    and current_row.dimensions=(p_payload->>'dimensions')::integer;
  return jsonb_build_object('revision',coalesce(current_row.revision,0),'signature',coalesce(current_row.signature,''),'keys',result);
 end if;
 if p_operation='replace' then
  perform public.guard_organization_closure(p_org_id);
  dims:=(p_payload->>'dimensions')::integer;
  if dims is null or dims not between 1 and 2000 or length(p_payload->>'model') not between 1 and 120
   or (p_payload->>'signature') is null or (p_payload->>'signature') !~ '^[a-f0-9]{64}$'
   or jsonb_typeof(p_payload->'chunks') is distinct from 'array' or jsonb_array_length(p_payload->'chunks')>512
   or octet_length(p_payload::text)>12000000 then raise exception 'Invalid index.' using errcode='22023';end if;
  if (select count(*)<>count(distinct c->>'key') from jsonb_array_elements(p_payload->'chunks') c) then raise exception 'Duplicate chunk.' using errcode='22023';end if;
  if current_row.signature=p_payload->>'signature' then return jsonb_build_object('revision',current_row.revision,'signature',current_row.signature);end if;
  if (p_payload->>'expectedRevision')::integer is distinct from coalesce(current_row.revision,0) then raise exception 'Index changed.' using errcode='40001';end if;
  -- Reuse unchanged chunk vectors only within the same embedding version/dimension.
  if current_row.model is distinct from p_payload->>'model' or current_row.dimensions is distinct from dims then
   delete from public.workspace_document_chunks where org_id=p_org_id and actor_id=actor and canvas_key=scope_id;
  end if;
  insert into public.workspace_document_indexes(org_id,actor_id,canvas_key,revision,signature,model,dimensions)
   values(p_org_id,actor,scope_id,coalesce(current_row.revision,0)+1,p_payload->>'signature',p_payload->>'model',dims)
   on conflict(org_id,actor_id,canvas_key) do update set revision=excluded.revision,signature=excluded.signature,model=excluded.model,dimensions=excluded.dimensions,updated_at=now()
   returning * into current_row;
  for chunk in select value from jsonb_array_elements(p_payload->'chunks') loop
   vector_value:=(chunk->>'embedding')::extensions.vector;
   if vector_value is null then select embedding into vector_value from public.workspace_document_chunks
    where org_id=p_org_id and actor_id=actor and canvas_key=scope_id and chunk_key=chunk->>'key'
     and source_id=chunk->>'id' and fingerprint=chunk->>'fingerprint' and source_revision=chunk->>'revision'
     and start_offset=(chunk->>'start')::integer and end_offset=(chunk->>'end')::integer
     and fts=to_tsvector('pg_catalog.english',chunk->>'text');end if;
   if extensions.vector_dims(vector_value) is distinct from dims or extensions.vector_norm(vector_value)<=0
    or length(chunk->>'text') not between 1 and 480 or chunk->>'text' is null then raise exception 'Invalid chunk.' using errcode='22023';end if;
   insert into public.workspace_document_chunks values(p_org_id,actor,scope_id,chunk->>'key',chunk->>'id',chunk->>'fingerprint',chunk->>'revision',
    (chunk->>'start')::integer,(chunk->>'end')::integer,to_tsvector('pg_catalog.english',chunk->>'text'),vector_value)
    on conflict(org_id,actor_id,canvas_key,chunk_key) do update set source_id=excluded.source_id,fingerprint=excluded.fingerprint,source_revision=excluded.source_revision,
     start_offset=excluded.start_offset,end_offset=excluded.end_offset,fts=excluded.fts,embedding=excluded.embedding;
  end loop;
  delete from public.workspace_document_chunks c where org_id=p_org_id and actor_id=actor and canvas_key=scope_id
   and not exists(select 1 from jsonb_array_elements(p_payload->'chunks') n where n->>'key'=c.chunk_key);
  return jsonb_build_object('revision',current_row.revision,'signature',current_row.signature);
 end if;
 search_mode:=p_payload->>'mode';
 if search_mode is null or search_mode not in ('keyword','semantic','hybrid') or length(p_payload->>'query') not between 1 and 160
  or p_payload->>'query' is null or jsonb_typeof(p_payload->'allowed') is distinct from 'array' or jsonb_array_length(p_payload->'allowed')>20 then
  raise exception 'Invalid query.' using errcode='22023';end if;
 if current_row.revision is null or current_row.revision is distinct from (p_payload->>'revision')::integer
  or current_row.model is distinct from p_payload->>'model' or current_row.dimensions is distinct from (p_payload->>'dimensions')::integer then
  raise exception 'Index changed.' using errcode='40001';end if;
 query_terms:=websearch_to_tsquery('pg_catalog.english',p_payload->>'query');
 if search_mode<>'keyword' then
  query_vector:=(p_payload->>'embedding')::extensions.vector;
  if query_vector is null or extensions.vector_dims(query_vector)<>current_row.dimensions or extensions.vector_norm(query_vector)<=0 then
   raise exception 'Invalid query vector.' using errcode='22023';end if;
 end if;
 with permitted as materialized (
  select c.* from public.workspace_document_chunks c where c.org_id=p_org_id and c.actor_id=actor and c.canvas_key=scope_id
   and exists(select 1 from jsonb_array_elements(p_payload->'allowed') a where a->>'id'=c.source_id and a->>'fingerprint'=c.fingerprint)
 ), lexical as (
  select chunk_key,row_number() over(order by ts_rank_cd(fts,query_terms) desc,chunk_key) r from permitted
   where search_mode<>'semantic' and fts@@query_terms
 ), semantic as (
  select chunk_key,row_number() over(order by embedding operator(extensions.<=>) query_vector,chunk_key) r from permitted
   where search_mode<>'keyword' and (embedding operator(extensions.<=>) query_vector)<0.8
 ), ranked as (
  select c.*,coalesce(1.0/(60+l.r),0)+coalesce(1.0/(60+s.r),0) score from permitted c
   left join lexical l using(chunk_key) left join semantic s using(chunk_key) where l.r is not null or s.r is not null
 ), distinct_sources as (
  select *,row_number() over(partition by source_id order by score desc,chunk_key) source_rank from ranked
 ), limited as (select * from distinct_sources where source_rank=1 order by score desc,source_id limit 8)
 select coalesce(jsonb_agg(jsonb_build_object('key',chunk_key,'id',source_id,'fingerprint',fingerprint,'revision',source_revision,
  'start',start_offset,'end',end_offset) order by score desc,source_id),'[]') into result from limited;
 -- Return locations/identity only. The application must reread current sources;
 -- indexed tokens and vectors never authorize disclosure or supply answer text.
 return result;
end $$;
revoke all on function public.workspace_document_retrieval(uuid,uuid,uuid,text,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.workspace_document_retrieval(uuid,uuid,uuid,text,jsonb) to service_role;
comment on table public.workspace_document_chunks is 'Bounded derived retrieval, private per actor/org/canvas. Stores tokens and vectors, not source text. No chat or Memory ingestion. Exact source fingerprints and current readers are required before disclosure. Replaced on next qualified search; no autonomous indexing or paid jobs.';
commit;
