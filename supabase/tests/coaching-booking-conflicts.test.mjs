#!/usr/bin/env node
import assert from "node:assert/strict"
import { execFileSync, spawn, spawnSync } from "node:child_process"
import { accessSync, constants, mkdtempSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

// No connection URL is accepted: every assertion runs against this disposable
// cluster, loading the real migrations and racing independent psql connections.
const root = process.cwd()
const pg = process.env.POSTGRES_BINDIR?.trim() || execFileSync("pg_config", ["--bindir"], { encoding: "utf8" }).trim()
for (const name of ["initdb", "pg_ctl", "postgres", "psql"]) accessSync(join(pg, name), constants.X_OK)
const directory = mkdtempSync(join(tmpdir(), "ch-coaching-conflicts-"))
const data = join(directory, "data")
const port = String(56_000 + process.pid % 5_000)
const args = ["-h", directory, "-p", port, "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-Atq"]
const user = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`
const day = (n) => `2099-01-${String(n).padStart(2, "0")}T12:00:00Z`
function run(name, options, input) {
  const result = spawnSync(join(pg, name), options, { cwd: root, encoding: "utf8", input, timeout: 30_000, env: { ...process.env, LC_ALL: "C" } })
  if (result.status !== 0) throw new Error(`${name}: ${result.stderr || result.error}`)
  return result.stdout.trim()
}
function sql(query, onOutput) {
  return new Promise((resolve, reject) => {
    const child = spawn(join(pg, "psql"), args, { cwd: root })
    let out = "", err = ""
    const timer = setTimeout(() => { child.kill("SIGKILL"); reject(new Error("PostgreSQL assertion timed out")) }, 15_000)
    child.stdout.on("data", (chunk) => { out += chunk; onOutput?.(out) })
    child.stderr.on("data", (chunk) => { err += chunk })
    child.on("error", (error) => { clearTimeout(timer); reject(error) })
    child.on("close", (code) => {
      clearTimeout(timer)
      if (code === 0) resolve(out.trim())
      else reject(new Error(err))
    })
    child.stdin.end(`\\set VERBOSITY verbose\nset statement_timeout='10s';\n${query}`)
  })
}
const insert = (id, date, { owner = 1, coach = "joel", status = "held", expiry = "now()+interval '15 minutes'", tier = "included", checkout = "null" } = {}) =>
  `insert into coaching_bookings(id,org_id,user_id,coach_id,status,price_tier,starts_at,ends_at,hold_expires_at,stripe_checkout_session_id) values('${user(id)}','${user(owner)}','${user(owner)}','${coach}','${status}','${tier}','${date}','${date}'::timestamptz+interval '45 minutes',${expiry},${checkout});`
const confirm = (id, checkout = "null") => `select confirm_coaching_credit_booking('${user(id)}',${checkout},null,null);`
async function rejects(query, expression) {
  await assert.rejects(sql(query), expression)
}
// Keep the first transaction open after its mutation. The other connection
// must wait on the real advisory lock and then re-evaluate the committed row.
async function race(first, second, expected = /23P01/) {
  let ready
  const barrier = new Promise((resolve) => { ready = resolve })
  const winner = sql(`begin; ${first} select 'mutation-ready'; select pg_sleep(0.4); commit;`, (out) => {
    if (out.includes("mutation-ready")) ready()
  })
  await Promise.race([barrier, winner.then(() => { throw new Error("Race completed before readiness marker") })])
  const loser = sql(second)
  const results = await Promise.allSettled([winner, loser])
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1, "Exactly one overlapping transaction succeeds")
  const failure = results.find((r) => r.status === "rejected")
  assert.match(failure.reason.message, expected, "Loser fails because the slot is occupied")
}

let started = false
try {
  run("initdb", ["-D", data, "-A", "trust", "-U", "postgres"])
  run("pg_ctl", ["-D", data, "-o", `-F -h '' -k ${directory} -p ${port}`, "-l", join(directory, "postgres.log"), "-w", "start"])
  started = true
  for (const file of [
    "supabase/tests/coaching-booking-conflicts.bootstrap.sql",
    "supabase/migrations/20260517193000_add_coaching_booking.sql",
    "supabase/migrations/20260529152500_add_coaching_booking_attendee_notes.sql",
    "supabase/migrations/20260930120000_personal_coaching_credits.sql",
    "supabase/migrations/20260930121000_coaching_booking_policy.sql",
    "supabase/migrations/20261022010000_coaching_booking_conflicts.sql",
  ]) {
    if (process.argv.includes("--without-fix") && file.endsWith("20261022010000_coaching_booking_conflicts.sql")) continue
    run("psql", args, readFileSync(join(root, file), "utf8"))
  }
  // A second application must be safe for deploy retries.
  if (!process.argv.includes("--without-fix")) run("psql", args, readFileSync(join(root, "supabase/migrations/20261022010000_coaching_booking_conflicts.sql"), "utf8"))
  await sql(`select issue_coaching_credits('${user(1)}','${user(1)}',20,'courtesy','Test credits','Disposable regression fixture',null,null,'test-1');`)
  await sql(`select issue_coaching_credits('${user(2)}','${user(2)}',20,'courtesy','Test credits','Disposable regression fixture',null,null,'test-2');`)

  await race(insert(101, day(1)), insert(102, day(1), { owner: 2, coach: "paula" }))
  assert.equal(await sql(`select count(*) from coaching_bookings where starts_at='${day(1)}';`), "1")
  await sql(insert(103, day(1).replace("12:00", "12:45"), { owner: 2 }))
  await sql(`update coaching_bookings set starts_at=starts_at,hold_expires_at=hold_expires_at where id='${user(101)}';`)
  await sql(insert(104, day(2), { expiry: "now()-interval '1 minute'" }))
  await sql(insert(105, day(2), { owner: 2, status: "pending_payment" }))
  await rejects(insert(106, day(2)), /23P01/)
  await sql(insert(107, day(3), { expiry: "null" }))
  await rejects(insert(108, day(3), { owner: 2 }), /23P01/)

  // Two expired legacy holds can coexist. Their confirmations serialize, and
  // the rejected confirmation cannot spend a credit or enqueue a second event.
  await sql(insert(111, day(4), { expiry: "now()-interval '1 minute'" }) + insert(112, day(4), { owner: 2, expiry: "now()-interval '1 minute'" }))
  await race(confirm(111), confirm(112), /23P01|P0001: That slot was just taken/)
  assert.equal(await sql(`select count(*) from coaching_bookings where starts_at='${day(4)}' and status='confirmed' and calendar_pending_action='create';`), "1")
  assert.equal(await sql(`select count(*) from coaching_credit_ledger where booking_id in('${user(111)}','${user(112)}') and source='booking';`), "1")
  await sql(confirm(111) + confirm(111))
  assert.equal(await sql(`select count(*) from coaching_credit_ledger where booking_id='${user(111)}' and source='booking';`), "1")
  await rejects(confirm(104), /23P01/)
  assert.equal(await sql(`select count(*) from coaching_credit_ledger where booking_id='${user(104)}';`), "0")

  await sql(insert(121, day(5), { tier: "full", checkout: "'checkout-test'" }))
  await rejects(confirm(121, "'wrong-checkout'"), /Payment does not match booking/)
  await sql(confirm(121, "'checkout-test'") + confirm(121, "'checkout-test'"))
  assert.equal(await sql(`select count(*) from coaching_credit_grants where request_key='checkout:checkout-test';`), "1")
  assert.equal(await sql(`select count(*) from coaching_credit_ledger where booking_id='${user(121)}' and source='booking';`), "1")
  // Simulate completed provider delivery before exercising the real reschedule
  // RPC; a pending Calendar create has its own independent guard.
  await sql(`update coaching_bookings set calendar_pending_action=null where id='${user(111)}';`)
  await rejects(`select manage_coaching_credit_booking('${user(111)}','${user(1)}','reschedule',false,'Test overlap','${day(2)}','UTC','${user(130)}');`, /23P01|That slot was just taken/)
  assert.equal(await sql(`select starts_at='${day(4)}'::timestamptz from coaching_bookings where id='${user(111)}';`), "t")

  const member = `set role authenticated; select set_config('request.jwt.claim.sub','${user(2)}',false);`
  assert.equal((await sql(`${member} select count(*) from coaching_bookings where user_id='${user(1)}';`)).split("\n").at(-1), "0", "RLS hides unrelated bookings")
  await rejects(`${member} ${insert(141, day(6), { owner: 2 })}`, /42501|permission denied/)
  await rejects(`${member} ${confirm(121, "'checkout-test'")}`, /42501|permission denied/)
  await rejects(`set role anon; ${confirm(121, "'checkout-test'")}`, /42501|permission denied/)
  await sql(`set role service_role; ${insert(142, day(6), { owner: 2 })}`)
  console.log("[coaching-conflicts] Real two-session reservation/confirmation races, half-open boundaries, expiry, self-exclusion, debit/payment idempotency, reschedule rollback and RLS denial passed.")
} finally {
  if (started) spawnSync(join(pg, "pg_ctl"), ["-D", data, "-m", "fast", "-w", "stop"], { timeout: 15_000 })
  rmSync(directory, { recursive: true, force: true })
}
