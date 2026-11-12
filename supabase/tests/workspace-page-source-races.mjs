import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'

export async function verifyWorkspacePageSourceRaces(target, env) {
  const org = 'e972bc07-fbf5-4fc8-a416-7f00910a71e2', actor = '90b6c688-889c-467f-9edd-166f28bf0819'
  const project = '76000000-0000-4000-8000-000000000001', folder = '76000000-0000-4000-8000-000000000002'
  const identity = id => `set request.jwt.claim.role='service_role';set request.headers='{"x-coach-house-actor-id":"${id}"}';`
  const sql = (query, onLocked, hold = false) => new Promise((resolve, reject) => {
    const child = spawn('psql', ['-XqAt','-v','ON_ERROR_STOP=1','-d',target.href], { env })
    let output = '', error = '', notified = false
    child.stdout.on('data', data => { output += data; if (!notified && output.includes('locked')) { notified = true; onLocked?.(() => child.stdin.end('commit;')) } })
    child.stderr.on('data', data => { error += data })
    child.on('error', reject)
    child.on('close', code => code === 0 ? resolve(output.trim()) : reject(new Error(error)))
    if (hold) child.stdin.write(query + '\n'); else child.stdin.end(query)
  })
  const race = async (first, second) => {
    let acquire, release
    const locked = new Promise(resolve => { acquire = end => { release = end; resolve() } })
    const a = sql(`begin;${first}select 'locked';`, acquire, true)
    await Promise.race([locked, a.then(() => { throw new Error('Missing lock marker') })])
    let result
    try { result = await Promise.allSettled([sql(`set lock_timeout='1000ms';${second}`)]) }
    finally { release() }
    await a
    assert.equal(result[0].status, 'rejected')
    return result[0].reason.message
  }
  const grants = values => `${identity(org)}select set_project_asset_folder_access('${project}','${folder}','${org}',(select access_revision from project_asset_folders where project_id='${project}' and id='${folder}'),'restricted','${JSON.stringify(values)}');`
  const grant = () => sql(grants([{ memberId: actor, capability: 'view' }]))
  const publish = id => `${identity(actor)}set role service_role;select fixture_source_page_commit('${actor}','75000000-0000-4000-8000-000000000003','79000000-0000-4000-8000-00000000000${id}','79000000-0000-4000-8000-00000000001${id}',0,'publish');`
  await grant()
  assert.match(await race(grants([]), publish(1)), /lock timeout|permission is changing/)
  await assert.rejects(sql(publish(1)), /Board source access required/)
  assert.equal(await sql("select count(*) from organization_workspace_pages where id='79000000-0000-4000-8000-000000000001';"), '0')
  await grant()
  assert.match(await race(publish(2), grants([])), /lock timeout/)
  await sql(grants([]))
  // A previously committed public copy keeps its independently reviewed audience.
  assert.equal(await sql("select visibility from organization_workspace_pages where id='79000000-0000-4000-8000-000000000002';"), 'public')
  await grant()
  const downgrade = `${identity(org)}update organization_memberships set role='member' where org_id='${org}' and member_id='${actor}';`
  const restore = () => sql(`${identity(org)}update organization_memberships set role='staff' where org_id='${org}' and member_id='${actor}';`)
  assert.match(await race(downgrade, publish(3)), /lock timeout|permission is changing/)
  await assert.rejects(sql(publish(3)), /Organization editor required/)
  await restore()
  assert.match(await race(publish(4), downgrade), /lock timeout/)
  await restore()
  await sql(grants([]))
  console.log('[page-source] Both orderings of source and editor revocation passed.')
}
