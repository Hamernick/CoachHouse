#!/usr/bin/env node

import { spawn } from "node:child_process"
import { existsSync } from "node:fs"
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = process.cwd()
const DEFAULT_ARTIFACT_DIRECTORY = path.join(ROOT, "test-results/quality-gate")

const STATIC_STAGES = [
  "check:npm-supply-chain",
  "check:large-files",
  "lint",
  "check:structure",
  "check:routes",
  "check:features",
  "check:feature-scaffold",
  "check:thresholds",
  "check:boundaries",
  "check:deprecated-imports",
  "check:workspace-storage",
  "check:interaction-locks",
  "check:react-grab",
  "check:workspace-surfaces",
  "check:raw-buttons",
  "test:snapshots",
]

export const QUALITY_GATE_PROFILES = Object.freeze({
  full: Object.freeze([
    ...STATIC_STAGES,
    "test:acceptance",
    "test:rls",
    "build",
    "test:visual",
    "check:perf",
  ]),
  prepush: Object.freeze([
    "check:npm-supply-chain",
    "check:large-files",
    "lint:push",
  ]),
  static: Object.freeze([...STATIC_STAGES]),
  acceptance: Object.freeze(["test:acceptance"]),
  rls: Object.freeze(["test:rls"]),
  build: Object.freeze(["build", "check:perf"]),
  visual: Object.freeze(["test:visual"]),
})

function formatDuration(durationMs) {
  if (durationMs < 1_000) return `${durationMs}ms`
  return `${(durationMs / 1_000).toFixed(2)}s`
}

async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const absolutePath = path.join(directory, entry.name)
      if (entry.isDirectory()) return listFiles(absolutePath)
      return absolutePath
    })
  )
  return nested.flat()
}

export async function collectAcceptanceInventory(
  acceptanceDirectory = path.join(ROOT, "tests/acceptance")
) {
  const files = (await listFiles(acceptanceDirectory)).filter((file) =>
    file.endsWith(".test.ts")
  )
  let childProcessCallCount = 0
  let childProcessFileCount = 0
  let sourceReadingFileCount = 0
  let testDeclarationCount = 0

  await Promise.all(
    files.map(async (file) => {
      const source = await readFile(file, "utf8")
      if (source.includes("node:child_process")) childProcessFileCount += 1
      if (/\b(?:readFile|readFileSync)\s*\(/.test(source)) {
        sourceReadingFileCount += 1
      }
      childProcessCallCount += (
        source.match(
          /\b(?:execFile|execFileSync|execSync|spawn|spawnSync)\s*\(/g
        ) ?? []
      ).length
      testDeclarationCount += (
        source.match(/\b(?:it|test)(?:\.(?:each|only|skip|todo))?\s*\(/g) ?? []
      ).length
    })
  )

  return {
    childProcessCallCount,
    childProcessFileCount,
    fileCount: files.length,
    sourceReadingFileCount,
    testDeclarationCount,
  }
}

function resolvePnpmInvocation() {
  const npmExecPath = process.env.npm_execpath?.trim()
  if (npmExecPath && existsSync(npmExecPath)) {
    return { command: process.execPath, prefixArgs: [npmExecPath] }
  }

  return {
    command: process.platform === "win32" ? "pnpm.cmd" : "pnpm",
    prefixArgs: [],
  }
}

export function executePnpmScript(script) {
  const { command, prefixArgs } = resolvePnpmInvocation()
  return new Promise((resolve) => {
    const child = spawn(command, [...prefixArgs, script], {
      cwd: ROOT,
      env: process.env,
      stdio: "inherit",
    })

    child.once("error", (error) => {
      console.error(`[quality] unable to start ${script}: ${error.message}`)
      resolve(1)
    })
    child.once("exit", (code, signal) => {
      if (signal) {
        console.error(`[quality] ${script} terminated by ${signal}`)
      }
      resolve(code ?? 1)
    })
  })
}

/**
 * @param {{ artifactDirectory?: string, executeStage?: (script: string) => Promise<number>, profileName?: string }} [options]
 */
export async function runQualityGate({
  artifactDirectory = process.env.QUALITY_GATE_ARTIFACT_DIR?.trim() ||
    DEFAULT_ARTIFACT_DIRECTORY,
  executeStage = executePnpmScript,
  profileName,
} = {}) {
  const scripts = QUALITY_GATE_PROFILES[profileName]
  if (!scripts) {
    throw new Error(
      `Unknown quality profile '${profileName ?? ""}'. Expected one of: ${Object.keys(
        QUALITY_GATE_PROFILES
      ).join(", ")}`
    )
  }

  const startedAt = new Date()
  const startedAtMs = Date.now()
  const stages = []
  let failedStage = null

  console.log(
    `[quality] profile ${profileName}: ${scripts.length} stage${scripts.length === 1 ? "" : "s"}`
  )

  for (const script of scripts) {
    const stageStartedAt = new Date()
    const stageStartedAtMs = Date.now()
    console.log(`[quality] start ${script}`)
    const exitCode = await executeStage(script)
    const durationMs = Date.now() - stageStartedAtMs
    const status = exitCode === 0 ? "passed" : "failed"
    stages.push({
      durationMs,
      exitCode,
      finishedAt: new Date().toISOString(),
      script,
      startedAt: stageStartedAt.toISOString(),
      status,
    })
    console.log(`[quality] ${status} ${script} (${formatDuration(durationMs)})`)

    if (exitCode !== 0) {
      failedStage = script
      break
    }
  }

  const finishedAt = new Date()
  const status = failedStage ? "failed" : "passed"
  const includesAcceptance = scripts.includes("test:acceptance")
  const summary = {
    acceptanceInventory: includesAcceptance
      ? await collectAcceptanceInventory()
      : null,
    durationMs: Date.now() - startedAtMs,
    failedStage,
    finishedAt: finishedAt.toISOString(),
    profile: profileName,
    schemaVersion: 1,
    stages,
    startedAt: startedAt.toISOString(),
    status,
  }

  await mkdir(artifactDirectory, { recursive: true })
  const artifactPath = path.join(artifactDirectory, `${profileName}.json`)
  await writeFile(artifactPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8")

  console.log(
    `[quality] ${profileName} ${status} in ${formatDuration(summary.durationMs)}`
  )
  console.log(`[quality] timing artifact ${path.relative(ROOT, artifactPath)}`)
  return summary
}

async function main() {
  if (process.argv[2] === "--list") {
    console.log(JSON.stringify(QUALITY_GATE_PROFILES, null, 2))
    return
  }

  const profileName = process.argv[2] ?? "full"
  try {
    const summary = await runQualityGate({ profileName })
    if (summary.status !== "passed") process.exitCode = 1
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  }
}

const entryPath = process.argv[1] ? path.resolve(process.argv[1]) : null
if (entryPath === fileURLToPath(import.meta.url)) {
  await main()
}
