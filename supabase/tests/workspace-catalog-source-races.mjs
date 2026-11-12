import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'

export async function verifyWorkspaceCatalogRaces(target, env) {
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
  const state = await sql(`select state from organization_workspace_boards where org_id='${org}';`)
  const literal = `'${state.replaceAll("'", "''")}'::jsonb`
  const commit = (next, expected = literal) => `${identity(actor)}set role service_role;select commit_workspace_catalog('${org}','${actor}',${expected},${next});`
  const rename = commit(`jsonb_set(${literal},'{workspaceCatalog,defaultName}','"Race rename"')`)
  const downgrade = `${identity(org)}update organization_memberships set role='member' where org_id='${org}' and member_id='${actor}';`
  const restore = () => sql(`${identity(org)}update organization_memberships set role='staff' where org_id='${org}' and member_id='${actor}';update organization_workspace_boards set state=${literal} where org_id='${org}';`)
  assert.match(await race(downgrade, rename), /permission or content is changing/)
  await assert.rejects(sql(rename), /editor access required/)
  await restore()
  assert.match(await race(rename, downgrade), /lock timeout/)
  await restore()
  const grants = values => `${identity(org)}select set_project_asset_folder_access('${project}','${folder}','${org}',(select access_revision from project_asset_folders where project_id='${project}' and id='${folder}'),'restricted','${JSON.stringify(values)}');`
  await sql(grants([{ memberId: actor, capability: 'view' }]))
  const removePrivate = commit(`jsonb_set(${literal},'{workspaceCatalog,entries}','[]')`)
  assert.match(await race(grants([]), removePrivate), /Board source permission is changing/)
  await assert.rejects(sql(removePrivate), /Board source access required/)
  await sql(grants([{ memberId: actor, capability: 'view' }]))
  assert.match(await race(removePrivate, grants([])), /lock timeout/)
  await restore()
  await sql(grants([]))
  assert.match(await race(rename, commit(`jsonb_set(${literal},'{workspaceCatalog,defaultName}','"Stale rename"')`)), /permission or content is changing/)
  assert.equal(await sql(commit(literal)), 'f')
  assert.equal(await sql(`select state#>>'{workspaceCatalog,defaultName}' from organization_workspace_boards where org_id='${org}';`), 'Race rename')
  console.log('[catalog] Both orderings of editor/source revocation and full-state CAS passed.')
}
