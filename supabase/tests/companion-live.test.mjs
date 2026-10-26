#!/usr/bin/env node

import { execFileSync, spawn, spawnSync } from "node:child_process"
import {
  accessSync,
  constants,
  mkdtempSync,
  readFileSync,
  rmSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

const root = process.cwd()
const postgresDirectory = process.env.POSTGRES_BINDIR?.trim() || resolvePgBin()
const dataDirectory = mkdtempSync(join(tmpdir(), "ch-companion-live-"))
const port = String(58_000 + (process.pid % 1_000))
const socketDirectory = "/tmp"

function resolvePgBin() {
  const candidates = []
  try {
    candidates.push(
      execFileSync("pg_config", ["--bindir"], { encoding: "utf8" }).trim()
    )
  } catch {}
  for (const formula of [
    "postgresql",
    "postgresql@18",
    "postgresql@17",
    "postgresql@16",
    "postgresql@15",
    "postgresql@14",
  ]) {
    try {
      candidates.push(
        join(
          execFileSync("brew", ["--prefix", formula], {
            encoding: "utf8",
            stdio: ["ignore", "pipe", "ignore"],
          }).trim(),
          "bin"
        )
      )
    } catch {}
  }
  for (const candidate of candidates) {
    if (
      ["initdb", "pg_ctl", "postgres", "psql"].every((name) => {
        try {
          accessSync(join(candidate, name), constants.X_OK)
          return true
        } catch {
          return false
        }
      })
    )
      return candidate
  }
  throw new Error("PostgreSQL server tools are required. Set POSTGRES_BINDIR.")
}

function run(name, args, options = {}) {
  const result = spawnSync(join(postgresDirectory, name), args, {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, LC_ALL: "C" },
    ...options,
  })
  if (result.status !== 0) {
    const output = [result.stdout, result.stderr].filter(Boolean).join("\n")
    throw new Error(`${name} failed${output ? `:\n${output}` : ""}`)
  }
  return result
}

function runSql(path) {
  return run(
    "psql",
    [
      "-h",
      socketDirectory,
      "-p",
      port,
      "-U",
      "postgres",
      "-d",
      "postgres",
      "-v",
      "ON_ERROR_STOP=1",
      "-q",
    ],
    { input: readFileSync(join(root, path), "utf8") }
  )
}

let started = false
try {
  run("initdb", ["-D", dataDirectory, "-A", "trust", "-U", "postgres"])
  run("pg_ctl", [
    "-D",
    dataDirectory,
    "-o",
    `-F -k ${socketDirectory} -p ${port}`,
    "-l",
    join(dataDirectory, "postgres.log"),
    "-w",
    "start",
  ])
  started = true
  runSql("supabase/tests/companion-live.bootstrap.sql")
  runSql("supabase/migrations/20261026160000_companion_live_work.sql")
  runSql("supabase/tests/companion-live.assertions.sql")
  runSql("supabase/tests/companion-live.concurrent.sql")
  const actor = "11111111-1111-4111-8111-111111111111"
  const lesson = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
  const executeAsync = (sql) => new Promise((resolve) => {
    const child = spawn(join(postgresDirectory, "psql"), ["-h", socketDirectory, "-p", port, "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-q"], { cwd: root, env: { ...process.env, LC_ALL: "C" }, stdio: ["pipe", "pipe", "pipe"] })
    let output = ""
    child.stdout.on("data", chunk => { output += chunk })
    child.stderr.on("data", chunk => { output += chunk })
    child.on("close", status => resolve({ status, output }))
    child.stdin.end(sql)
  })
  const asActor = sql => `begin; set local role authenticated; set local request.jwt.claim.sub='${actor}'; ${sql}; commit;`
  const draftSql = (request, revision) => asActor(`select public.companion_write_assignment('${actor}','${lesson}','race-client','${request}',${revision},'{"mission":"${request}"}',false,false,null,'2026-10-26T00:00:00Z',false)`)
  const different = await Promise.all([executeAsync(draftSql("different-1", 0)), executeAsync(draftSql("different-2", 0))])
  if (different.filter(result => result.status === 0).length !== 1 || !different.some(result => result.output.includes("revision_conflict"))) throw new Error(`Concurrent draft CAS failed: ${JSON.stringify(different)}`)
  const same = await Promise.all([executeAsync(draftSql("same-retry", 1)), executeAsync(draftSql("same-retry", 1))])
  if (same.some(result => result.status !== 0)) throw new Error(`Concurrent idempotency failed: ${JSON.stringify(same)}`)
  const original = '{"name":"Keep","roadmap":{"sections":[{"id":"mission_vision_values","content":"Original"}]}}'
  const docSql = request => asActor(`select public.companion_save_document('${actor}','mission','race-client','${request}',repeat('a',64),'Reviewed','${original}','2026-10-26T00:00:00Z',true)`)
  const documents = await Promise.all([executeAsync(docSql("document-race-1")), executeAsync(docSql("document-race-2"))])
  if (documents.filter(result => result.status === 0).length !== 1 || !documents.some(result => result.output.includes("revision_conflict"))) throw new Error(`Concurrent document CAS failed: ${JSON.stringify(documents)}`)
  // Native app writes to the canonical organization row after a review: the old
  // reviewed profile must not erase its edit, even when the document body matches.
  run("psql", ["-h", socketDirectory, "-p", port, "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-q"], { input: `update public.organizations set profile=jsonb_set(profile,'{name}','"Native edit"'),updated_at=clock_timestamp() where user_id='${actor}';` })
  const stale = await executeAsync(docSql("native-stale-doc"))
  if (stale.status === 0 || !stale.output.includes("revision_conflict")) throw new Error("Native profile change was not protected")
  runSql("supabase/tests/companion-live.concurrent-readback.sql")
  console.log("[companion-live] PostgreSQL auth/RLS, draft separation, replay, native readback, simultaneous draft/document CAS and native-edit preservation passed.")
} finally {
  if (started) {
    spawnSync(join(postgresDirectory, "pg_ctl"), [
      "-D",
      dataDirectory,
      "-m",
      "fast",
      "-w",
      "stop",
    ])
  }
  rmSync(dataDirectory, { force: true, recursive: true })
}
