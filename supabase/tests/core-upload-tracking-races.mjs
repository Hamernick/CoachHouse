import assert from "node:assert/strict"
import { spawn, spawnSync } from "node:child_process"

export async function verifyCoreUploadRaces({ psql, args, env }) {
  const sql = query => {
    const result = spawnSync(psql, args, { input: query, encoding: "utf8", env })
    assert.equal(result.status, 0, result.stderr)
    return result.stdout.trim()
  }
  const org = "00000000-0000-0000-0000-000000000001"
  const stamp = () => sql(`select updated_at::text from organizations where user_id='${org}';`)
  const update = (path, revision) => `update organizations set profile=jsonb_set(profile,'{documents,w9}',jsonb_build_object('path','${org}/w9/${path}.pdf','name','${path}','size',10)) where user_id='${org}' and updated_at='${revision}'::timestamptz returning 1;`
  const session = (query, notify) => new Promise((resolve, reject) => {
    const child = spawn(psql, args, { env })
    let output = "", error = "", notified = false
    child.stdout.on("data", chunk => { output += chunk; if (!notified && output.includes("locked")) { notified = true; notify?.() } })
    child.stderr.on("data", chunk => { error += chunk })
    child.on("error", reject); child.on("close", code => code === 0 ? resolve(output) : reject(Error(error))); child.stdin.end(query)
  })
  const race = async (rollback = false) => {
    const revision = stamp(); let notify
    const locked = new Promise(resolve => { notify = resolve })
    const first = session(`begin;${update("first", revision)} select 'locked';select pg_sleep(0.25);${rollback ? "rollback" : "commit"};`, notify)
    await Promise.race([locked, first.then(() => { throw Error("Lock not observed") })])
    return Promise.all([first, session(update("second", revision))])
  }
  let result = await race()
  assert.equal(result[1].trim(), "", "Stale profile CAS unexpectedly committed")
  assert.equal(sql(`select f.name||':'||(o.profile#>>'{documents,w9,name}') from organization_document_files f join organizations o on o.user_id=f.org_id where f.org_id='${org}' and f.document_kind='w9';`), "first:first")
  assert.equal(sql(update("second", stamp())), "1")
  assert.equal(sql(`delete from organization_document_files where org_id='${org}' and document_kind='w9' and storage_path='${org}/w9/first.pdf' returning 1;`), "", "Old cleanup deleted replacement")
  result = await race(true)
  assert.equal(result[1].trim(), "1", "Rollback did not release the original CAS")
  assert.equal(sql(`select f.name||':'||(o.profile#>>'{documents,w9,name}') from organization_document_files f join organizations o on o.user_id=f.org_id where f.org_id='${org}' and f.document_kind='w9';`), "second:second")
  console.log("[core-upload-tracking] Commit/rollback CAS races and stale-path cleanup passed.")
}
