import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process"
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest"

// Provision account-organization-boundary-fixture.sql explicitly. No app secrets.
const databaseUrl = process.env.ACCOUNT_BOUNDARY_TEST_DATABASE_URL
const clients = new Set<ChildProcessWithoutNullStreams>()
const actor = "10000000-0000-4000-8000-000000000011"
function client() {
  if (!databaseUrl) throw new Error("Explicit local fixture required")
  const url = new URL(databaseUrl)
  if (!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
    || !/^\/workspace_sharing_fixture_[a-z0-9_]+$/.test(url.pathname) || url.password)
    throw new Error("Only a disposable local fixture without credentials is allowed")
  const child = spawn("psql", ["--no-psqlrc", "-qAt", "-v", "ON_ERROR_STOP=1", "-d", databaseUrl], {
    env: { ...process.env, PGOPTIONS: "-c statement_timeout=5000 -c coach_house.workspace_sharing_fixture=isolated-test-only" },
  })
  clients.add(child)
  let stdout = "", stderr = ""
  const completion = new Promise<{ code: number | null; stdout: string; stderr: string }>((resolve, reject) => {
    child.stdout.on("data", (chunk) => { stdout += chunk.toString() })
    child.stderr.on("data", (chunk) => { stderr += chunk.toString() })
    child.on("error", reject)
    child.on("close", (code) => { clients.delete(child); resolve({ code, stdout, stderr }) })
  })
  return { child, completion }
}
function query(sql: string) {
  const session = client()
  session.child.stdin.end(sql + "\n")
  return session.completion
}
async function hold(sql: string) {
  const session = client()
  await new Promise<void>((resolve, reject) => {
    let output = ""
    session.child.stdout.on("data", (chunk) => {
      output += chunk.toString()
      if (output.includes("__LOCKED__")) resolve()
    })
    session.completion.then((result) => reject(new Error(result.stderr || "Lock ended early")), reject)
    session.child.stdin.write(`begin; ${sql}; select '__LOCKED__';\n`)
  })
  return async () => {
    session.child.stdin.end("commit;\n")
    const result = await session.completion
    expect(result.code, result.stderr).toBe(0)
  }
}
async function blocked(sql: string) {
  const result = await query(`set lock_timeout='150ms'; ${sql};`)
  expect(result.code).not.toBe(0)
  expect(result.stderr).toContain("lock timeout")
}

describe.skipIf(!databaseUrl)("organization owner deletion database boundary", () => {
  beforeAll(async () => {
    expect((await query("select confdeltype from pg_constraint where conrelid='public.organizations'::regclass and conname='organizations_user_id_fkey'")).stdout.trim()).toBe("r")
  })
  beforeEach(async () => {
    const result = await query(`delete from public.organizations where user_id='${actor}'; insert into auth.users(id) values('${actor}') on conflict do nothing;`)
    expect(result.code, result.stderr).toBe(0)
  })
  afterEach(() => { for (const child of clients) child.kill("SIGTERM") })
  it("prevents a login delete from racing past a newly created organization", async () => {
    const release = await hold(`insert into public.organizations(user_id) values('${actor}')`)
    await blocked(`delete from auth.users where id='${actor}'`)
    await release()
    const denied = await query(`delete from auth.users where id='${actor}'`)
    expect(denied.code).not.toBe(0)
    expect(denied.stderr).toContain("organizations_user_id_fkey")
    expect((await query(`select count(*) from public.organizations o join auth.users u on u.id=o.user_id where u.id='${actor}'`)).stdout.trim()).toBe("1")
  })
  it("prevents creation from restoring an organization whose login deletion won", async () => {
    const release = await hold(`delete from auth.users where id='${actor}'`)
    await blocked(`insert into public.organizations(user_id) values('${actor}')`)
    await release()
    const denied = await query(`insert into public.organizations(user_id) values('${actor}')`)
    expect(denied.code).not.toBe(0)
    expect(denied.stderr).toContain("organizations_user_id_fkey")
    expect((await query(`select count(*) from public.organizations where user_id='${actor}'`)).stdout.trim()).toBe("0")
  })
  it("organization removal preserves the owner's login and the other organization", async () => {
    const result = await query(`insert into public.organizations(user_id) values('${actor}'); delete from public.organizations where user_id='${actor}'; select count(*) from auth.users where id='${actor}'; select count(*) from public.organizations where user_id='10000000-0000-4000-8000-000000000002';`)
    expect(result.code, result.stderr).toBe(0)
    expect(result.stdout.trim().split("\n")).toEqual(["1", "1"])
  })
})
