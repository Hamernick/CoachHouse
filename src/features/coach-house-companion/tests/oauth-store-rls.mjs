import assert from "node:assert/strict"
import { execFileSync, spawn, spawnSync } from "node:child_process"
import { mkdtempSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"

// Intentionally accepts no database URL: this can only use a disposable cluster.
const pg = process.env.POSTGRES_BINDIR?.trim() || execFileSync("pg_config", ["--bindir"], { encoding: "utf8" }).trim()
const directory = mkdtempSync(path.join(tmpdir(), "ch-companion-oauth-"))
const data = path.join(directory, "data")
const port = String(56000 + process.pid % 5000)
const args = ["-h", directory, "-p", port, "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-Atq"]
function run(command, argv, input) {
  const result = spawnSync(path.join(pg, command), argv, { encoding: "utf8", input, timeout: 30000, env: { ...process.env, LC_ALL: "C" } })
  if (result.status !== 0) throw new Error(result.stderr || String(result.error))
  return result.stdout.trim()
}
const sql = query => run("psql", args, query)
const service = query => sql(`set role service_role; set request.jwt.claim.role='service_role'; ${query}`)
const hash = n => n.toString(16).padStart(64, "0")
const actor = "11111111-1111-4111-8111-111111111111"
const invoke = (action, key, payload = {}) => `select public.companion_oauth_store('${action}','${key}','${JSON.stringify(payload).replaceAll("'", "''")}'::jsonb);`
const call = (action, key, payload = {}) => {
  const result = service(invoke(action, key, payload))
  return result ? JSON.parse(result) : null
}
function createGrant(n, scopes = ["accelerator:read", "accelerator:write"]) {
  return call("create_grant", hash(n), { userId: actor, clientId: "chatgpt-test", resource: "https://companion.example.org/api/companion/mcp", scopes,
    upstream: "encrypted-upstream-fixture", challenge: "pkce-fixture", redirectUri: "https://chatgpt.com/connector/oauth/test" })
}
function exchange(n, access = n + 1, refresh = n + 2, extra = {}) {
  return call("exchange_code", hash(n), { clientId: "chatgpt-test", resource: "https://companion.example.org/api/companion/mcp",
    challenge: "pkce-fixture", redirectUri: "https://chatgpt.com/connector/oauth/test", accessHash: hash(access), refreshHash: hash(refresh), ...extra })
}
function rotate(n, access, refresh, extra = {}) {
  return call("rotate_refresh", hash(n), { clientId: "chatgpt-test", resource: "https://companion.example.org/api/companion/mcp", accessHash: hash(access), refreshHash: hash(refresh), ...extra })
}
function concurrent(query) {
  return new Promise((resolve, reject) => {
    const child = spawn(path.join(pg, "psql"), args, { env: { ...process.env, LC_ALL: "C" } })
    let out = "", err = ""
    const timer = setTimeout(() => { child.kill("SIGKILL"); reject(new Error("SQL race timed out")) }, 15000)
    child.stdout.on("data", value => { out += value })
    child.stderr.on("data", value => { err += value })
    child.on("error", error => { clearTimeout(timer); reject(error) })
    child.on("close", code => { clearTimeout(timer); code === 0 ? resolve(JSON.parse(out.trim())) : reject(new Error(err)) })
    child.stdin.end(`set statement_timeout='10s'; set role service_role; set request.jwt.claim.role='service_role'; ${query}`)
  })
}

let started = false
try {
  run("initdb", ["-D", data, "-A", "trust", "-U", "postgres"])
  run("pg_ctl", ["-D", data, "-o", `-F -h '' -k ${directory} -p ${port}`, "-l", path.join(directory, "postgres.log"), "-w", "start"])
  started = true
  sql(`create role anon; create role authenticated; create role service_role;
    create schema auth; create table auth.users(id uuid primary key);
    create function auth.role() returns text language sql stable as 'select current_setting(''request.jwt.claim.role'', true)';
    insert into auth.users values('${actor}');`)
  sql(readFileSync("supabase/migrations/20261026150000_companion_oauth.sql", "utf8"))
  for (const role of ["anon", "authenticated"]) {
    assert.throws(() => sql(`set role ${role}; select * from public.companion_oauth_grants;`), /permission denied/)
    assert.throws(() => sql(`set role ${role}; ${invoke("access", hash(1))}`), /permission denied/)
  }
  assert.equal(sql("select count(*) from pg_class where relname like 'companion_oauth_%' and relkind='r' and relrowsecurity;"), "4")
  call("create_transaction", hash(1), { request: { verifier: "encrypted-fixture", nonceHash: hash(2) }, fingerprint: hash(3) })
  assert.deepEqual(call("read_transaction", hash(1)), { verifier: "encrypted-fixture", nonceHash: hash(2) })
  assert.ok(call("consume_transaction", hash(1)))
  assert.equal(call("consume_transaction", hash(1)), null)
  call("create_transaction", hash(4), { request: {}, fingerprint: hash(5) })
  sql(`update public.companion_oauth_transactions set expires_at=now()-interval '1 second' where state_hash='${hash(4)}';`)
  assert.equal(call("read_transaction", hash(4)), null)
  for (let n = 10; n < 40; n++) assert.equal(call("create_transaction", hash(n), { request: {}, fingerprint: hash(6) }).ok, true)
  assert.equal(call("create_transaction", hash(40), { request: {}, fingerprint: hash(6) }).error, "rate_limited")

  createGrant(100)
  assert.equal(exchange(100, 101, 102, { redirectUri: "https://attacker.example" }).error, "invalid_grant")
  assert.equal(exchange(100, 101, 102, { challenge: "wrong-proof" }).error, "invalid_grant")
  assert.equal(exchange(100, 101, 102, { clientId: "other-client" }).error, "invalid_grant")
  assert.equal(exchange(100, 101, 102, { resource: "https://other.example" }).error, "invalid_grant")
  assert.equal(exchange(100).userId, actor)
  assert.equal(call("access", hash(101)).userId, actor)
  assert.equal(call("access", hash(102)), null)
  assert.equal(exchange(100, 103, 104).error, "invalid_grant")
  assert.equal(call("access", hash(101)), null, "Replayed authorization code revokes its grant")

  createGrant(200)
  exchange(200)
  assert.equal(rotate(202, 203, 204).rotation, 1)
  assert.equal(call("access", hash(203)).userId, actor)
  assert.equal(rotate(202, 205, 206).error, "invalid_grant")
  assert.equal(call("access", hash(203)), null, "Replayed refresh revokes all family access")
  createGrant(300, ["accelerator:read"])
  exchange(300)
  assert.equal(rotate(302, 303, 304, { scopes: ["accelerator:read", "accelerator:write"] }).error, "invalid_scope")
  assert.equal(rotate(302, 303, 304, { scopes: ["accelerator:read"] }).scopes.join(" "), "accelerator:read")
  call("revoke", hash(303), { clientId: "other-client" })
  assert.ok(call("access", hash(303)), "Other client cannot revoke grant")
  call("revoke", hash(304), { clientId: "chatgpt-test" })
  assert.equal(call("access", hash(303)), null)

  createGrant(400)
  exchange(400)
  sql(`update public.companion_oauth_tokens set expires_at=now()-interval '1 second' where token_hash='${hash(401)}';`)
  assert.equal(call("access", hash(401)), null)
  createGrant(500)
  const payload = { clientId: "chatgpt-test", resource: "https://companion.example.org/api/companion/mcp", challenge: "pkce-fixture", redirectUri: "https://chatgpt.com/connector/oauth/test" }
  const raced = await Promise.all([
    concurrent(invoke("exchange_code", hash(500), { ...payload, accessHash: hash(501), refreshHash: hash(502) })),
    concurrent(invoke("exchange_code", hash(500), { ...payload, accessHash: hash(503), refreshHash: hash(504) })),
  ])
  assert.equal(raced.filter(result => result.error === "invalid_grant").length, 1)
  assert.equal(raced.filter(result => result.userId === actor).length, 1)
  assert.equal(sql(`select count(*) from public.companion_oauth_tokens where token_hash in ('${hash(501)}','${hash(502)}','${hash(503)}','${hash(504)}');`), "2")
  assert.equal(call("access", hash(501)), null)
  assert.equal(call("access", hash(503)), null)
  console.log("PASS: OAuth store RLS/ACL, expiry, request bounds, exact code binding, one-time transactions, code/refresh replay revocation, scope restriction, explicit revoke and concurrent code exchange")
} finally {
  if (started) run("pg_ctl", ["-D", data, "-m", "immediate", "-w", "stop"])
  rmSync(directory, { recursive: true, force: true })
}
