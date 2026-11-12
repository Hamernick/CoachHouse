import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import net from 'node:net'
import { verifyCoreDocumentFolderAuthority } from './core-document-folder-authority.mjs'
const root = mkdtempSync(join(tmpdir(), 'ch-document-commit-sources-'))
const run = (cmd, args, input) => {
 const result = spawnSync(cmd, args, { input, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 })
 assert.equal(result.status, 0, result.stderr || result.stdout); return result.stdout.trim()
}
const port = await new Promise(resolve => { const server = net.createServer(); server.listen(0, '127.0.0.1', () => { const value = server.address().port; server.close(() => resolve(value)) }) })
const data = join(root, 'data')
const args = ['-XqAt', '-v', 'ON_ERROR_STOP=1', '-d', `postgresql://127.0.0.1:${port}/postgres?gssencmode=disable`]
const sql = query => run('psql', args, query)
const file = path => readFileSync(path, 'utf8')
const org = '10000000-0000-4000-8000-000000000001', member = '10000000-0000-4000-8000-000000000002'
const identity = actor => `set request.jwt.claim.role='service_role';set fixture.actor='${actor}';set role service_role;`
const save = (section, actor=org) => `${identity(actor)}select public.fixture_save('${section}');`
const session = (section, actor=org) => `${identity(actor)}select public.fixture_session('${section}');`
const denied = (query, pattern=/Document source access changed/) => assert.throws(() => sql(query), pattern)
const snapshot = () => sql(`select jsonb_build_object('profile',profile,'sessions',(select jsonb_agg(s) from organization_core_document_sessions s),'versions',(select count(*) from organization_core_document_versions)) from organizations where user_id='${org}';`)
async function race(held, attempted, pattern) {
 const process = spawn('psql', args, { stdio: ['pipe','pipe','pipe'] })
 let output = '', errors = ''
 process.stderr.on('data', value => { errors += value })
 const completed = new Promise(resolve => process.on('close', resolve))
 try {
  await new Promise((resolve,reject) => {
   const timer = setTimeout(() => reject(new Error(`Lock acquisition timeout: ${errors}`)), 5000)
   process.stdout.on('data', value => { output += value; if (output.includes('LOCK_READY')) { clearTimeout(timer); resolve() } })
   process.on('close', () => { clearTimeout(timer); reject(new Error(errors || 'Lock session exited')) })
   process.stdin.write(`begin;${held}\n\\echo LOCK_READY\n`)
  })
  if (pattern === null) assert.equal(sql(`set lock_timeout='300ms';${attempted}`), '', 'Contended publication returns SQL NULL')
  else denied(`set lock_timeout='300ms';${attempted}`, pattern)
 } finally { process.stdin.end('rollback;\n'); assert.equal(await completed, 0, errors) }
}
let started = false
try {
 run('initdb', ['-D',data,'--auth=trust','--no-locale','-E','UTF8'])
 run('pg_ctl',['-D',data,'-l',join(root,'postgres.log'),'-o',`-h 127.0.0.1 -p ${port} -k ${root}`,'-w','start']); started=true
 sql(file('supabase/tests/document-commit-copy-sources.fixture.sql'))
 const migration = name => sql(file(`supabase/migrations/${name}.sql`))
 migration('20261014160000_core_document_collaboration')
 migration('20261106220000_core_document_commit_authority')
 migration('20261106234000_roadmap_profile_commit')
 migration('20261107000000_workspace_ai_document_origins')
 const readers = file('supabase/migrations/20261106130000_workspace_particle_origin_readers.sql')
 sql(readers.slice(readers.indexOf('create function'),readers.indexOf('do $$')))
 migration('20261107030000_workspace_ai_document_copy_sources')
 migration('20261107040000_workspace_ai_document_copy_readers')
 migration('20261107070000_document_commit_copy_sources')
 sql(`insert into workspace_ai_runs values
 ('20000000-0000-4000-8000-000000000001','${org}','${member}','document','{"sectionId":"good"}','succeeded'),
 ('20000000-0000-4000-8000-000000000002','${org}','${member}','document','{}','succeeded');
 insert into workspace_ai_document_applications values('20000000-0000-4000-8000-000000000001','good'),('20000000-0000-4000-8000-000000000002','bad');
 create function fixture_save(section text) returns boolean language plpgsql security definer as $$declare o organizations; p jsonb;begin
 select * into o from organizations where user_id='${org}';
 select jsonb_set(profile,'{roadmap,sections}',(select jsonb_agg(case when s->>'id'=section then jsonb_set(s,'{content}',to_jsonb((s->>'content')||' edit')) else s end) from jsonb_array_elements(profile#>'{roadmap,sections}') s)) into p from organizations where user_id='${org}';
 return commit_roadmap_profile(o.user_id,o.updated_at,p);end$$;
 create function fixture_session(section text,p jsonb default null) returns boolean language plpgsql security definer as $$declare o organizations;begin
 select * into o from organizations where user_id='${org}';
 return commit_core_document_session(o.user_id,section,o.updated_at,null,0,'{"generation":"30000000-0000-4000-8000-000000000001","version":0,"document":{},"steps":[],"section_content":"draft"}',p);end$$;
 create function fixture_replace(p jsonb,stale boolean default false) returns boolean language sql security definer as $$select commit_roadmap_profile(user_id,updated_at-case when stale then interval '1 second' else interval '0' end,p) from organizations where user_id='${org}'$$;
 revoke all on function fixture_save(text),fixture_session(text,jsonb),fixture_replace(jsonb,boolean) from public;
 grant execute on function fixture_save(text),fixture_session(text,jsonb),fixture_replace(jsonb,boolean) to service_role;`)
 const original = snapshot()
 denied(save('bad')); denied(session('bad')); assert.equal(snapshot(),original,'Denied saves cannot alter profile, session or history')
 assert.equal(sql(save('manual')),'t','Unrelated edit retains inaccessible copy')
 assert.equal(sql(save('good',member)),'t','Current author can edit retained copy')
 sql(`delete from organization_memberships where member_id='${member}';`)
 denied(save('good',member),/editor access required/)
 assert.equal(sql(save('good')),'t','Owner retains valid copy after author removal')
 const canonical = sql(`select profile from organizations where user_id='${org}'`)
 const altered = JSON.parse(canonical);altered.roadmap.sections.find(s=>s.id==='bad').content='smuggled'
 const beforeSmuggle=snapshot();denied(`${identity(org)}select fixture_session('good','${JSON.stringify(altered)}');`);assert.equal(snapshot(),beforeSmuggle,'Session cannot replace another denied section')
 const removed = JSON.parse(canonical); removed.roadmap.sections = removed.roadmap.sections.filter(s=>s.id!=='bad')
 denied(`${identity(org)}select fixture_replace('${JSON.stringify(removed)}');`)
 const keyed = JSON.parse(canonical); keyed.roadmap.sections=Object.fromEntries(keyed.roadmap.sections.map(s=>[s.id,s]));keyed.roadmap.sections.bad.content='changed'
 denied(`${identity(org)}select fixture_replace('${JSON.stringify(keyed)}');`)
 const unaffected = JSON.parse(canonical);unaffected.unrelated.extra='keep'
 assert.equal(sql(`${identity(org)}select fixture_replace('${JSON.stringify(unaffected)}');`),'t')
 assert.equal(sql(`${identity(org)}select fixture_replace('${JSON.stringify(unaffected)}',true);`),'f','Stale profile CAS remains rejected')
 // A deleted section cannot be recreated under a retained denied identity.
 sql(`update organizations set profile='${JSON.stringify(removed)}' where user_id='${org}';`)
 denied(`${identity(org)}select fixture_replace('${canonical}');`)
 assert.equal(sql(`select has_function_privilege('service_role','guard_document_commit_copy_sources(uuid,jsonb,jsonb,text)','execute');`),'f')
 for (const actor of ['anon','authenticated']) assert.equal(sql(`select has_function_privilege('${actor}','commit_roadmap_profile(uuid,timestamptz,jsonb,boolean,boolean)','execute');`),'f')
 migration('20261107080000_document_profile_source_fence')
 const direct = (profile, actor=org) => `${identity(actor)}update organizations set profile='${JSON.stringify(profile)}' where user_id='${org}';`
 sql('grant select,update,insert on organizations to service_role,authenticated;')
 const beforeDirect=snapshot()
 denied(direct(JSON.parse(canonical)))
 denied(`${identity(org)}insert into organizations(user_id,profile) values('${org}','${canonical}') on conflict(user_id) do update set profile=excluded.profile;`)
 denied(`begin;delete from organizations where user_id='${org}';${identity(org)}insert into organizations(user_id,profile) values('${org}','${canonical}');`)
 assert.equal(snapshot(),beforeDirect,'Direct, INSERT and UPSERT denial preserve profile/session/history')
 // An existing malformed source cannot be removed by an old full-profile writer.
 sql(`insert into workspace_ai_runs values('20000000-0000-4000-8000-000000000003','${org}','${member}','document','{}','succeeded');
 insert into workspace_ai_document_applications values('20000000-0000-4000-8000-000000000003','manual');`)
 const deleteDenied=JSON.parse(sql(`select profile from organizations where user_id='${org}'`))
 deleteDenied.roadmap.sections=deleteDenied.roadmap.sections.filter(s=>s.id!=='manual')
 denied(direct(deleteDenied))
 const allowed=JSON.parse(sql(`select profile from organizations where user_id='${org}'`))
 allowed.roadmap.sections.find(s=>s.id==='good').content='direct valid edit'
 sql(direct(allowed))
 const authWrite=`set request.jwt.claim.role='authenticated';set fixture.actor='${org}';set role authenticated;`
 allowed.roadmap.sections.find(s=>s.id==='good').content='client bypass'
 denied(`${authWrite}update organizations set profile='${JSON.stringify(allowed)}' where user_id='${org}';`,/Verified document actor required/)
 denied(direct(allowed).replace(`set fixture.actor='${org}'`,"set fixture.actor=''"),/Verified document actor required/)
 const metadata=JSON.parse(sql(`select profile from organizations where user_id='${org}'`))
 metadata.name='Metadata only'
 sql(`${authWrite}update organizations set profile='${JSON.stringify(metadata)}' where user_id='${org}';`)
 assert.equal(JSON.parse(sql(`select profile from organizations where user_id='${org}'`)).name,'Metadata only')
 assert.equal(sql(`select has_function_privilege('service_role','guard_organization_profile_document_sources()','execute');`),'f')
 sql(`insert into organization_memberships values('${org}','${member}','staff');`)
 const removeMember=`delete from organization_memberships where org_id='${org}' and member_id='${member}';`
 await race(removeMember,direct(allowed,member),/permission or content is changing/)
 await race(direct(allowed,member),removeMember,/lock timeout/)
 sql(removeMember)
 denied(direct(allowed,member),/Document source access denied/)
 sql(direct(allowed))
 sql(`update auth.users set banned_until=now()+interval '1 day' where id='${org}';`)
 allowed.roadmap.sections.find(s=>s.id==='good').content='banned edit'
 denied(direct(allowed),/Document source access denied/)
 sql(`update auth.users set banned_until=null where id='${org}';`)
 const mutate = `update workspace_ai_runs set actor_id='${org}' where id='20000000-0000-4000-8000-000000000001';`
 for (const attempt of [save('good'),session('good'),direct(allowed)]) {
  await race(mutate,attempt,/permission or content is changing/)
  await race(attempt,mutate,/lock timeout/)
 }
 sql(mutate)
 denied(save('good'));denied(session('good'))
 sql(`update workspace_ai_runs set actor_id='${member}' where id='20000000-0000-4000-8000-000000000001';`)
 assert.equal(sql(session('good')),'t','Recovery allows atomic session creation')
 const beforeConflict=snapshot();assert.equal(sql(session('good')),'f');assert.equal(snapshot(),beforeConflict,'Session generation conflict changes nothing')
 assert.equal(sql(`select profile->'unrelated' from organizations where user_id='${org}'`),'{"keep": true}','Unrelated canonical data retained')
 await verifyCoreDocumentFolderAuthority({sql,file,migration,race,org,member,identity,snapshot})
 console.log('Passed: actual commit/reader migrations; save/delete/recreate/keyed denial, unrelated edits, owner retention, member removal, profile/session CAS, rollback/history, grants, direct/INSERT/UPSERT/delete/client/missing-actor/banned denial, unrelated metadata, and eight two-connection source/membership races. Controlled prerequisite schema; not full-schema or hosted qualification.')
} finally {
 if(started) run('pg_ctl',['-D',data,'-m','fast','-w','stop'])
 rmSync(root,{recursive:true,force:true})
}
