// Explicit, local, synthetic full-schema template only. The source is read-only;
// all mutations run in a fresh disposable copy, including real existing guards.
import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
const template = new URL(process.env.DOCUMENT_FOLDER_PURGE_TEST_DATABASE_URL || 'file:///missing')
assert.equal(template.hostname, '127.0.0.1', 'Explicit local full-schema fixture required')
assert.match(template.pathname, /^\/workspace_sharing_fixture_[a-z0-9_]+$/)
assert.equal(template.password, '')
assert.equal(template.search, '')
const name = `ch_folder_purge_${process.pid}_${Date.now()}`
const maintenance = new URL(template); maintenance.pathname = '/postgres'
const target = new URL(template); target.pathname = `/${name}`
const env = { ...process.env, PGOPTIONS: '-c statement_timeout=15000 -c timezone=UTC' }
const sql = (query, url = target) => {
  const r = spawnSync('psql', ['-XqAt', '-v', 'ON_ERROR_STOP=1', '-d', url.href], { input: query, env, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 })
  assert.equal(r.status, 0, r.stderr); return r.stdout.trim()
}
let created = false
try {
  sql(`create database ${name} template ${template.pathname.slice(1)};`, maintenance); created = true
  for (const migration of [
    '20261106010000_project_folder_storage.sql', '20261106030000_project_folder_grants.sql',
    '20261106040000_document_file_folder_reads.sql', '20261106050000_document_file_folder_writes.sql',
    '20261106060000_document_file_folder_storage.sql', '20261106070000_document_folder_stage_cleanup.sql', '20261106080000_document_folder_purge.sql',
  ]) sql(readFileSync(`supabase/migrations/${migration}`, 'utf8'))
  sql('begin;'+readFileSync('supabase/tests/document-folder-stage-cleanup.assertions.sql', 'utf8').replaceAll('ch_stage_cleanup_%','ch_folder_purge_%')+'\nrollback;')
  sql(readFileSync('supabase/tests/document-folder-purge.assertions.sql', 'utf8'))
  console.log('[folder-purge] Full-schema trash, reserve, revoke, partial deletion, quota, finish, replay and immutable receipt assertions passed.')

  const org='e972bc07-fbf5-4fc8-a416-7f00910a71e2',actor='90b6c688-889c-467f-9edd-166f28bf0819'
  const project='71000000-0000-4000-8000-000000000001',folder='71000000-0000-4000-8000-000000000002'
  const id=n=>`73000000-0000-4000-8000-${String(n).padStart(12,'0')}`
  const object=n=>`${org}/library/${id(n)}-original.md`
  const context=who=>`set request.jwt.claim.role='service_role';set request.headers='{"x-coach-house-actor-id":"${who}"}';set storage.allow_delete_query='true';`
  const grant=()=>sql(`insert into project_asset_folder_grants(project_id,folder_id,member_id,membership_created_at,capability) select '${project}','${folder}',member_id,created_at,'edit' from organization_memberships where org_id='${org}' and member_id='${actor}' on conflict(project_id,folder_id,member_id) do update set capability='edit',membership_created_at=excluded.membership_created_at;`)
  const revoke=`delete from project_asset_folder_grants where project_id='${project}' and member_id='${actor}';`
  const reserve=n=>`${context(actor)}select reserve_document_file_purge('${org}','${id(n)}','${actor}');`
  const remove=n=>`${context(actor)}delete from storage.objects where bucket_id='org-documents' and name='${object(n)}';`
  const finish=n=>`${context(actor)}select finish_document_file_purge('${org}','${id(n)}','${actor}');`
  grant()
  for(const n of [81,82,83,84,85,86]) sql(`${context(org)}insert into organization_document_files(id,org_id,name,mime_type,size_bytes,storage_path,created_by,deleted_at) values('${id(n)}','${org}','race.md','text/markdown',3,'${object(n)}','${org}',now());insert into storage.objects(bucket_id,name,metadata) values('org-documents','${object(n)}','{"size":3}');insert into document_file_folder_authorities(file_id,project_id,folder_id) values('${id(n)}','${project}','${folder}');`)
  const session=(query,onLocked)=>new Promise((resolve,reject)=>{
    const p=spawn('psql',['-XqAt','-v','ON_ERROR_STOP=1','-d',target.href],{env});let out='',err='',notified=false
    p.stdout.on('data',b=>{out+=b;if(!notified&&out.includes('locked')){notified=true;onLocked?.()}})
    p.stderr.on('data',b=>{err+=b});p.on('error',reject);p.on('close',code=>code===0?resolve(out):reject(new Error(err)));p.stdin.end(query)
  })
  const race=async(first,second)=>{
    let acquire;const locked=new Promise(resolve=>{acquire=resolve})
    const a=session(`begin;${first}select 'locked';select pg_sleep(0.3);commit;`,acquire)
    await Promise.race([locked,a.then(()=>{throw new Error('Lock marker missing')})])
    return Promise.allSettled([a,session(second)])
  }
  let r=await race(revoke,reserve(81));assert.equal(r[0].status,'fulfilled');assert.equal(r[1].status,'rejected');assert.match(r[1].reason.message,/permission is changing/)
  await assert.rejects(session(reserve(81)),/editing access required/)
  grant();r=await race(reserve(81),revoke);assert.ok(r.every(x=>x.status==='fulfilled'))
  await assert.rejects(session(remove(81)),/editing access required/)
  grant();for(const n of [82,83,84,85,86])sql(reserve(n))
  r=await race(revoke,remove(82));assert.equal(r[0].status,'fulfilled');assert.equal(r[1].status,'rejected');assert.match(r[1].reason.message,/permission is changing/)
  grant();r=await race(remove(82),revoke);assert.ok(r.every(x=>x.status==='fulfilled'))
  await assert.rejects(session(finish(82)),/editing access required/)
  grant();r=await race(revoke,finish(82));assert.equal(r[0].status,'fulfilled');assert.equal(r[1].status,'rejected');assert.match(r[1].reason.message,/permission is changing/)
  grant();r=await race(finish(82),revoke);assert.ok(r.every(x=>x.status==='fulfilled'))
  await assert.rejects(session(finish(82)),/editing access required/)
  grant();const removeMember=`delete from organization_memberships where org_id='${org}' and member_id='${actor}';`
  r=await race(removeMember,remove(83));assert.equal(r[0].status,'fulfilled');assert.equal(r[1].status,'rejected');assert.match(r[1].reason.message,/permission is changing/)
  sql(`insert into organization_memberships(org_id,member_id,role,member_email) select '${org}','${actor}','staff',email from auth.users where id='${actor}';`)
  await assert.rejects(session(remove(83)),/editing access required/)
  grant();r=await race(remove(83),removeMember);assert.ok(r.every(x=>x.status==='fulfilled'))
  await assert.rejects(session(finish(83)),/Document editing|Document editing access/)
  console.log('[folder-purge] Both grant/reserve, grant/delete, grant/finish and membership/delete orderings passed; rejoin restores no authority.')
} finally {
  if (created) sql(`drop database ${name};`, maintenance)
}
