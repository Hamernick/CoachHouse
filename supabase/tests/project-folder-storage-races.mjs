import assert from "node:assert/strict"
import { spawn } from "node:child_process"
import { join } from "node:path"

export async function verifyFolderStorageConcurrency({ postgresDirectory, port, socketDirectory }) {
  const sql = (query) => new Promise((resolve, reject) => {
    const child = spawn(join(postgresDirectory, "psql"), ["-h", socketDirectory, "-p", port, "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-Atq"])
    let output = "", error = ""
    child.stdout.on("data", data => { output += data })
    child.stderr.on("data", data => { error += data })
    child.on("error", reject)
    child.on("close", code => code === 0 ? resolve(output.trim()) : reject(new Error(error)))
    child.stdin.end(query)
  })
  const actor = "00000000-0000-4000-8000-000000000601"
  const project = "00000000-0000-4000-8000-000000000503"
  await sql(`insert into organization_projects(id,org_id,name,created_by,updated_by,status,start_date,end_date)
    values('${project}','${actor}','Folder concurrency fixture','${actor}','${actor}','active','2027-01-01','2027-01-31');`)
  const version = await sql(`select updated_at from organization_projects where id='${project}';`)
  const create = (suffix, name) => sql(`select mutate_project_asset_folder('${project}','${actor}','${actor}','${version}',
    '{"type":"create","name":"${name}"}','00000000-0000-4000-8000-000000000${suffix}');`)
  const result = await Promise.allSettled([create("514", "First"), create("515", "Second")])
  assert.equal(result.filter(item => item.status === "fulfilled").length, 1)
  const rejected = result.find(item => item.status === "rejected")
  assert.match(rejected.reason.message, /project changed/i)
  const persisted = JSON.parse(await sql(`select read_project_asset_folders('${project}');`))
  assert.equal(persisted.folders.length, 1, "Concurrent migration must not drop or duplicate folders")
  assert.equal(persisted.placements.length, 0)
  await sql(`delete from organization_projects where id='${project}';`)
  console.log("[project-folder-storage] Two-session migration/edit race preserved one winner and rejected the stale command.")
}
