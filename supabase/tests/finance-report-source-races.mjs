import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'

export async function verifyFinanceReportSourceRaces(target, env) {
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
  const write = `${identity(actor)}set role service_role;update organization_finance_opportunities set status='saved' where id='80000000-0000-4000-8000-000000000001';`
  await grant()
  assert.match(await race(grants([]), write), /lock timeout|permission.*changing/)
  await assert.rejects(sql(write), /Board source access required/)
  await grant()
  assert.match(await race(write, grants([])), /lock timeout/)
  await sql(grants([]))
  await assert.rejects(sql(write), /Board source access required/)
  await grant()
  const downgrade = `${identity(org)}update organization_finance_access set access_level='viewer' where org_id='${org}' and member_id='${actor}';`
  const restore = () => sql(`${identity(org)}update organization_finance_access set access_level='manager' where org_id='${org}' and member_id='${actor}';`)
  assert.match(await race(downgrade, write), /lock timeout|permission.*changing/)
  await assert.rejects(sql(write), /Finance access denied/)
  await restore()
  assert.match(await race(write, downgrade), /lock timeout/)
  await restore()
  await sql(grants([]))
  console.log('[finance-report] Both orderings of source and finance revocation passed.')
}
