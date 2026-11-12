-- Keyword indexing/search must not require paid embeddings. Existing vectors
-- remain reusable; admitted hybrid search fills missing vectors under revision CAS.
-- Rollback: disable retrieval; do not restore the prior reader over null vectors.
begin;
alter table public.workspace_document_chunks alter column embedding drop not null;
create or replace function public.workspace_document_retrieval(p_org_id uuid,p_actor_id uuid,p_canvas_id uuid,p_operation text,p_payload jsonb)
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
    and current_row.dimensions=(p_payload->>'dimensions')::integer and embedding is not null;
  return jsonb_build_object('revision',coalesce(current_row.revision,0),'signature',coalesce(current_row.signature,''),'keys',result);
 end if;
 if p_operation='replace' then
  perform public.guard_organization_closure(p_org_id);
  dims:=(p_payload->>'dimensions')::integer;
  search_mode:=coalesce(p_payload->>'mode','hybrid');
  if search_mode not in ('keyword','semantic','hybrid') then raise exception 'Invalid index mode.' using errcode='22023';end if;
  if dims is null or dims not between 1 and 2000 or length(p_payload->>'model') not between 1 and 120
   or (p_payload->>'signature') is null or (p_payload->>'signature') !~ '^[a-f0-9]{64}$'
   or jsonb_typeof(p_payload->'chunks') is distinct from 'array' or jsonb_array_length(p_payload->'chunks')>512
   or octet_length(p_payload::text)>12000000 then raise exception 'Invalid index.' using errcode='22023';end if;
  if (select count(*)<>count(distinct c->>'key') from jsonb_array_elements(p_payload->'chunks') c) then raise exception 'Duplicate chunk.' using errcode='22023';end if;
  if current_row.signature=p_payload->>'signature' and (search_mode='keyword' or not exists(select 1 from public.workspace_document_chunks
    where org_id=p_org_id and actor_id=actor and canvas_key=scope_id and embedding is null)) then return jsonb_build_object('revision',current_row.revision,'signature',current_row.signature);end if;
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
   if (vector_value is null and search_mode<>'keyword') or (vector_value is not null and
     (extensions.vector_dims(vector_value) is distinct from dims or extensions.vector_norm(vector_value)<=0))
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
 if search_mode<>'keyword' and exists(select 1 from public.workspace_document_chunks c
  where c.org_id=p_org_id and c.actor_id=actor and c.canvas_key=scope_id and c.embedding is null
   and exists(select 1 from jsonb_array_elements(p_payload->'allowed') a where a->>'id'=c.source_id and a->>'fingerprint'=c.fingerprint)) then
  raise exception 'Semantic index incomplete.' using errcode='22023';end if;
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

commit;
