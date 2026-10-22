import { execFileSync } from "node:child_process"
import { open, readFile, realpath, stat } from "node:fs/promises"
import { dirname, isAbsolute, relative, resolve, sep } from "node:path"
import type { CoachingTitleBackfillEntry } from "./title-backfill"

const HELP = `Usage: title-backfill-cli --output /absolute/private/preview.json [--limit 100]
Apply: title-backfill-cli --apply --approved /absolute/private/preview.json --output /absolute/private/receipt.json
Dry-run is the default. Output must be a new file outside every repository worktree.
Apply sends calendar update notifications to all guests. No live action occurs with --help.`

export function parseTitleBackfillArgs(args: string[]) {
  const options = { apply: false, output: "", approved: "", limit: 100, help: false }
  const seen = new Set<string>()
  for (let index = 0; index < args.length; index += 1) {
    const flag = args[index]
    if (seen.has(flag)) throw new Error("Duplicate argument.")
    seen.add(flag)
    if (flag === "--help") { options.help = true; continue }
    if (flag === "--apply") { options.apply = true; continue }
    if (!["--output", "--approved", "--limit"].includes(flag)) throw new Error("Unknown argument.")
    const value = args[++index]
    if (!value || value.startsWith("--")) throw new Error("Missing argument value.")
    if (flag === "--output") options.output = value
    if (flag === "--approved") options.approved = value
    if (flag === "--limit") options.limit = Number(value)
  }
  if (options.help) return options
  if (!isAbsolute(options.output)) throw new Error("An absolute private output path is required.")
  if (!Number.isInteger(options.limit) || options.limit < 1 || options.limit > 500) throw new Error("Limit must be 1 through 500.")
  if (options.apply !== Boolean(options.approved) || (options.approved && !isAbsolute(options.approved))) {
    throw new Error("Apply requires an absolute approved dry-run manifest; dry-run cannot accept approval.")
  }
  return options
}

export function parseApprovedTitleManifest(value: unknown): CoachingTitleBackfillEntry[] {
  const manifest = value as { schemaVersion?: unknown; mode?: unknown; entries?: unknown }
  if (!manifest || manifest.schemaVersion !== 1 || manifest.mode !== "dry_run" || !Array.isArray(manifest.entries) || manifest.entries.length > 500) {
    throw new Error("Expected a bounded version 1 dry-run manifest.")
  }
  const ids = new Set<string>()
  return manifest.entries.map((value: unknown) => {
    const entry = value as CoachingTitleBackfillEntry
    if (!entry || typeof entry.bookingId !== "string" || entry.bookingId.length > 128 || ids.has(entry.bookingId)
      || !(entry.googleEventId === null || (typeof entry.googleEventId === "string" && entry.googleEventId.length <= 1024))
      || !["ready", "skipped", "failed"].includes(entry.result)) throw new Error("Invalid or ambiguous dry-run entry.")
    ids.add(entry.bookingId)
    if (entry.result === "ready" && (![entry.etag, entry.previousTitle, entry.proposedTitle].every((text) => typeof text === "string" && text.length > 0 && text.length <= 4096)
      || !/^[a-f0-9]{64}$/.test(entry.protectedDigestBefore ?? ""))) throw new Error("Ready entries require exact title, version and protected-field digest.")
    return entry
  })
}

export async function reservePrivateTitleReceipt(output: string) {
  const parent = await realpath(dirname(output))
  const target = resolve(parent, output.slice(output.lastIndexOf("/") + 1))
  const worktrees = execFileSync("git", ["worktree", "list", "--porcelain"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] })
    .split("\n").filter((line) => line.startsWith("worktree ")).map((line) => line.slice(9))
  for (const tree of worktrees) {
    let treePath: string
    try { treePath = await realpath(tree) } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") continue
      throw error
    }
    const location = relative(treePath, target)
    if (location !== ".." && !location.startsWith(`..${sep}`) && !isAbsolute(location)) throw new Error("Private output must be outside all repository worktrees.")
  }
  return open(target, "wx", 0o600)
}

export async function runTitleBackfillCli(args: string[]) {
  const options = parseTitleBackfillArgs(args)
  if (options.help) { process.stdout.write(`${HELP}\n`); return 0 }
  const receipt = await reservePrivateTitleReceipt(options.output)
  const base = { schemaVersion: 1, mode: options.apply ? "apply" : "dry_run", startedAt: new Date().toISOString() }
  async function save(value: unknown) {
    const payload = JSON.stringify(value, null, 2) + "\n"
    await receipt.truncate(0)
    await receipt.write(payload, 0, "utf8")
    await receipt.sync()
  }
  let latestEntries: CoachingTitleBackfillEntry[] = []
  try {
    await save({ ...base, status: "started", entries: [] })
    let approvedEntries: CoachingTitleBackfillEntry[] = []
    if (options.approved) {
      const info = await stat(options.approved)
      if (!info.isFile() || info.size > 1_000_000) throw new Error("Approved manifest must be a file under 1 MB.")
      approvedEntries = parseApprovedTitleManifest(JSON.parse(await readFile(options.approved, "utf8")))
    }
    const [{ createSupabaseAdminClient }, { runUpcomingCoachingTitleBackfill }] = await Promise.all([
      import("@/lib/supabase/admin"), import("./title-backfill"),
    ])
    const result = await runUpcomingCoachingTitleBackfill({ admin: createSupabaseAdminClient(), apply: options.apply, approvedEntries, limit: options.limit,
      onProgress: async (entries) => {
        latestEntries = entries.map((entry) => ({ ...entry }))
        await save({ ...base, status: "running", entries: latestEntries })
      },
    })
    const counts = Object.fromEntries(["ready", "updated", "skipped", "failed", "verification_failed"].map((status) => [status, result.entries.filter((entry) => entry.result === status).length]))
    const failed = Boolean(counts.failed || counts.verification_failed || result.remaining)
    await save({ ...base, ...result, completedAt: new Date().toISOString(), status: failed ? "partial_failure" : "complete", counts })
    process.stdout.write(`${JSON.stringify({ mode: result.mode, counts, remaining: result.remaining })}\n`)
    return failed ? 1 : 0
  } catch {
    await save({ ...base, status: latestEntries.length ? "partial_failure" : "failed", completedAt: new Date().toISOString(), reason: "operator_setup_or_scan_failed", entries: latestEntries })
    process.stderr.write("Backfill stopped; private failure receipt saved.\n")
    return 1
  } finally {
    await receipt.close()
  }
}

if (typeof require !== "undefined" && require.main === module) {
  void runTitleBackfillCli(process.argv.slice(2)).then((code) => { process.exitCode = code }).catch(() => {
    process.stderr.write("Backfill stopped. Inspect the private receipt and arguments before retrying.\n")
    process.exitCode = 1
  })
}
