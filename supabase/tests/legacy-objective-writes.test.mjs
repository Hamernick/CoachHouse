import assert from 'node:assert/strict'
import { spawnSync, spawn } from 'node:child_process'
import { readFileSync } from 'node:fs'
const template = new URL(process.env.LEGACY_OBJECTIVE_TEST_DATABASE_URL || 'file:///missing')
assert.equal(template.hostname, '127.0.0.1', 'Explicit local full-schema fixture required')
assert.match(template.pathname, /^\/workspace_sharing_fixture_[a-z0-9_]+$/)
assert.equal(template.password, '')
assert.equal(template.search, '')
const name = `ch_legacy_objectives_${process.pid}_${Date.now()}`
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
const call = (rev = revision(), id = actor, done = true) => `${identity(id)}select write_workspace_objective('status','${org}','${objective}','${rev}',null,null,null,null,null,'${done?'done':'todo'}',null);`
const create = (title = 'Created objective', id = actor) => `${identity(id)}select write_workspace_objective('create','${org}',null,null,'${title}',null,'normal',null,null,null,null);`
const details = (users = 'null', group = 'null', rev = revision()) => `${identity()}select write_workspace_objective('details','${org}','${objective}','${rev}','Edited','Description','high','2026-12-01T12:00:00Z',${group},null,${users});`
const state = () => sql(`select row_to_json(g) from organization_workspace_objectives g where id='${objective}'`)
const assignments = () => sql(`select coalesce(jsonb_agg(to_jsonb(a) order by user_id),'[]') from organization_workspace_objective_assignees a where objective_id='${objective}'`)
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
 for (const file of ['20261106230000_legacy_objective_assignments.sql','20261106231000_legacy_objective_assignment_support.sql','20261106233000_legacy_objective_writes.sql','20261106235000_objective_island_writes.sql']) sql(readFileSync(`supabase/migrations/${file}`,'utf8'))
 sql(`insert into organization_memberships(org_id,member_id,role,member_email) select '${org}',id,'staff',email from auth.users where id='${actor}' on conflict(org_id,member_id) do update set role='staff';
 insert into organization_workspace_objectives(id,org_id,title,description,created_by,source_key,position_rank) values('${objective}','${org}','Preserve title','Preserve description','${org}','retained-source',42);`)
 const createdObjective=JSON.parse(sql(create('  Created objective  ')))
 assert.equal(createdObjective.title,'Created objective');assert.equal(createdObjective.created_by,actor);assert.equal(createdObjective.status,'todo')
 failure(create('   '),/Invalid objective details/)
 const stale=revision();const completed=JSON.parse(sql(call()));assert.equal(completed.title,'Preserve title');assert.equal(completed.status,'done');assert(completed.completed_at)
 assert.equal(completed.position_rank,42);assert.equal(completed.source_key,'retained-source')
 const unchanged=state();failure(call(stale,actor,false),/Objective changed/);assert.equal(state(),unchanged)
 assert.equal(JSON.parse(sql(call())).completed_at,completed.completed_at,'Already completed time stays stable')
 assert.equal(JSON.parse(sql(call(revision(),actor,false))).completed_at,null)
 failure(`${identity()}select write_workspace_objective('status','${actor}','${objective}','${revision()}',null,null,null,null,null,'done',null)`,/Workspace unavailable|Editor access required|Objective unavailable/)
 failure(`${identity()}select write_workspace_objective('status','${org}','${objective}',null,null,null,null,null,null,'done',null)`,/Objective revision required/)
 failure(`${identity()}select write_workspace_objective('create','${org}','${objective}',null,'Invalid',null,'normal',null,null,null,null)`,/Invalid objective creation/)
 failure(call().replace("null,null,null,null,null,'done',null", "'Smuggled',null,null,null,null,'done',null"),/Invalid objective status change/)
 failure(call().replace("'status'", "'unknown'"),/Invalid objective operation/)
 const group='89000000-0000-4000-8000-000000000052'
 sql(`insert into organization_workspace_objective_groups(id,org_id,title,created_by) values('${group}','${org}','Editable','${org}')`)
 const revBeforeEdit=revision();const edited=JSON.parse(sql(details(`array['${org}','${actor}','${actor}']::uuid[]`,`'${group}'`)))
 assert.equal(edited.title,'Edited');assert.equal(edited.group_id,group);assert.equal(edited.priority,'high');assert.equal(edited.status,'todo');assert.equal(edited.source_key,'retained-source')
 assert.equal(JSON.parse(assignments()).length,2)
 const savedState=state(),savedAssignees=assignments()
 failure(details('null',`'${group}'`,revBeforeEdit),/Objective changed/);assert.equal(state(),savedState);assert.equal(assignments(),savedAssignees)
 failure(details("array['89000000-0000-4000-8000-000000000099']::uuid[]"),/Choose current team members/)
 assert.equal(state(),savedState);assert.equal(assignments(),savedAssignees)
 failure(details('array[null]::uuid[]'),/Invalid assignment selection/);assert.equal(state(),savedState)
 failure(details('null',"'89000000-0000-4000-8000-000000000099'"),/Category unavailable/);assert.equal(state(),savedState)
 // Failure after replacement DELETE must roll back fields, revision and assignments.
 sql(`create function public.fail_legacy_objective_assignment_test() returns trigger language plpgsql as $$begin raise exception 'Synthetic insert failure';end;$$;
 create trigger fail_legacy_objective_assignment_test before insert on organization_workspace_objective_assignees for each row execute function fail_legacy_objective_assignment_test();`)
 failure(details(`array['${actor}']::uuid[]`),/Synthetic insert failure/)
 assert.equal(state(),savedState);assert.equal(assignments(),savedAssignees)
 const countBefore=sql(`select count(*) from organization_workspace_objectives where org_id='${org}'`)
 failure(create('Failed creation').replace('null,null,null);',`null,null,array['${actor}']::uuid[]);`),/Synthetic insert failure/)
 assert.equal(sql(`select count(*) from organization_workspace_objectives where org_id='${org}'`),countBefore)
 sql('drop trigger fail_legacy_objective_assignment_test on organization_workspace_objective_assignees;drop function public.fail_legacy_objective_assignment_test();')
 sql(details('null',`'${group}'`));assert.equal(assignments(),savedAssignees)
 sql(details("'{}'::uuid[]",`'${group}'`));assert.equal(assignments(),'[]')
 const initial=JSON.parse(sql(create('Initial assignments').replace('null,null,null);',`null,null,array['${actor}']::uuid[]);`)))
 assert.equal(sql(`select count(*) from organization_workspace_objective_assignees where objective_id='${initial.id}'`),'1')
 const archiveGroup=`update organization_workspace_objective_groups set archived_at=now() where id='${group}';`
 await race(archiveGroup,details('null',`'${group}'`),/Objective or access is changing/)
 sql(details('null',`'${group}'`)) // An already assigned archived category remains editable.
 failure(create('Archived target').replace('null,null,null);',`'${group}',null,null);`),/Category archived/)
 sql(`update organization_workspace_objective_groups set archived_at=null where id='${group}'`)
 await race(details('null',`'${group}'`),archiveGroup,/lock timeout/)
 // Concurrent assignment replacement shares the same parent revision as details/status.
 // The remaining island controls preserve custom/source ownership at commit.
 const stepId='89000000-0000-4000-8000-000000000081'
 sql(`insert into organization_workspace_objective_steps(id,org_id,objective_id,step_order,step_type,title,payload) values('${stepId}','${org}','${objective}',0,'custom','Keep step','{"keep":true}');`)
 const stepState=()=>JSON.parse(sql(`select to_jsonb(s) from organization_workspace_objective_steps s where id='${stepId}'`))
 const island=(isStep=false,rev=isStep?stepState().updated_at:revision(),id=actor)=>`${identity(id)}select write_workspace_objective_island('${org}','${objective}',${isStep?`'${stepId}'`:'null'},'${rev}',${isStep?'null,null':"'Island edit','New description'"},'done');`
 const islandRevision=revision(), beforeIsland=JSON.parse(state())
 assert.equal(sql(island()),'t')
 const afterIsland=JSON.parse(state());assert.equal(afterIsland.title,'Island edit');assert.equal(afterIsland.description,'New description');assert.equal(afterIsland.status,'done')
 for(const key of ['priority','due_at','group_id','source_key','position_rank'])assert.equal(afterIsland[key],beforeIsland[key])
 failure(island(false,islandRevision),/Objective changed/)
 sql(island());assert.equal(JSON.parse(state()).completed_at,afterIsland.completed_at)
 const oldStep=stepState();assert.equal(sql(island(true)),'t')
 const savedStep=stepState();assert.equal(savedStep.status,'done');assert.equal(savedStep.title,'Keep step');assert.deepEqual(savedStep.payload,{keep:true})
 failure(island(true,oldStep.updated_at),/Step changed/)
 sql(island(true));assert.equal(stepState().completed_at,savedStep.completed_at)
 sql(island(true).replace("'done');","'todo');"));assert.equal(stepState().completed_at,null)
 for(const isStep of [false,true]){
  failure(island(isStep).replace(`'${org}','${objective}'`,`'${actor}','${objective}'`),/Workspace unavailable|Editor access required|source/)
  failure(island(isStep).replace(`'${objective}',`,`'89000000-0000-4000-8000-000000000099',`),/source/)
  failure(`begin isolation level repeatable read;${island(isStep)}`,/Objective changed/)
 }
 failure(island(true).replace('null,null',"'Smuggled',null"),/Invalid step/)
 failure(island().replace("'Island edit'","' '"),/Invalid objective/)
 failure(island().replace("'done');","'invalid');"),/Invalid objective/)
 sql(`update organization_workspace_objectives set kind='system' where id='${objective}';`)
 failure(island(),/source/);failure(island(true),/source/)
 sql(`update organization_workspace_objectives set kind='custom' where id='${objective}';update organization_workspace_objective_steps set step_type='notes' where id='${stepId}';`)
 failure(island(true),/source/)
 sql(`update organization_workspace_objective_steps set step_type='custom' where id='${stepId}'`)
 const sourceSwitch=`update organization_workspace_objectives set kind='system' where id='${objective}';`
 for(const isStep of [false,true]){
  await race(sourceSwitch,island(isStep),/Objective or access is changing/)
  failure(island(isStep),/source/)
  sql(`update organization_workspace_objectives set kind='custom' where id='${objective}'`)
  await race(island(isStep),sourceSwitch,/lock timeout/)
  const rev=isStep?stepState().updated_at:revision()
  await race(island(isStep,rev),island(isStep,rev),/Objective or access is changing/)
  failure(island(isStep,rev),/changed/)
  const revoke=`update organization_memberships set role='board' where org_id='${org}' and member_id='${actor}';`
  await race(revoke,island(isStep),/Objective or access is changing/)
  failure(island(isStep),/Editor access required/)
  sql(island(isStep,undefined,org))
  sql(`update organization_memberships set role='staff' where org_id='${org}' and member_id='${actor}'`)
  await race(island(isStep),revoke,/lock timeout/)
 }
 const stepSwitch=`update organization_workspace_objective_steps set step_type='notes' where id='${stepId}';`
 await race(stepSwitch,island(true),/Objective or access is changing/)
 failure(island(true),/source/)
 sql(`update organization_workspace_objective_steps set step_type='custom' where id='${stepId}'`)
 await race(island(true),stepSwitch,/lock timeout/)
 for(const role of ['anon','service_role']) assert.equal(sql(`select has_function_privilege('${role}','public.write_workspace_objective_island(uuid,uuid,uuid,timestamptz,text,text,text)','execute')`),'f')
 console.log('[objective-island] Field preservation, custom ownership, exact parent/step revisions, ambiguous input denial and 12 concurrent source/write/member cases passed.')
 const sharedRev=revision()
 const replace=`${identity()}select replace_workspace_objective_assignees('${org}','${objective}','${sharedRev}',array['${actor}']::uuid[]);`
 await race(replace,details('null',`'${group}'`,sharedRev),/Objective or access is changing/)
 failure(details('null',`'${group}'`,sharedRev),/Objective changed/)
 sql(`update organization_memberships set role='board' where org_id='${org}' and member_id='${actor}'`)
 failure(call(),/Editor access required/);failure(create(),/Editor access required/)
 sql(call(revision(),org));sql(create('Owner objective',org))
 sql(`update organization_memberships set role='staff' where org_id='${org}' and member_id='${actor}'`)
 const downgrade=`update organization_memberships set role='board' where org_id='${org}' and member_id='${actor}';`
 await race(downgrade,call(),/Objective or access is changing/)
 failure(call(),/Editor access required/)
 sql(`update organization_memberships set role='staff' where org_id='${org}' and member_id='${actor}'`)
 await race(call(),downgrade,/lock timeout/)
 await race(downgrade,create('Concurrent objective'),/Objective or access is changing/)
 sql(`update organization_memberships set role='staff' where org_id='${org}' and member_id='${actor}'`)
 await race(create('Concurrent objective'),downgrade,/lock timeout/)
 const ban=`update auth.users set banned_until=now()+interval '1 hour' where id='${actor}';`
 await race(ban,call(),/Objective or access is changing/)
 failure(call(),/Editor access required/);failure(create(),/Editor access required/)
 sql(`update auth.users set banned_until=null where id='${actor}'`)
 await race(call(),ban,/lock timeout/)
 const closing=`set request.jwt.claim.role='service_role';set request.headers='{"x-coach-house-actor-id":"${org}"}';select organization_closure_command('${org}','${org}','request','89000000-0000-4000-8000-000000000061',0);`
 await race(closing,call(),/Objective or access is changing/)
 failure(call(),/Organization unavailable/);failure(create(),/Organization unavailable/)
 sql(`set request.jwt.claim.role='service_role';set request.headers='{"x-coach-house-actor-id":"${org}"}';select organization_closure_command('${org}','${org}','cancel','89000000-0000-4000-8000-000000000062',1);`)
 const reclose=closing.replace('000000000061','000000000063').replace("',0);","',2);")
 await race(call(),reclose,/lock timeout/)
 failure(`begin isolation level repeatable read;${call()}`,/Objective changed/)
 const same=revision();await race(call(same),call(same,actor,false),/Objective or access is changing/)
 failure(call(same),/Objective changed/)
 sql(`delete from organization_memberships where org_id='${org}' and member_id='${actor}';insert into platform_staff_members(user_id,access_level) values('${actor}','coach') on conflict(user_id) do update set access_level='coach';insert into workspace_support_grants(user_id) values('${actor}') on conflict(user_id) do update set revoked_at=null;`)
 failure(call(),/Editor access required/);failure(create(),/Editor access required/)
 const supportCall=()=>`set request.headers='{"x-coach-house-organization-id":"${org}"}';${call()}`
 failure(supportCall(),/Editor access required/)
 sql(`insert into workspace_support_presence(org_id,session_id,actor_id,path,seen_at) values('${org}','89000000-0000-4000-8000-000000000071','${actor}','/workspace',now());`)
 sql(supportCall());sql(`set request.headers='{"x-coach-house-organization-id":"${org}"}';${create('Support objective')}`)
 const revoke=`update workspace_support_grants set revoked_at=now() where user_id='${actor}';`
 await race(revoke,supportCall(),/Objective or access is changing/)
 failure(supportCall(),/Editor access required/)
 sql(`update workspace_support_grants set revoked_at=null where user_id='${actor}';update workspace_support_presence set seen_at=now() where actor_id='${actor}'`)
 await race(supportCall(),revoke,/lock timeout/)
 const leave=`delete from workspace_support_presence where actor_id='${actor}';`
 await race(leave,supportCall(),/Objective or access is changing/)
 failure(supportCall(),/Editor access required/)
 sql(`insert into workspace_support_presence(org_id,session_id,actor_id,path,seen_at) values('${org}','89000000-0000-4000-8000-000000000071','${actor}','/workspace',now());`)
 await race(supportCall(),leave,/lock timeout/)
 sql(`update platform_staff_members set access_level='developer' where user_id='${actor}'`)
 sql(call());sql(create('Developer objective'))
 const demote=`update platform_staff_members set access_level='coach' where user_id='${actor}';`
 await race(demote,call(),/Objective or access is changing/)
 failure(call(),/Editor access required/)
 sql(`update platform_staff_members set access_level='developer' where user_id='${actor}'`)
 await race(call(),demote,/lock timeout/)
 assert.equal(sql("select has_function_privilege('anon','public.write_workspace_objective(text,uuid,uuid,timestamptz,text,text,text,timestamptz,uuid,text,uuid[])','execute')"),'f')
 assert.equal(sql("select has_function_privilege('service_role','public.write_workspace_objective(text,uuid,uuid,timestamptz,text,text,text,timestamptz,uuid,text,uuid[])','execute')"),'f')
 console.log('[legacy-objectives] Create/details/status, atomic assignment rollback, revision/category/member conflicts, owner/support access and 18 concurrent authority/write cases passed.')
} finally {if(created)sql(`drop database ${name};`,maintenance)}
