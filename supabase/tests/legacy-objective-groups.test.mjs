import assert from 'node:assert/strict'
import { spawnSync, spawn } from 'node:child_process'
import { readFileSync } from 'node:fs'
const template = new URL(process.env.LEGACY_GROUP_TEST_DATABASE_URL || 'file:///missing')
assert.equal(template.hostname, '127.0.0.1', 'Explicit local full-schema fixture required')
assert.match(template.pathname, /^\/workspace_sharing_fixture_[a-z0-9_]+$/)
assert.equal(template.password, '')
assert.equal(template.search, '')
const name = `ch_legacy_groups_${process.pid}_${Date.now()}`
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
const revision = () => sql(`select updated_at from organization_workspace_objective_groups where id='${objective}'`)
const call = (rev = revision(), id = actor, archived = true) => `${identity(id)}select write_workspace_objective_group('${org}','${objective}','${rev}',null,${archived});`
const create = (title = 'Created category', id = actor) => `${identity(id)}select write_workspace_objective_group('${org}',null,null,'${title}',null);`
const state = () => sql(`select row(title,archived_at,updated_at)::text from organization_workspace_objective_groups where id='${objective}'`)
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
 sql(readFileSync('supabase/migrations/20261106232000_legacy_objective_groups.sql','utf8'))
 sql(`insert into organization_memberships(org_id,member_id,role,member_email) select '${org}',id,'staff',email from auth.users where id='${actor}' on conflict(org_id,member_id) do update set role='staff';
 insert into organization_workspace_objective_groups(id,org_id,title,created_by) values('${objective}','${org}','Preserve title','${org}');`)
 const createdGroup=JSON.parse(sql(create('  Created category  ')))
 assert.equal(createdGroup.title,'Created category');assert.equal(createdGroup.created_by,actor)
 failure(create('Created category'),/duplicate key/)
 failure(create('   '),/Invalid category creation/)
 const stale=revision();assert.equal(JSON.parse(sql(call())).title,'Preserve title')
 const unchanged=state();failure(call(stale,actor,false),/Category changed/);assert.equal(state(),unchanged)
 failure(`${identity()}select write_workspace_objective_group('${actor}','${objective}','${revision()}',null,false)`,/Workspace unavailable|Editor access required|Category unavailable/)
 assert.equal(state(),unchanged)
 failure(`${identity()}select write_workspace_objective_group('${org}','${objective}',null,null,false)`,/Category revision required/)
 failure(`${identity()}select write_workspace_objective_group('${org}',null,null,'Invalid',false)`,/Invalid category creation/)
 // Restoring a colliding title must roll back archive state and revision.
 sql(create('Preserve title'))
 const collision=state();failure(call(revision(),actor,false),/duplicate key/);assert.equal(state(),collision)
 sql(`delete from organization_workspace_objective_groups where org_id='${org}' and title='Preserve title' and id<>'${objective}'`)
 assert.equal(JSON.parse(sql(call(revision(),actor,false))).archived_at,null)
 sql(`update organization_memberships set role='board' where org_id='${org}' and member_id='${actor}'`)
 failure(call(),/Editor access required/);failure(create(),/Editor access required/)
 sql(call(revision(),org));sql(create('Owner category',org))
 sql(`update organization_memberships set role='staff' where org_id='${org}' and member_id='${actor}'`)
 const downgrade=`update organization_memberships set role='board' where org_id='${org}' and member_id='${actor}';`
 await race(downgrade,call(),/Category or access is changing/)
 failure(call(),/Editor access required/)
 sql(`update organization_memberships set role='staff' where org_id='${org}' and member_id='${actor}'`)
 await race(call(),downgrade,/lock timeout/)
 await race(downgrade,create('Concurrent category'),/Category or access is changing/)
 sql(`update organization_memberships set role='staff' where org_id='${org}' and member_id='${actor}'`)
 await race(create('Concurrent category'),downgrade,/lock timeout/)
 const ban=`update auth.users set banned_until=now()+interval '1 hour' where id='${actor}';`
 await race(ban,call(),/Category or access is changing/)
 failure(call(),/Editor access required/);failure(create(),/Editor access required/)
 sql(`update auth.users set banned_until=null where id='${actor}'`)
 await race(call(),ban,/lock timeout/)
 const closing=`set request.jwt.claim.role='service_role';set request.headers='{"x-coach-house-actor-id":"${org}"}';select organization_closure_command('${org}','${org}','request','89000000-0000-4000-8000-000000000061',0);`
 await race(closing,call(),/Category or access is changing/)
 failure(call(),/Organization unavailable/);failure(create(),/Organization unavailable/)
 sql(`set request.jwt.claim.role='service_role';set request.headers='{"x-coach-house-actor-id":"${org}"}';select organization_closure_command('${org}','${org}','cancel','89000000-0000-4000-8000-000000000062',1);`)
 const reclose=closing.replace('000000000061','000000000063').replace("',0);","',2);")
 await race(call(),reclose,/lock timeout/)
 failure(`begin isolation level repeatable read;${call()}`,/Category changed/)
 const same=revision();await race(call(same),call(same,actor,false),/Category or access is changing/)
 failure(call(same),/Category changed/)
 sql(`delete from organization_memberships where org_id='${org}' and member_id='${actor}';insert into platform_staff_members(user_id,access_level) values('${actor}','coach') on conflict(user_id) do update set access_level='coach';insert into workspace_support_grants(user_id) values('${actor}') on conflict(user_id) do update set revoked_at=null;`)
 failure(call(),/Editor access required/);failure(create(),/Editor access required/)
 const supportCall=()=>`set request.headers='{"x-coach-house-organization-id":"${org}"}';${call()}`
 failure(supportCall(),/Editor access required/)
 sql(`insert into workspace_support_presence(org_id,session_id,actor_id,path,seen_at) values('${org}','89000000-0000-4000-8000-000000000071','${actor}','/workspace',now());`)
 sql(supportCall());sql(`set request.headers='{"x-coach-house-organization-id":"${org}"}';${create('Support category')}`)
 const revoke=`update workspace_support_grants set revoked_at=now() where user_id='${actor}';`
 await race(revoke,supportCall(),/Category or access is changing/)
 failure(supportCall(),/Editor access required/)
 sql(`update workspace_support_grants set revoked_at=null where user_id='${actor}';update workspace_support_presence set seen_at=now() where actor_id='${actor}'`)
 await race(supportCall(),revoke,/lock timeout/)
 const leave=`delete from workspace_support_presence where actor_id='${actor}';`
 await race(leave,supportCall(),/Category or access is changing/)
 failure(supportCall(),/Editor access required/)
 sql(`insert into workspace_support_presence(org_id,session_id,actor_id,path,seen_at) values('${org}','89000000-0000-4000-8000-000000000071','${actor}','/workspace',now());`)
 await race(supportCall(),leave,/lock timeout/)
 sql(`update platform_staff_members set access_level='developer' where user_id='${actor}'`)
 sql(call());sql(create('Developer category'))
 const demote=`update platform_staff_members set access_level='coach' where user_id='${actor}';`
 await race(demote,call(),/Category or access is changing/)
 failure(call(),/Editor access required/)
 sql(`update platform_staff_members set access_level='developer' where user_id='${actor}'`)
 await race(call(),demote,/lock timeout/)
 assert.equal(sql("select has_function_privilege('anon','public.write_workspace_objective_group(uuid,uuid,timestamptz,text,boolean)','execute')"),'f')
 assert.equal(sql("select has_function_privilege('service_role','public.write_workspace_objective_group(uuid,uuid,timestamptz,text,boolean)','execute')"),'f')
 console.log('[legacy-groups] Creation, archive/restore, stale revision, collision rollback, owner/support access and 15 concurrent authority/write cases passed.')
} finally {if(created)sql(`drop database ${name};`,maintenance)}
