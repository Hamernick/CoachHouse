import assert from "node:assert/strict"
import { spawn, spawnSync } from "node:child_process"

export async function verifyLegacyCleanupRaces({ psql, args, env }) {
  const org = "00000000-0000-0000-0000-000000000001"
  const context = `set request.jwt.claim.role='service_role';set request.headers='{"x-coach-house-actor-id":"${org}"}';`
  const sql = query => {
    const result = spawnSync(psql, args, { input: context + query, encoding: "utf8", env })
    assert.equal(result.status, 0, result.stderr)
    return result.stdout.trim()
  }
  const update = path => `update organizations set profile=jsonb_set(profile,'{documents,w9}',jsonb_build_object('path','${org}/w9/${path}.pdf','name','Race','size',10)) where user_id='${org}';`
  const session = (query, notify) => new Promise((resolve, reject) => {
    const child = spawn(psql, args, { env })
    let output = "", error = "", notified = false
    child.stdout.on("data", chunk => {
      output += chunk
      if (!notified && output.includes("locked")) { notified = true; notify?.() }
    })
    child.stderr.on("data", chunk => { error += chunk })
    child.on("error", reject)
    child.on("close", code => resolve({ code, output, error }))
    child.stdin.end(context + query)
  })
  const whileLocked = async (query, competing) => {
    let notify
    const locked = new Promise(resolve => { notify = resolve })
    const first = session(query, notify)
    await Promise.race([locked, first.then(result => { throw Error(`Lock not observed: ${result.error}`) })])
    const second = await session(competing)
    const winner = await first
    assert.equal(winner.code, 0, winner.error)
    return second
  }
  sql(update("race-outgoing") + `insert into storage.objects(bucket_id,name) values('org-documents','${org}/w9/race-outgoing.pdf');`)
  // A replacement holding the profile row wins; cleanup refuses the changing
  // snapshot. A rollback must remove its outgoing-byte receipt as well.
  let result = await whileLocked(`begin;${update("race-rolled-back")}select 'locked';select pg_sleep(0.25);rollback;`,
    `select public.reserve_legacy_document_cleanup('${org}','w9','${org}',false);`)
  assert.notEqual(result.code, 0)
  assert.match(result.error, /retry|changing/i)
  assert.equal(sql(`select count(*) from legacy_document_cleanup where storage_path='${org}/w9/race-outgoing.pdf';`), "0")
  result = await whileLocked(`begin;${update("race-current")}select 'locked';select pg_sleep(0.25);commit;`,
    `select public.reserve_legacy_document_cleanup('${org}','w9','${org}',false);`)
  assert.notEqual(result.code, 0)
  assert.equal(sql(`select size_bytes from legacy_document_cleanup where storage_path='${org}/w9/race-outgoing.pdf';`), "10")
  // Claim commits first. A waiting profile reattachment then observes the fence.
  result = await whileLocked(`begin;select public.reserve_legacy_document_cleanup('${org}','w9','${org}',false);select 'locked';select pg_sleep(0.25);commit;`,
    update("race-outgoing"))
  assert.notEqual(result.code, 0)
  assert.match(result.error, /cleanup|retired/i)
  sql(`delete from storage.objects where name='${org}/w9/race-outgoing.pdf';`)
  result = await whileLocked(`begin;select public.finish_legacy_document_cleanup('${org}','${org}/w9/race-outgoing.pdf','${org}',false);select 'locked';select pg_sleep(0.25);commit;`,
    `insert into storage.objects(bucket_id,name) values('org-documents','${org}/w9/race-outgoing.pdf');`)
  assert.notEqual(result.code, 0)
  assert.match(result.error, /retry|retired/i)
  assert.equal(sql(`select size_bytes from legacy_document_cleanup where storage_path='${org}/w9/race-outgoing.pdf';`), "0")
  assert.equal(sql(`select storage_path from organization_document_files where org_id='${org}' and document_kind='w9';`), `${org}/w9/race-current.pdf`)
  console.log("[legacy-document-cleanup] Replacement commit/rollback, claim/reattachment and finish/recreation races passed.")
}
