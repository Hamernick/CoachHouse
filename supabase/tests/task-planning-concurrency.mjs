import assert from "node:assert/strict"
import { spawn } from "node:child_process"
import { join } from "node:path"

// Two real PostgreSQL sessions race the same snapshots. Row/project locks serialize
// mutations; the second observes stale dates/ranks instead of overwriting.
export async function verifyTaskPlanningConcurrency({ postgresDirectory, port, socketDirectory }) {
  function sql(query, onOutput) {
    return new Promise((resolve, reject) => {
      const child = spawn(join(postgresDirectory, "psql"), ["-h", socketDirectory, "-p", port, "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-Atq"])
      let output = ""
      let error = ""
      child.stdout.on("data", (data) => { output += data; onOutput?.(output) })
      child.stderr.on("data", (data) => { error += data })
      child.on("error", reject)
      child.on("close", (code) => code === 0 ? resolve(output.trim()) : reject(new Error(error)))
      child.stdin.end(query)
    })
  }
  const actor = "00000000-0000-4000-8000-000000000001"
  const project = "00000000-0000-4000-8000-000000000210"
  const task = "00000000-0000-4000-8000-000000000220"
  const neighbor = "00000000-0000-4000-8000-000000000221"
  const schedule = (date) => `select public.schedule_organization_task_transition('${actor}','${task}','${project}','${actor}','${date}',null,'2026-11-30');`
  const results = (await Promise.all([sql(schedule("2026-11-03")), sql(schedule("2026-11-04"))])).map(JSON.parse)
  assert.equal(results.filter((result) => result.ok).length, 1, "Only one stale-snapshot schedule may succeed")
  assert.equal(results.filter((result) => result.code === "stale").length, 1)

  const snapshot = JSON.parse(await sql(`select jsonb_object_agg(id,jsonb_build_object('rank',sort_order,'version',updated_at)) from organization_tasks where id in ('${task}','${neighbor}');`))
  const move = (placement) => `select public.move_organization_task_transition('${actor}','${task}','${project}','${actor}','${neighbor}','${placement}',${snapshot[task].rank},${snapshot[neighbor].rank},'${snapshot[task].version}','${snapshot[neighbor].version}');`
  // Both positions change the current order, so neither request is a no-op.
  const orders = (await Promise.all([sql(move("before")), sql(move("after"))])).map(JSON.parse)
  assert.equal(orders.filter((result) => result.ok).length, 1, "Concurrent reorder must not overwrite the winner")
  assert.equal(orders.filter((result) => result.code === "stale").length, 1)
  assert(orders.every((result) => !Object.hasOwn(result, "order")), "No hidden task IDs returned")

  const lockedSnapshot = JSON.parse(await sql(`select jsonb_object_agg(id,jsonb_build_object('rank',sort_order,'version',updated_at)) from organization_tasks where id in ('${task}','${neighbor}');`))
  let notifyLocked
  const locked = new Promise((resolve) => { notifyLocked = resolve })
  const editor = sql(`begin; select id from organization_tasks where id='${task}' for update; select 'task-locked'; select pg_sleep(0.4); select id from organization_projects where id='${project}' for update; commit;`, (output) => {
    if (output.includes("task-locked")) notifyLocked()
  })
  // A failed editor must reject the readiness wait too, never leave a hung test.
  await Promise.race([locked, editor.then(() => { throw new Error("Editor completed before lock probe") })])
  const contention = JSON.parse(await sql(`select public.move_organization_task_transition('${actor}','${task}','${project}','${actor}','${neighbor}','before',${lockedSnapshot[task].rank},${lockedSnapshot[neighbor].rank},'${lockedSnapshot[task].version}','${lockedSnapshot[neighbor].version}');`))
  assert.equal(contention.code, "stale", "Task-first full editor does not deadlock project-first ordering")
  await editor

  const currentDate = await sql(`select start_date from organization_tasks where id='${task}';`)
  await Promise.all([
    sql(`update organization_tasks set title='Concurrent title' where id='${task}';`),
    sql(`select public.schedule_organization_task_transition('${actor}','${task}','${project}','${actor}','2026-11-05','${currentDate}','2026-11-30');`),
  ])
  const row = JSON.parse(await sql(`select jsonb_build_object('title',title,'start',start_date,'end',end_date,'status',status,'assignees',(select count(*) from organization_task_assignees where task_id=t.id)) from organization_tasks t where id='${task}';`))
  assert.deepEqual(row, { title: "Concurrent title", start: "2026-11-05", end: "2026-11-30", status: "waiting", assignees: 2 })
  console.log("[task-planning] Narrow scheduling, hidden-task ordering, conflict serialization, assignments and RPC grants passed.")
}
