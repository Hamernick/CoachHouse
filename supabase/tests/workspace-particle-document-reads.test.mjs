import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import net from 'node:net'
const root = mkdtempSync(join(tmpdir(), 'ch-board-document-reads-'))
const run = (cmd, args, input) => {
 const result = spawnSync(cmd, args, { input, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 })
 assert.equal(result.status, 0, result.stderr || result.stdout)
 return result.stdout.trim()
}
const port = await new Promise(resolve => { const server = net.createServer(); server.listen(0, '127.0.0.1', () => { const value = server.address().port; server.close(() => resolve(value)) }) })
const data = join(root, 'data')
let started = false
try {
 run('initdb', ['-D', data, '--auth=trust', '--no-locale', '-E', 'UTF8'])
 run('pg_ctl', ['-D', data, '-l', join(root, 'postgres.log'), '-o', `-h 127.0.0.1 -p ${port} -k ${root}`, '-w', 'start']); started = true
 const sql = query => run('psql', ['-XqAt', '-v', 'ON_ERROR_STOP=1', '-d', `postgresql://127.0.0.1:${port}/postgres?gssencmode=disable`], query)
 const org='10000000-0000-4000-8000-000000000001', member='10000000-0000-4000-8000-000000000002', outsider='10000000-0000-4000-8000-000000000003'
 sql(`create role anon;create role authenticated;create role service_role bypassrls;
 create schema auth;
 create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create function auth.role() returns text language sql as $$select nullif(current_setting('request.jwt.claim.role',true),'')$$;
 create function organization_activity_actor_id() returns uuid language sql as $$select (nullif(current_setting('request.headers',true),'')::jsonb->>'x-coach-house-actor-id')::uuid$$;
 create table memberships(org_id uuid,actor_id uuid);
 insert into memberships values('${org}','${member}');
 create function can_read_workspace_particle_origins(o uuid,a uuid) returns boolean language sql stable security definer set search_path='' as $$select o='${org}'::uuid and (a=o or exists(select 1 from public.memberships where org_id=o and actor_id=a))$$;
 create table organization_workspace_boards(org_id uuid primary key,state jsonb);
 create table organization_document_files(id uuid,org_id uuid);
 create function workspace_particle_board_files(uuid,jsonb) returns table(record_id text,file_id uuid) language sql stable as $$select 'file',id from public.organization_document_files$$;
 create function document_file_folder_actor_can(uuid,uuid,text) returns boolean language sql stable as $$select false$$;
 grant usage on schema auth to authenticated,service_role;
 grant select,update on organization_workspace_boards to authenticated,service_role;
 alter table organization_workspace_boards enable row level security;
 create policy board_read on organization_workspace_boards for select to authenticated using(can_read_workspace_particle_origins(org_id,auth.uid()));
 create policy board_update on organization_workspace_boards for update to authenticated using(can_read_workspace_particle_origins(org_id,auth.uid()));
 insert into organization_workspace_boards values('${org}','{}');`)
 const dependencies=readFileSync('supabase/migrations/20261106140000_workspace_particle_source_write_fence.sql','utf8')
 sql(dependencies.slice(dependencies.indexOf('create function public.workspace_particle_array'),dependencies.indexOf('-- Compare full records')))
 sql(readFileSync('supabase/migrations/20261106150000_workspace_particle_source_reads.sql','utf8'))
 const identity=(role,actor)=>`set request.jwt.claim.sub='${actor}';set request.jwt.claim.role='${role}';set request.headers='{"x-coach-house-actor-id":"${actor}"}';set role ${role};`
 const read=(actor=member,query='select state from organization_workspace_boards')=>sql(identity('authenticated',actor)+query)
 const write=state=>sql(`update organization_workspace_boards set state='${JSON.stringify(state).replaceAll("'","''")}'::jsonb;`)
 const doc=(kind='roadmap')=>({id:'doc',type:'activity',title:'Copied private title',data:{widget:{kind:'document',source:{kind,sectionId:'private-section'}}}})
 const graph=particles=>({particleGraph:{particles}})
 const plan=(field,kind,id)=>({id:'objective',type:'objective',data:{planning:{[field]:[{id:'plan',sources:[{kind,id}]}]}}})
 write(graph([doc()]))
 assert.match(read(),/Copied private title/,'Old raw reader leaks document-bearing board')
 sql(readFileSync('supabase/migrations/20261107100000_workspace_particle_document_reads.sql','utf8'))
 for(const state of [graph([doc()]),graph([plan('plans','workspace','document:private-section')]),graph([plan('proposals','workspace','roadmap:alias')]),{workspaceCatalog:{entries:[{id:'finance',state:graph([doc()])}]}},graph([{...doc(),data:{widget:{kind:'document',source:{kind:'roadmap'}}}}])]) {
  write(state)
  for(const actor of [member,org]) assert.throws(()=>read(actor),/Board source access required/,'Owner and member use projection, not absent-row fallback')
  assert.throws(()=>read(member,'select count(*) from organization_workspace_boards'),/Board source access required/)
  assert.throws(()=>read(member,'update organization_workspace_boards set state=state returning state'),/Board source access required/)
  const canonical=sql(identity('service_role',member)+`select read_workspace_particle_board_for_projection('${org}','${member}')->'state';`)
  assert.deepEqual(JSON.parse(canonical),state,'Verified server projection input stays canonical')
  assert.throws(()=>sql(identity('service_role',member)+`select read_workspace_particle_board_for_projection('${org}','${org}');`),/Board projection access required/)
 }
 for(const state of [{},graph([]),graph([doc('workspace_note')]),graph([plan('plans','web','document:external')]),graph([plan('plans','workspace','particle:note')])]) {write(state);assert.deepEqual(JSON.parse(read()),state)}
 // Retained documents must survive citation removal, chat/run edits and detached
 // intermediate records. Controlled origin rows stand in for immutable capture.
 sql('create table workspace_particle_ai_origins(org_id uuid,record_id text,dependencies jsonb);')
 const origin=(record,dependencies,organization=org)=>sql(`insert into workspace_particle_ai_origins values('${organization}','${record}','${JSON.stringify(dependencies).replaceAll("'","''")}');`)
 origin('particle:copy',{records:[{id:'particle:detached'}]})
 origin('particle:detached',{records:[{id:'document:private-section'},{id:'particle:copy'}]})
 origin('particle:copy',{contextParticleIds:['particle:implicit']})
 origin('particle:implicit',{records:[{id:'roadmap:alias'},{id:'document:private-section'}]})
 origin('particle:copy',{records:[{id:'document:foreign-secret'}]},outsider)
 origin('particle:objective:plan:retained',{records:[{id:'document:plan-source'}]})
 origin('particle:malformed',{records:[{id:'document:'}]})
 write(graph([{id:'copy',type:'activity',title:'Detached copied secret'}]))
 assert.match(read(),/Detached copied secret/,'Current-reference gate misses detached origin')
 sql(readFileSync('supabase/migrations/20261107110000_workspace_particle_document_origins.sql','utf8'))
 const sources=(actor=member,records=['particle:copy'])=>JSON.parse(sql(identity('service_role',actor)+`select read_workspace_particle_ai_documents('${org}','${actor}','${JSON.stringify(records).replaceAll('[','{').replaceAll(']','}')}');`))
 assert.deepEqual(sources(),[{id:'particle:copy',documentIds:['alias','private-section'],complete:false}])
 assert.deepEqual(sources(org),sources(),'Owner retains source resolution')
 assert.deepEqual(sources(member,['particle:unknown']),[],'Unknown origin is not reconstructed')
 assert.deepEqual(sources(member,['particle:malformed']),[{id:'particle:malformed',documentIds:[''],complete:false}])
 for(const state of [graph([{id:'copy'}]),{workspaceCatalog:{entries:[{id:'finance',state:graph([{id:'copy'}])}]}},graph([{id:'objective',type:'objective',data:{planning:{plans:[{id:'retained'}]}}}])]) {
  write(state)
  for(const actor of [org,member]) assert.throws(()=>read(actor),/Board source access required/)
  const canonical=sql(identity('service_role',member)+`select read_workspace_particle_board_for_projection('${org}','${member}')->'state';`)
  assert.deepEqual(JSON.parse(canonical),state)
 }
 write(graph([{id:'ordinary'}]));assert.match(read(),/ordinary/)
 assert.throws(()=>sources(outsider),/Particle source access denied/)
 assert.throws(()=>sql(identity('service_role',member)+`select read_workspace_particle_ai_documents('${org}','${org}',array['particle:copy']);`),/Particle source access denied/)
 assert.throws(()=>sql(identity('service_role',member)+`select read_workspace_particle_ai_documents('${org}','${member}',array_fill('particle:copy'::text,array[501]));`),/Invalid particle source request/)
 for(const role of ['anon','authenticated','service_role']) assert.equal(sql(`select has_function_privilege('${role}','public.workspace_particle_document_origins(uuid,text[])','execute');`),'f')
 assert.equal(sql(`select has_function_privilege('authenticated','public.read_workspace_particle_ai_documents(uuid,uuid,text[])','execute');`),'f')
 for(let i=0;i<65;i++) origin(`particle:chain-${i}`,{contextParticleIds:[`particle:chain-${i+1}`]})
 origin('particle:chain-65',{records:[{id:'document:deep-source'}]})
 assert.deepEqual(sources(member,['particle:chain-0']),[{id:'particle:chain-0',documentIds:['deep-source'],complete:false}])
 sql(`insert into organization_document_files values('${outsider}','${org}');`)
 assert.throws(()=>read(),/Board source access required/,'Native-source check remains enforced')
 sql('delete from organization_document_files;delete from memberships;')
 assert.equal(read(),'','Revoked actor has no parent authority')
 assert.throws(()=>sources(),/Particle source access denied/)
 assert.throws(()=>sql(identity('service_role',member)+`select read_workspace_particle_board_for_projection('${org}','${member}');`),/Board projection access required/)
 assert.equal(sql(`select has_function_privilege('authenticated','public.read_workspace_particle_board_for_projection(uuid,uuid)','execute');`),'f')
 assert.equal(sql(`select has_function_privilege('authenticated','public.can_read_workspace_particle_board(uuid,jsonb)','execute');`),'t')
 console.log('Passed: raw document leak reproduced; root/named boards, plan/proposal citations, malformed roadmap reference, owner/member projection, count/RETURNING denial, canonical service input, actor mismatch/revocation, ordinary boards, native fence, retained detached/transitive/cyclic/implicit document origins, cross-org isolation, 65-hop lineage, plan roots, service-only readers and revocation. Controlled prerequisites, not full-schema qualification.')
} finally {
 if (started) run('pg_ctl', ['-D', data, '-m', 'fast', '-w', 'stop'])
 rmSync(root, { recursive: true, force: true })
}
