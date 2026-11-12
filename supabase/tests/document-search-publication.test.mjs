import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import net from 'node:net'
const root = mkdtempSync(join(tmpdir(), 'ch-search-publication-'))
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
 sql(`create role anon; create role authenticated; create role service_role;
 create schema auth;
 create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create function public.is_admin() returns boolean language sql as $$select false$$;
 create table public.organizations(user_id uuid primary key,is_public boolean,is_public_roadmap boolean,closed boolean default false,profile jsonb);
 create function public.guard_organization_closure(id uuid) returns void language plpgsql as $$begin if exists(select 1 from public.organizations where user_id=id and closed) then raise insufficient_privilege; end if; end$$;`)
 const closure = readFileSync('supabase/migrations/20261102233000_organization_closure_public_profile_reads.sql','utf8')
 sql(closure.slice(closure.indexOf('create function public.filter_public_organization_ids'),closure.indexOf('create function public.organization_closure_read_window')))
 const index = readFileSync('supabase/migrations/20260801191000_update_search_index_canonical_mission.sql','utf8')
 sql(index.slice(0,index.indexOf('create or replace view search_index')))
 sql(`insert into organizations(user_id,is_public,is_public_roadmap,profile) values
 ('10000000-0000-4000-8000-000000000001',false,false,'{}'),
 ('10000000-0000-4000-8000-000000000002',true,true,'{"mission":"hiddenneedle","roadmap":{"sections":[{"id":"mission_vision_values","content":"hiddenneedle","publicProfileStatusControlled":true,"status":"in_progress"}]}}');
 -- PostgreSQL14 disposable fixture: clients have no view grants. Staging separately checks retained security_invoker.
 create view public.search_index as
 select 'public-org:'||o.user_id id,'Community'::text label,null::text subtitle,'/community'::text href,'Community'::text group_name,'public'::text scope,o.user_id,true is_public,true is_published,to_tsvector('english',public.organization_narrative_plain_text(o.profile,'mission_vision_values','mission')) tsv from organizations o where o.is_public
 union all select 'roadmap:'||user_id,'Secret title',null,'/roadmap','Roadmap','owner',user_id,false,true,to_tsvector('english','hiddenneedle') from organizations
 union all select 'org:'||user_id,'Secret match',null,'/workspace','My organization','owner',user_id,false,true,to_tsvector('english','hiddenneedle') from organizations
 union all select 'doc:'||user_id,'Secret file',null,'/documents','Documents','owner',user_id,false,true,to_tsvector('english','hiddenneedle') from organizations
 union all select 'program:'||user_id,'Program',null,'/program','Programs','owner',user_id,false,true,to_tsvector('english','programneedle') from organizations
 union all select 'class:private','Private academy',null,'/class','Classes','academy',null::uuid,false,false,to_tsvector('english','academyneedle');
 revoke all on public.search_index from public,anon,authenticated;`)
 sql(readFileSync('supabase/migrations/20261107050000_document_search_publication.sql','utf8'))
 // Reproduce retained explicit anon grants. PG14 lacks the view option; staging
 // verifies that option independently. Exercise the actual ACL statements here.
 sql('grant execute on function public.search_global(text,uuid,boolean,integer) to anon;')
 const guards = readFileSync('supabase/migrations/20261107060000_document_search_access_guards.sql','utf8')
 sql(guards.replace('alter view public.search_index set (security_invoker = true);',''))
 assert.equal(sql("select has_function_privilege('anon','public.search_global(text,uuid,boolean,integer)','execute');"), 'f')
 const actor = '10000000-0000-4000-8000-000000000001'
 const search = (term, identity=actor, admin=false) => sql(`set request.jwt.claim.sub='${identity}'; set role authenticated; select count(*) from public.search_global('${term}','${actor}',${admin},30);`)
 assert.equal(search('hiddenneedle'), '0', 'No direct RPC private result or public draft match')
 assert.equal(search('programneedle'), '1', 'Keep authorized program results')
 assert.equal(search('programneedle',''), '0', 'Caller parameters cannot replace authenticated identity')
 assert.equal(search('academyneedle',actor,true), '0', 'Forged admin flag cannot expose unpublished classes')
 sql(`update organizations set profile=jsonb_set(profile,'{roadmap,sections,0,status}','"complete"') where is_public;`)
 assert.equal(search('hiddenneedle'), '1', 'Explicitly published community narrative remains searchable')
 sql(`update organizations set closed=true where is_public;`)
 assert.equal(search('hiddenneedle'), '0', 'Closure removes public search admission')
 sql(`update organizations set closed=false,profile=jsonb_set(profile,'{roadmap,sections,0,documentSource}','"google_drive"') where is_public;`)
 assert.equal(search('hiddenneedle'), '0', 'Drive selection cannot expose inactive editor content')
 assert.equal(sql(`select has_table_privilege('authenticated','search_index','select');`), 'f')
 assert.equal(sql(`select public.public_organization_narrative_plain_text('{"mission":"stale","roadmap":{"sections":{"mission_vision_values":{"content":"","publicProfileStatusControlled":true,"status":"complete"}}}}','mission_vision_values','mission');`), '', 'Empty published content does not revive legacy text')
 console.log('Passed: direct RPC privacy, public draft/publish/Drive/closure, identity, admin, program preservation, view ACL and record-storage fallback.')
} finally {
 if (started) run('pg_ctl', ['-D', data, '-m', 'fast', '-w', 'stop'])
 rmSync(root, { recursive: true, force: true })
}
