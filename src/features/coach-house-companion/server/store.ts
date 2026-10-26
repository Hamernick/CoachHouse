import { randomBytes, randomUUID } from "node:crypto"
import { mkdir, open, readFile, rename, rm, stat } from "node:fs/promises"
import { homedir } from "node:os"
import { join, resolve } from "node:path"
import type { CompanionPrincipal, CompanionSnapshot } from "../types"
import { companionLesson, companionSource } from "../lib/lesson"
import { CompanionError } from "./errors"

export type CompanionSessionRecord = {
  version: 1
  principal: CompanionPrincipal
  revoked: boolean
  snapshot: CompanionSnapshot
  submissionAnswers: Record<string, string> | null
  requests: Record<string, { fingerprint: string; message: string }>
}

const SESSION_ID = /^[a-f0-9]{64}$/
const MAX_FILE_BYTES = 512 * 1024

export function companionSandboxDirectory() {
  return resolve(process.env.COMPANION_SANDBOX_DIR ?? join(homedir(), ".local", "share", "coach-house", "companion-sandbox"))
}

function sessionPath(sessionId: string) {
  if (!SESSION_ID.test(sessionId)) throw new CompanionError("unauthorized", 401, "Invalid sandbox session.")
  return join(companionSandboxDirectory(), `${sessionId}.json`)
}

async function ensureDirectory() {
  await mkdir(companionSandboxDirectory(), { recursive: true, mode: 0o700 })
}

// Exclusive mkdir is shared across Node workers and browser/MCP processes.
// Never steal a lock based on age: a slow owner may still be writing.
async function lockSession(sessionId: string) {
  await ensureDirectory()
  const lockPath = `${sessionPath(sessionId)}.lock`
  const deadline = Date.now() + 1500
  while (true) {
    try {
      await mkdir(lockPath, { mode: 0o700 })
      return async () => { await rm(lockPath, { recursive: true }) }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error
      if (Date.now() >= deadline) throw new CompanionError("store_busy", 503, "This session is busy. Retry the same request shortly.")
      await new Promise((done) => setTimeout(done, 25))
    }
  }
}

async function persist(record: CompanionSessionRecord) {
  const filename = sessionPath(record.principal.sessionId)
  const temporary = `${filename}.${randomBytes(12).toString("hex")}.tmp`
  const body = JSON.stringify(record)
  if (Buffer.byteLength(body) > MAX_FILE_BYTES) throw new CompanionError("session_limit", 429, "This sandbox session reached its storage limit.")
  const handle = await open(temporary, "wx", 0o600)
  try {
    await handle.writeFile(body, "utf8")
    await handle.sync()
  } finally { await handle.close() }
  try {
    await rename(temporary, filename)
    const directory = await open(companionSandboxDirectory(), "r")
    try { await directory.sync() } finally { await directory.close() }
  } finally { await rm(temporary, { force: true }) }
}

async function readRecord(sessionId: string): Promise<CompanionSessionRecord> {
  const filename = sessionPath(sessionId)
  try {
    const metadata = await stat(filename)
    if (!metadata.isFile() || metadata.size > MAX_FILE_BYTES) throw new Error("Invalid session file")
    const record = JSON.parse(await readFile(filename, "utf8")) as CompanionSessionRecord
    if (record.version !== 1 || record.principal?.sessionId !== sessionId || record.snapshot?.mode !== "sandbox" || !record.requests) {
      throw new Error("Invalid session record")
    }
    return record
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") throw new CompanionError("session_not_found", 404, "Sandbox session not found. Start a new session.")
    throw new CompanionError("store_unavailable", 503, "Sandbox storage is unavailable. No change was confirmed.")
  }
}

export function assertCompanionPrincipal(principal: CompanionPrincipal, record: CompanionSessionRecord) {
  if (!Number.isFinite(principal.expiresAt) || principal.expiresAt !== record.principal.expiresAt || principal.organizationId !== record.principal.organizationId) {
    throw new CompanionError("unauthorized", 401, "The sandbox session credential does not match.")
  }
  if (record.revoked) throw new CompanionError("session_revoked", 401, "This sandbox session has been disconnected.")
  if (record.principal.expiresAt <= Date.now()) throw new CompanionError("session_expired", 401, "This sandbox session expired. Start a new session.")
}

export async function withCompanionSession<T>(principal: CompanionPrincipal, operation: (record: CompanionSessionRecord) => T, write: boolean): Promise<T> {
  if (!principal || typeof principal.sessionId !== "string") throw new CompanionError("unauthorized", 401, "A sandbox session is required.")
  const release = await lockSession(principal.sessionId)
  try {
    const record = await readRecord(principal.sessionId)
    assertCompanionPrincipal(principal, record)
    const result = operation(record)
    if (write) await persist(record)
    return result
  } finally { await release() }
}

export async function createCompanionSession(): Promise<{ principal: CompanionPrincipal; snapshot: CompanionSnapshot }> {
  const principal = {
    sessionId: randomBytes(32).toString("hex"),
    organizationId: `sandbox-${randomUUID()}`,
    expiresAt: Date.now() + 24 * 60 * 60 * 1000,
  }
  const snapshot: CompanionSnapshot = {
    mode: "sandbox",
    organization: { id: principal.organizationId, name: "Your practice organization" },
    lesson: structuredClone(companionLesson), source: { ...companionSource },
    draft: { answers: {}, revision: 0, updatedAt: null },
    document: { id: randomUUID(), title: "Mission statement", content: "", revision: 0, visibility: "sandbox" },
    submission: { status: "not_submitted", completed: false, submittedAt: null },
    calendar: { capability: "export", event: null }, receipts: [],
  }
  const release = await lockSession(principal.sessionId)
  try {
    await persist({ version: 1, principal, revoked: false, snapshot, submissionAnswers: null, requests: {} })
  } finally { await release() }
  return { principal, snapshot }
}

export async function revokeCompanionSession(principal: CompanionPrincipal): Promise<void> {
  await withCompanionSession(principal, (record) => { record.revoked = true }, true)
}
