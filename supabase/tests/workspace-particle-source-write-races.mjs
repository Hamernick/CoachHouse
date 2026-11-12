import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'

export async function verifyParticleSourceWriteRaces(target, env) {
  const org = 'e972bc07-fbf5-4fc8-a416-7f00910a71e2', actor = '90b6c688-889c-467f-9edd-166f28bf0819'
  const project = '76000000-0000-4000-8000-000000000001', folder = '76000000-0000-4000-8000-000000000002'
  const identity = id => `set request.jwt.claim.role='service_role';set request.headers='{"x-coach-house-actor-id":"${id}"}';`
  const sql = (query, onLocked, hold = false) => new Promise((resolve, reject) => {
    const child = spawn('psql', ['-XqAt','-v','ON_ERROR_STOP=1','-d',target.href], { env })
    let output = '', error = '', notified = false
    child.stdout.on('data', data => { output += data; if (!notified && output.includes('locked')) { notified = true; onLocked?.(() => child.stdin.end("commit;")) } })
    child.stderr.on('data', data => { error += data })
    child.on('error', reject)
    child.on('close', code => code === 0 ? resolve(output.trim()) : reject(new Error(error)))
    if (hold) child.stdin.write(query + "\n")
    else child.stdin.end(query)
  })
  const access = grants => `${identity(org)}select set_project_asset_folder_access('${project}','${folder}','${org}',(select access_revision from project_asset_folders where project_id='${project}' and id='${folder}'),'restricted','${JSON.stringify(grants)}');`
  const grant = () => sql(access([{ memberId: actor, capability: 'view' }]))
  const edit = `${identity(actor)}set role service_role;update organization_workspace_boards set state=jsonb_set(state,'{particleGraph,particles,1,title}',to_jsonb(clock_timestamp()::text)) where org_id='${org}';`
  const race = async (first, second) => {
    let acquired, release
    const locked = new Promise(resolve => { acquired = end => { release = end; resolve() } })
    const a = sql(`begin;${first}select 'locked';`, acquired, true)
    await Promise.race([locked, a.then(() => { throw new Error('Lock marker missing') })])
    let result
    try { result = await Promise.allSettled([sql(`set lock_timeout='1000ms';${second}`)]) }
    finally { release() }
    return [...await Promise.allSettled([a]), ...result]
  }
  await grant()
  let result = await race(access([]), edit)
  assert.equal(result[0].status, 'fulfilled')
  assert.equal(result[1].status, 'rejected')
  assert.match(result[1].reason.message, /Board source permission is changing/)
  await assert.rejects(sql(edit), /Board source access required/)
  await grant()
  result = await race(edit, access([]))
  assert.equal(result[0].status, 'fulfilled')
  assert.equal(result[1].status, 'rejected')
  assert.match(result[1].reason.message, /lock timeout/)
  await sql(access([]))
  await assert.rejects(sql(edit), /Board source access required/)
  await grant()
  const remove = `${identity(org)}delete from organization_memberships where org_id='${org}' and member_id='${actor}';`
  result = await race(remove, edit)
  assert.equal(result[0].status, 'fulfilled')
  assert.equal(result[1].status, 'rejected')
  assert.match(result[1].reason.message, /Board source permission is changing/)
  await assert.rejects(sql(edit), /Board source access required/)
  await sql(`${identity(org)}insert into organization_memberships(org_id,member_id,role,member_email) select '${org}','${actor}','staff',email from auth.users where id='${actor}';`)
  await assert.rejects(sql(edit), /Board source access required/)
  await grant()
  result = await race(edit, remove)
  assert.equal(result[0].status, 'fulfilled')
  assert.equal(result[1].status, 'rejected')
  assert.match(result[1].reason.message, /lock timeout/)
  await sql(remove)
  await assert.rejects(sql(edit), /Board source access required/)
  // Two complete-state writers share the existing updated_at CAS. A stale
  // candidate cannot overwrite the first writer's unrelated public edit.
  const stamp = await sql(`select updated_at from organization_workspace_boards where org_id='${org}';`)
  const cas = (index, title) => `${identity(org)}with written as (update organization_workspace_boards set state=jsonb_set(state,'{particleGraph,particles,${index},title}','"${title}"') where org_id='${org}' and updated_at='${stamp}' returning 1) select count(*) from written;`
  result = await race(cas(2, 'CAS winner'), cas(0, 'CAS stale'))
  assert.equal(result[0].status, 'fulfilled')
  assert.equal(result[1].status, 'rejected')
  assert.match(result[1].reason.message, /lock timeout/)
  assert.equal(await sql(cas(0, 'CAS stale')), '0')
  assert.equal(await sql(`select state#>>'{particleGraph,particles,2,title}' from organization_workspace_boards where org_id='${org}';`), 'CAS winner')
  console.log('[particle-fence] Both orderings of grant/member revocation, rejoin denial and full-board CAS passed.')
}
