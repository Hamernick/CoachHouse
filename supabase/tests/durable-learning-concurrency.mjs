import { spawn } from "node:child_process"
import { join } from "node:path"
import assert from "node:assert/strict"

export async function verifyConcurrentLearningWrites(postgresDirectory, port, socketDirectory) {
  const sql = (input) => new Promise((resolve, reject) => {
    const child = spawn(join(postgresDirectory, "psql"), ["-h", socketDirectory, "-p", port, "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-Atq"])
    let output = "", error = ""
    child.stdout.on("data", (data) => { output += data })
    child.stderr.on("data", (data) => { error += data })
    child.on("error", reject)
    child.on("close", (code) => code === 0 ? resolve(output.trim()) : reject(new Error(error)))
    child.stdin.end(input)
  })
  const scope = `set request.jwt.claim.role='authenticated'; set request.jwt.claim.sub='77000000-0000-0000-0000-000000000003'; set request.headers='{}'; set role authenticated;`
  const args = `'77000000-0000-0000-0000-000000000003','79000000-0000-0000-0000-000000000099'`
  await Promise.all(["video", "assignment:one"].map((step) => sql(`begin; ${scope} select public.record_module_step(${args},'${step}'); select pg_sleep(0.2); commit;`)))
  const steps = await sql(`${scope} select step_progress->'completed' ?& array['video','assignment:one'] from public.module_progress where module_id='79000000-0000-0000-0000-000000000099';`)
  assert.equal(steps, "t", "simultaneous step saves must both survive")
  const results = await Promise.all(["Tab A", "Tab B"].map((content) => sql(`begin; ${scope} select public.save_module_notes_if_current(${args},'{"content":"${content}"}',null)->>'ok'; select pg_sleep(0.2); commit;`)))
  assert.deepEqual(results.sort(), ["false", "true"], "only one simultaneous note edit may replace a shared baseline")
  console.log("[durable-learning-concurrency] Simultaneous step union and stale-note rejection passed.")
}
