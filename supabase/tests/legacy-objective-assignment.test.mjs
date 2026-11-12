import assert from 'node:assert/strict'
import { spawnSync, spawn } from 'node:child_process'
import { readFileSync } from 'node:fs'
const template = new URL(process.env.LEGACY_ASSIGNMENT_TEST_DATABASE_URL || 'file:///missing')
assert.equal(template.hostname, '127.0.0.1', 'Explicit local full-schema fixture required')
assert.match(template.pathname, /^\/workspace_sharing_fixture_[a-z0-9_]+$/)
assert.equal(template.password, '')
assert.equal(template.search, '')
const name = `ch_legacy_assignment_${process.pid}_${Date.now()}`
const maintenance = new URL(template); maintenance.pathname = '/postgres'
const target = new URL(template); target.pathname = `/${name}`
const env = { ...process.env, PGOPTIONS: '-c statement_timeout=15000 -c timezone=UTC' }
const sql = (query, url = target) => {
  const r = spawnSync('psql', ['-XqAt', '-v', 'ON_ERROR_STOP=1', '-d', url.href], { input: query, env, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 })
  assert.equal(r.status, 0, r.stderr); return r.stdout.trim()
}
const org = 'e972bc07-fbf5-4fc8-a416-7f00910a71e2', actor = '90b6c688-889c-467f-9edd-166f28bf0819'
const objective = '89000000-0000-4000-8000-000000000051'
const identity = (id = actor) => `set request.jwt.claim.sub='${id}';set request.jwt.claim.role='authenticated';set role authenticated;`
const revision = () => sql(`select updated_at from organization_workspace_objectives where id='${objective}'`)
const call = (ids = [actor], rev = revision(), id = actor) => `${identity(id)}select replace_workspace_objective_assignees('${org}','${objective}','${rev}',ARRAY[${ids.map(x => `'${x}'::uuid`).join(',')}]::uuid[]);`
const selection = () => sql(`select user_id from organization_workspace_objective_assignees where objective_id='${objective}' order by user_id`)
const failure = (query, pattern) => {
 const r = spawnSync('psql', ['-XqAt','-v','ON_ERROR_STOP=1','-d',target.href], {input:query,env,encoding:'utf8'})
 assert.notEqual(r.status,0);assert.match(r.stderr,pattern)
}
const asyncSql = (query, onLocked, hold = false) => new Promise((resolve,reject) => {
 const child=spawn('psql',['-XqAt','-v','ON_ERROR_STOP=1','-d',target.href],{env})
 let output='',error='',notified=false
 child.stdout.on('data',data=>{output+=data;if(!notified&&output.includes('locked')){notified=true;onLocked?.(()=>child.stdin.end('commit;'))}})
 child.stderr.on('data',data=>{error+=data});child.on('error',reject)
 child.on('close',code=>code===0?resolve(output.trim()):reject(new Error(error)))
 if(hold)child.stdin.write(query+'\n');else child.stdin.end(query)
})
const race = async (first,second,pattern) => {
 let release,acquire
 const locked=new Promise(resolve=>{acquire=end=>{release=end;resolve()}})
 const a=asyncSql(`begin;${first}select 'locked';`,acquire,true)
 await Promise.race([locked,a.then(()=>{throw new Error('Missing lock marker')})])
 try{await assert.rejects(asyncSql(`set lock_timeout='1000ms';${second}`),pattern)}finally{release();await a}
}
let created=false
try {
 sql(`create database ${name} template ${template.pathname.slice(1)};`,maintenance);created=true
 sql(readFileSync('supabase/migrations/20261106230000_legacy_objective_assignments.sql','utf8'))
 sql(readFileSync('supabase/migrations/20261106231000_legacy_objective_assignment_support.sql','utf8'))
 sql(`insert into organization_memberships(org_id,member_id,role,member_email) select '${org}',id,'staff',email from auth.users where id='${actor}' on conflict(org_id,member_id) do update set role='staff';
 insert into organization_workspace_objectives(id,org_id,title,description,created_by) values('${objective}','${org}','Preserve title','Preserve description','${org}');`)
 const stale=revision()
 sql(call([org,actor,actor],stale))
 assert.equal(selection(),[actor,org].sort().join('\n'))
 failure(call([],stale),/Assignments changed/)
 assert.equal(selection(),[actor,org].sort().join('\n'))
 failure(call(['89000000-0000-4000-8000-000000000099']),/Choose current team members/)
 assert.equal(selection(),[actor,org].sort().join('\n'))
 // Force a post-delete insert failure: the transaction must restore assignments
 // and the parent revision, not merely return an error to the UI.
 sql(`create function fixture_reject_assignment() returns trigger language plpgsql as $$begin raise exception 'fixture insert rejected';end$$;create trigger fixture_reject before insert on organization_workspace_objective_assignees for each row execute function fixture_reject_assignment();`)
 const before=revision();failure(call([actor]),/fixture insert rejected/)
 assert.equal(revision(),before);assert.equal(selection(),[actor,org].sort().join('\n'))
 sql('drop trigger fixture_reject on organization_workspace_objective_assignees;')
 sql(call([]));assert.equal(selection(),'')
 sql(`update organization_memberships set role='board' where org_id='${org}' and member_id='${actor}'`)
 failure(call(),/Editor access required/)
 sql(call([org],revision(),org));assert.equal(selection(),org)
 sql(`update organization_memberships set role='staff' where org_id='${org}' and member_id='${actor}'`)
 const downgrade=`update organization_memberships set role='board' where org_id='${org}' and member_id='${actor}';`
 await race(downgrade,call(),/Assignments or access are changing/)
 failure(call(),/Editor access required/)
 sql(`update organization_memberships set role='staff' where org_id='${org}' and member_id='${actor}'`)
 await race(call(),downgrade,/lock timeout/)
 const ban=`update auth.users set banned_until=now()+interval '1 hour' where id='${actor}';`
 await race(ban,call(),/Assignments or access are changing/)
 failure(call(),/Editor access required/)
 sql(`update auth.users set banned_until=null where id='${actor}'`)
 await race(call(),ban,/lock timeout/)
 const remove=`delete from organization_memberships where org_id='${org}' and member_id='${actor}';`
 await race(remove,call([actor],revision(),org),/Assignments or access are changing/)
 failure(call([actor],revision(),org),/Choose current team members/)
 sql(`insert into organization_memberships(org_id,member_id,role,member_email) select '${org}',id,'staff',email from auth.users where id='${actor}'`)
 await race(call([actor],revision(),org),remove,/lock timeout/)
 const closing=`set request.jwt.claim.role='service_role';set request.headers='{"x-coach-house-actor-id":"${org}"}';select organization_closure_command('${org}','${org}','request','89000000-0000-4000-8000-000000000061',0);`
 await race(closing,call(),/Assignments or access are changing/)
 failure(call(),/Organization unavailable/)
 sql(`set request.jwt.claim.role='service_role';set request.headers='{"x-coach-house-actor-id":"${org}"}';select organization_closure_command('${org}','${org}','cancel','89000000-0000-4000-8000-000000000062',1);`)
 const reclose=closing.replace('000000000061','000000000063').replace("',0);","',2);")
 await race(call(),reclose,/lock timeout/)
 failure(`begin isolation level repeatable read;${call()}`,/Assignments changed/)
 const same=revision();await race(call([org],same),call([actor],same),/Assignments or access are changing/)
 failure(call([actor],same),/Assignments changed/);assert.equal(selection(),org)
 assert.equal(sql(`select title||'/'||description from organization_workspace_objectives where id='${objective}'`),'Preserve title/Preserve description')
 sql(`delete from organization_memberships where org_id='${org}' and member_id='${actor}';insert into platform_staff_members(user_id,access_level) values('${actor}','coach') on conflict(user_id) do update set access_level='coach';insert into workspace_support_grants(user_id) values('${actor}') on conflict(user_id) do update set revoked_at=null;`)
 failure(call([org]),/Editor access required/)
 const supportCall=()=>`set request.headers='{"x-coach-house-organization-id":"${org}"}';${call([org])}`
 failure(supportCall(),/Editor access required/)
 sql(`insert into workspace_support_presence(org_id,session_id,actor_id,path,seen_at) values('${org}','89000000-0000-4000-8000-000000000071','${actor}','/workspace',now());`)
 sql(supportCall())
 const revoke=`update workspace_support_grants set revoked_at=now() where user_id='${actor}';`
 await race(revoke,supportCall(),/Assignments or access are changing/)
 failure(supportCall(),/Editor access required/)
 sql(`update workspace_support_grants set revoked_at=null where user_id='${actor}';update workspace_support_presence set seen_at=now() where actor_id='${actor}'`)
 await race(supportCall(),revoke,/lock timeout/)
 const leave=`delete from workspace_support_presence where actor_id='${actor}';`
 await race(leave,supportCall(),/Assignments or access are changing/)
 failure(supportCall(),/Editor access required/)
 sql(`insert into workspace_support_presence(org_id,session_id,actor_id,path,seen_at) values('${org}','89000000-0000-4000-8000-000000000071','${actor}','/workspace',now());`)
 await race(supportCall(),leave,/lock timeout/)
 sql(`update platform_staff_members set access_level='developer' where user_id='${actor}'`)
 sql(call([org]))
 const demote=`update platform_staff_members set access_level='coach' where user_id='${actor}';`
 await race(demote,call([org]),/Assignments or access are changing/)
 failure(call([org]),/Editor access required/)
 sql(`update platform_staff_members set access_level='developer' where user_id='${actor}'`)
 await race(call([org]),demote,/lock timeout/)
 assert.equal(sql("select has_function_privilege('anon','public.replace_workspace_objective_assignees(uuid,uuid,timestamptz,uuid[])','execute')"),'f')
 console.log('[legacy-assignment] Atomic rollback, member validation, owner retention, stale revisions, empty selection and 15 concurrent authority/replacement cases passed.')
} finally {if(created)sql(`drop database ${name};`,maintenance)}
