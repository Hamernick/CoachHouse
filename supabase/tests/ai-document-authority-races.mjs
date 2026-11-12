import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'

export async function verifyAiDocumentAuthorityRaces(target, env) {
  const org = 'e972bc07-fbf5-4fc8-a416-7f00910a71e2', actor = '90b6c688-889c-467f-9edd-166f28bf0819'
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
  const commit = `${identity(actor)}set role service_role;select fixture_document_commit();`
  const downgrade = `${identity(org)}update organization_memberships set role='member' where org_id='${org}' and member_id='${actor}';`
  const restore = () => sql(`${identity(org)}update organization_memberships set role='staff' where org_id='${org}' and member_id='${actor}';`)
  assert.match(await race(downgrade, commit), /permission or content is changing/)
  await assert.rejects(sql(commit), /editor access required/)
  await restore()
  assert.match(await race(commit, downgrade), /lock timeout/)
  assert.equal(await sql(`select count(*) from workspace_ai_document_applications where run_id='89000000-0000-4000-8000-000000000001'`), '1')
  const closing = `${identity(org)}select organization_closure_command('${org}','${org}','request','89000000-0000-4000-8000-000000000010',0);`
  assert.match(await race(closing, commit), /permission or content is changing/)
  await assert.rejects(sql(commit), /Organization unavailable/)
  await sql(`${identity(org)}select organization_closure_command('${org}','${org}','cancel','89000000-0000-4000-8000-000000000011',1);`)
  const reclose = `${identity(org)}select organization_closure_command('${org}','${org}','request','89000000-0000-4000-8000-000000000012',2);`
  assert.match(await race(commit, reclose), /lock timeout/)
  console.log('[ai-document] Both orderings of editor revocation and closure passed, including replay.')
}
