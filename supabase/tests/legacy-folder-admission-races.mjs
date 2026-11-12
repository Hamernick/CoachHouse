import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'

export async function verifyLegacyAdmissionRaces({ psql, args, env }) {
  const org = 'e972bc07-fbf5-4fc8-a416-7f00910a71e2'
  const project = '7a000000-0000-4000-8000-000000000001'
  const folder = '7a000000-0000-4000-8000-000000000002'
  const context = `set request.jwt.claim.role='service_role';set request.headers='{"x-coach-house-actor-id":"${org}"}';`
  const sql = query => {
    const r = spawnSync(psql, args, { input: context + query, env, encoding: 'utf8' })
    assert.equal(r.status, 0, r.stderr)
    return r.stdout.trim()
  }
  const session = (query, notify) => new Promise((resolve, reject) => {
    const child = spawn(psql, args, { env }); let output = '', error = '', notified = false
    child.stdout.on('data', b => { output += b; if (!notified && output.includes('locked')) { notified = true; notify?.() } })
    child.stderr.on('data', b => { error += b })
    child.on('error', reject)
    child.on('close', code => resolve({ code, output, error }))
    child.stdin.end(context + query)
  })
  const race = async (first, second, commit = false) => {
    let notify
    const locked = new Promise(r => { notify = r })
    const a = session(`begin;${first}select 'locked';select pg_sleep(0.3);${commit ? 'commit' : 'rollback'};`, notify)
    await Promise.race([locked, a.then(r => { throw Error(`No lock marker: ${r.error}`) })])
    const b = await session(second)
    const done = await a
    assert.equal(done.code, 0, done.error)
    assert.notEqual(b.code, 0, b.output)
    assert.match(b.error, /retry|changing|require the Storage cutover/)
  }
  const bind = `insert into document_file_folder_authorities(file_id,project_id,folder_id) select id,'${project}','${folder}' from organization_document_files where org_id='${org}' and document_kind='w9';`
  const path = `${org}/w9/7a000000-0000-4000-8000-000000000101-race.pdf`
  const reserve = `select reserve_legacy_document_upload('${org}','w9','${path}',7,'${org}');`
  const operation = `insert into document_version_operations(file_id,request_id,org_id,actor_id,fingerprint,staged_bytes) select id,'7a000000-0000-4000-8000-000000000102','${org}','${org}','admission-race',2 from organization_document_files where org_id='${org}' and document_kind='w9';`
  const replacementPath = `${org}/w9/7a000000-0000-4000-8000-000000000012-staged.pdf`
  sql(`insert into organization_private_storage_cutovers(org_id) values('${org}');`)
  await race(reserve, bind)
  await race(bind, reserve)
  await race(`insert into storage.objects(bucket_id,name,metadata) values('org-documents','${replacementPath}','{"size":6}');update organizations set profile=jsonb_set(profile,'{documents,w9}',jsonb_build_object('path','${replacementPath}','name','replacement.pdf','size',6)) where user_id='${org}';`, bind)
  await race(operation, bind)
  await race(bind, operation)
  await race(`delete from organization_private_storage_cutovers where org_id='${org}';`, bind)
  await race(bind, `delete from organization_private_storage_cutovers where org_id='${org}';`, true)
  sql(`delete from document_file_folder_authorities where project_id='${project}';`)
  sql(`delete from organization_private_storage_cutovers where org_id='${org}';`)
  const denied = await session(bind)
  assert.notEqual(denied.code, 0)
  assert.match(denied.error, /cutover/)
  console.log('[legacy-admission] Seven stage, canonical-replacement, retained-operation and cutover/admission races passed.')
}
