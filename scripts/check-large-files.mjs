#!/usr/bin/env node
import { execFileSync } from "node:child_process"
import { createHash } from "node:crypto"
import { existsSync, readFileSync, statSync } from "node:fs"
import path from "node:path"

const KB = 1024
const MB = KB * KB
const rootDir = process.cwd()
const duplicatePublicAssetMinBytes = 256 * KB

const defaultBudget = {
  label: "tracked file",
  maxBytes: 512 * KB,
}

const budgets = [
  // Approved November 12: retain the canonical MVP plan and existing October
  // evidence in place. These exact-path allowances remain capped; other plans
  // and monthly logs keep their normal budgets.
  {
    label: "canonical MVP plan with retained history",
    maxBytes: 1700 * KB,
    test: (file) => file === "docs/plans/2026-10-27-particle-system-execution-spec.md",
  },
  {
    label: "preserved October 2026 run log",
    maxBytes: 1400 * KB,
    test: (file) => file === "docs/runlog/2026-10.md",
  },
  {
    label: "run log index",
    maxBytes: 64 * KB,
    test: (file) => file === "docs/RUNLOG.md",
  },
  {
    label: "monthly run log",
    maxBytes: 1 * MB,
    test: (file) => /^docs\/runlog\/\d{4}-\d{2}\.md$/.test(file),
  },
  {
    label: "legacy run log archive",
    maxBytes: 4 * MB,
    test: (file) => file === "docs/runlog/archive/legacy-through-2026-07-14.md",
  },
  {
    label: "pnpm lockfile",
    maxBytes: 600 * KB,
    test: (file) => file === "pnpm-lock.yaml",
  },
  {
    label: "PDF.js worker",
    maxBytes: 1600 * KB,
    test: (file) => file === "public/vendor/pdfjs/pdf.worker.min.js",
  },
  {
    label: "public PDF",
    maxBytes: 1100 * KB,
    test: (file) => /^public\/.*\.pdf$/i.test(file),
  },
  {
    label: "public raster asset",
    maxBytes: 512 * KB,
    test: (file) => /^public\/.*\.(avif|gif|ico|jpe?g|png|webp)$/i.test(file),
  },
  {
    label: "public SVG asset",
    maxBytes: 64 * KB,
    test: (file) => /^public\/.*\.svg$/i.test(file),
  },
  {
    label: "source file",
    maxBytes: 220 * KB,
    test: (file) =>
      /^(app|migrations|scripts|src|supabase|tests)\/.*\.(cjs|js|jsx|mjs|sql|ts|tsx)$/i.test(file),
  },
]

function formatBytes(bytes) {
  if (bytes >= MB) return `${(bytes / MB).toFixed(1)}MB`
  if (bytes >= KB) return `${Math.round(bytes / KB)}KB`
  return `${bytes}B`
}

function getBudget(file) {
  return budgets.find((budget) => budget.test(file)) ?? defaultBudget
}

function trackedFiles() {
  const output = execFileSync("git", ["ls-files", "-z"], { cwd: rootDir, encoding: "utf8" })
  return output.split("\0").filter(Boolean)
}

const oversizedFiles = []
const publicAssetHashes = new Map()
let largestFile = null
let checkedCount = 0

for (const file of trackedFiles()) {
  const absolutePath = path.join(rootDir, file)
  if (!existsSync(absolutePath)) continue

  const stats = statSync(absolutePath)
  if (!stats.isFile()) continue

  checkedCount += 1
  if (!largestFile || stats.size > largestFile.size) {
    largestFile = { file, size: stats.size }
  }

  const budget = getBudget(file)
  if (stats.size > budget.maxBytes) {
    oversizedFiles.push({ budget, file, size: stats.size })
  }

  if (file.startsWith("public/") && stats.size >= duplicatePublicAssetMinBytes) {
    const digest = createHash("sha256").update(readFileSync(absolutePath)).digest("hex")
    const key = `${stats.size}:${digest}`
    const matches = publicAssetHashes.get(key) ?? []
    matches.push(file)
    publicAssetHashes.set(key, matches)
  }
}

const duplicatePublicAssets = [...publicAssetHashes.values()].filter((files) => files.length > 1)

if (oversizedFiles.length > 0 || duplicatePublicAssets.length > 0) {
  console.error("Large-file check failed:")

  for (const { budget, file, size } of oversizedFiles.sort((a, b) => b.size - a.size)) {
    console.error(`- ${file}: ${formatBytes(size)} exceeds ${budget.label} budget ${formatBytes(budget.maxBytes)}`)
  }

  for (const files of duplicatePublicAssets) {
    console.error(`- duplicate public assets over ${formatBytes(duplicatePublicAssetMinBytes)}: ${files.join(", ")}`)
  }

  process.exit(1)
}

const largestLabel = largestFile ? `${largestFile.file} (${formatBytes(largestFile.size)})` : "none"
console.log(`Large-file check passed (${checkedCount} tracked files; largest: ${largestLabel})`)
