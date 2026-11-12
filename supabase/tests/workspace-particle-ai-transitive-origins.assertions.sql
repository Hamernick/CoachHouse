-- Only this disposable fixture's superuser seeds retained metadata. Production
-- callers have no table writes; receipt capture is covered by the preceding suite.
do $$
declare
 org uuid := 'e972bc07-fbf5-4fc8-a416-7f00910a71e2';
 actor uuid := '90b6c688-889c-467f-9edd-166f28bf0819';
 run uuid := '76000000-0000-4000-8000-000000000001';
 a text := 'particle:76000000-0000-4000-8000-000000000010';
 b text := 'particle:76000000-0000-4000-8000-000000000011';
 c text := 'particle:76000000-0000-4000-8000-000000000012';
 d text := 'particle:76000000-0000-4000-8000-000000000013';
 missing text := 'particle:76000000-0000-4000-8000-000000000014';
 f text := '76000000-0000-4000-8000-000000000020';
 g text := '76000000-0000-4000-8000-000000000021';
 foreign_file text := '76000000-0000-4000-8000-000000000022';
 answer jsonb;
begin
 if current_database() not like 'ch_particle_origins_%' then raise exception 'Owned provenance fixture required';end if;
 perform set_config('request.jwt.claim.role','service_role',false);
 perform set_config('request.headers',jsonb_build_object('x-coach-house-actor-id',org)::text,false);
 -- A -> B/C -> D -> A forms a diamond and cycle; the direct source exists
 -- only on D. A missing edge must not become an empty-complete assertion.
 insert into public.workspace_particle_ai_origins(org_id,record_id,run_id,dependencies) values
 (org,a,run,jsonb_build_object('records',jsonb_build_array(jsonb_build_object('id',b),jsonb_build_object('id',c),jsonb_build_object('id',missing)))),
 (org,b,run,jsonb_build_object('contextParticleIds',jsonb_build_array(d,missing))),
 (org,c,run,jsonb_build_object('records',jsonb_build_array(jsonb_build_object('id',d)))),
 (org,d,run,jsonb_build_object('records',jsonb_build_array(jsonb_build_object('id',a),jsonb_build_object('id','file:'||f)))),
 (org,d,'76000000-0000-4000-8000-000000000002',jsonb_build_object('nativeFileIds',jsonb_build_array(g,f))),
 (actor,missing,run,jsonb_build_object('nativeFileIds',jsonb_build_array(foreign_file)));
 answer:=public.read_workspace_particle_ai_files(org,org,array[a]);
 if jsonb_array_length(answer)<>1 or answer->0->>'id'<>a or answer->0->'fileIds'<>jsonb_build_array(f,g)
  or answer->0->>'complete'<>'false' then raise exception 'Cycle/diamond union or organization isolation failed: %',answer;end if;
 -- Multiple requested roots return only those roots, with their own closure.
 answer:=public.read_workspace_particle_ai_files(org,org,array[a,b,a,missing]);
 if jsonb_array_length(answer)<>2 or exists(select 1 from jsonb_array_elements(answer) row where row->'fileIds'<>jsonb_build_array(f,g))
 then raise exception 'Multi-root deduplication failed: %',answer;end if;
 -- A retained unresolved snapshot stays unresolved, even when another tenant
 -- has a matching identity with known sources. Malformed legacy arrays are safe.
 insert into public.workspace_particle_ai_origins(org_id,record_id,run_id,dependencies) values
 (org,missing,run,null),
 (org,missing,'76000000-0000-4000-8000-000000000002','{"records":"bad","contextParticleIds":{},"nativeFileIds":{}}');
 answer:=public.read_workspace_particle_ai_files(org,org,array[missing]);
 if answer->0->'fileIds'<>'[]'::jsonb or answer->0->>'complete'<>'false'
 then raise exception 'Unknown sources fabricated: %',answer;end if;
 -- A long recorded chain must not silently truncate at a shallow depth limit.
 for i in 1..64 loop
  insert into public.workspace_particle_ai_origins(org_id,record_id,run_id,dependencies)
  values(org,'particle:'||lpad(i::text,8,'0')||'-0000-4000-8000-000000000030',run,
   case when i=64 then jsonb_build_object('nativeFileIds',jsonb_build_array(f))
   else jsonb_build_object('contextParticleIds',jsonb_build_array('particle:'||lpad((i+1)::text,8,'0')||'-0000-4000-8000-000000000030')) end);
 end loop;
 answer:=public.read_workspace_particle_ai_files(org,org,array['particle:00000001-0000-4000-8000-000000000030']);
 if answer->0->'fileIds'<>jsonb_build_array(f) then raise exception 'Recorded chain truncated: %',answer;end if;
 raise notice 'Transitive origins: explicit/implicit cycle, diamond, multi-run union, multiple roots, foreign tenant, unresolved snapshot, malformed arrays and 64-hop chain passed.';
end $$;
