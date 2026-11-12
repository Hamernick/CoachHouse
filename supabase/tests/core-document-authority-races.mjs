import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'

export async function verifyCoreDocumentAuthorityRaces(target, env) {
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
  const commit = `${identity(actor)}set role service_role;select fixture_core_commit();`
  const downgrade = `${identity(org)}update organization_memberships set role='member' where org_id='${org}' and member_id='${actor}';`
  const restore = () => sql(`${identity(org)}update organization_memberships set role='staff' where org_id='${org}' and member_id='${actor}';`)
  assert.match(await race(downgrade, commit), /permission or content is changing/)
  await assert.rejects(sql(commit), /editor access required/)
  await restore()
  assert.match(await race(commit, downgrade), /lock timeout/)
  assert.equal(await sql(`select count(*) from organization_core_document_sessions where org_id='${org}' and section_id='authority_fixture'`), '1')
  const closing = `${identity(org)}select organization_closure_command('${org}','${org}','request','89000000-0000-4000-8000-000000000010',0);`
  assert.match(await race(closing, commit), /permission or content is changing/)
  await assert.rejects(sql(commit), /Organization unavailable/)
  await sql(`${identity(org)}select organization_closure_command('${org}','${org}','cancel','89000000-0000-4000-8000-000000000011',1);`)
  const reclose = `${identity(org)}select organization_closure_command('${org}','${org}','request','89000000-0000-4000-8000-000000000012',2);`
  assert.match(await race(commit, reclose), /lock timeout/)
  const cancelSubscription = `${identity(org)}update subscriptions set status='canceled' where user_id='${org}';`
  assert.match(await race(cancelSubscription, commit), /permission or content is changing/)
  await assert.rejects(sql(commit), /storage access required/)
  await sql(`${identity(org)}update subscriptions set status='active' where user_id='${org}';`)
  assert.match(await race(commit, cancelSubscription), /lock timeout/)
  // A newer entitlement row can also revoke access; FK parent locking fences it.
  const replaceSubscription = `${identity(org)}insert into subscriptions(user_id,stripe_subscription_id,status,metadata) values('${org}','fixture_new_subscription','canceled','{"plan_tier":"organization"}');`
  assert.match(await race(replaceSubscription, commit), /permission or content is changing/)
  await assert.rejects(sql(commit), /storage access required/)
  await sql(`delete from subscriptions where stripe_subscription_id='fixture_new_subscription';`)
  assert.match(await race(commit, replaceSubscription), /lock timeout/)
  await sql(`${identity(org)}insert into platform_staff_members(user_id,access_level) values('${actor}','coach') on conflict(user_id) do update set access_level='coach';insert into workspace_support_grants(user_id) values('${actor}') on conflict(user_id) do update set revoked_at=null;`)
  const supportCommit = `${identity(actor)}set role service_role;select fixture_core_commit(true);`
  const revokeSupport = `${identity(org)}update workspace_support_grants set revoked_at=now() where user_id='${actor}';`
  assert.match(await race(revokeSupport, supportCommit), /permission or content is changing/)
  await assert.rejects(sql(supportCommit), /support access changed/)
  await sql(`${identity(org)}update workspace_support_grants set revoked_at=null where user_id='${actor}';`)
  assert.match(await race(supportCommit, revokeSupport), /lock timeout/)
  const ban = `update auth.users set banned_until=now()+interval '1 hour' where id='${actor}';`
  assert.match(await race(ban, supportCommit), /permission or content is changing/)
  await assert.rejects(sql(supportCommit), /editor access required/)
  await sql(`update auth.users set banned_until=null where id='${actor}';`)
  assert.match(await race(supportCommit, ban), /lock timeout/)
  await sql(`${identity(org)}delete from organization_memberships where org_id='${org}' and member_id='${actor}';`)
  const restrictScope = `update organization_coach_scope_settings set assigned_only_enabled=true,activated_at=now(),activated_by='${org}' where id=true;`
  assert.match(await race(restrictScope, commit), /permission or content is changing/)
  await assert.rejects(sql(commit), /editor access required/)
  await sql(`update organization_coach_scope_settings set assigned_only_enabled=false,activated_at=null,activated_by=null where id=true;`)
  assert.match(await race(commit, restrictScope), /lock timeout/)
  await sql(`insert into platform_staff_members(user_id,access_level) values('${org}','coach') on conflict(user_id) do update set access_level='coach';insert into organization_coach_assignments(organization_id,coach_user_id) values('${org}','${actor}'),('${org}','${org}');${restrictScope}`)
  const unassign = `delete from organization_coach_assignments where organization_id='${org}' and coach_user_id='${actor}';`
  assert.match(await race(unassign, commit), /permission or content is changing/)
  await assert.rejects(sql(commit), /editor access required/)
  await sql(`insert into organization_coach_assignments(organization_id,coach_user_id) values('${org}','${actor}');`)
  assert.match(await race(commit, unassign), /lock timeout/)
  console.log('[core-document] Both orderings of editor, support, account, subscription, coach scope/assignment and closure races passed.')
}
