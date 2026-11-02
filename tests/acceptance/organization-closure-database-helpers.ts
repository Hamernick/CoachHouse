import type { spawn as spawnProcess, ChildProcessWithoutNullStreams } from "node:child_process"
import { expect } from "vitest"

// Provision the chosen organization-closure fixture explicitly. No app secrets.
export const databaseUrl = process.env.ORGANIZATION_CLOSURE_TEST_DATABASE_URL
export function createClosureDatabaseHarness(spawn: typeof spawnProcess) {
  const clients = new Set<ChildProcessWithoutNullStreams>()
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
    return async (beforeCommit = "") => {
      session.child.stdin.end(`${beforeCommit}; commit;\n`)
      const result = await session.completion
      expect(result.code, result.stderr).toBe(0)
    }
  }
  async function blocked(sql: string) {
    const result = await query(`set lock_timeout='150ms'; ${sql};`)
    expect(result.code).not.toBe(0)
    expect(result.stderr).toContain("lock timeout")
  }

  async function queued(sql: string) {
    const session = client()
    session.child.stdin.end(`set application_name='closure-publication-waiter'; ${sql};\n`)
    // One bounded wait, then independently prove the statement is lock-blocked.
    await query("select pg_sleep(0.1)")
    const waiting = await query("select wait_event_type from pg_stat_activity where application_name='closure-publication-waiter' and datname=current_database()")
    expect(waiting.stdout.trim()).toBe("Lock")
    return { result: session.completion }
  }

  return { clients, query, hold, blocked, queued }
}
