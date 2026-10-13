#!/usr/bin/env node

import { promises as fs } from "node:fs"
import path from "node:path"
import * as ts from "typescript"

const ROOT = process.cwd()
const APP_ROOT = path.join(ROOT, "src", "app")
const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx"])

const ROUTE_ENTRY_PATTERN = /(page|layout|template|loading|error|not-found)\.tsx$/u
const PAGE_LAYOUT_BUDGET = 280
const PAGE_LAYOUT_WARNING_THRESHOLD = 0.9
const PAGE_LAYOUT_BUDGET_ALLOWLIST = new Set()
const PAGE_LAYOUT_BUDGET_ALLOWLIST_MAX = 0
const ROUTE_IMPORT_CONTRACTS = new Map([
  [
    "src/app/(public)/resources/page.tsx",
    {
      requireImports: ["@/components/public/home-resource-explorer"],
      forbidImports: ["@/components/public/public-header"],
      requireSourcePatterns: [/<PublicHomeResourceExplorer\b/u],
    },
  ],
  [
    "src/app/(public)/map/page.tsx",
    {
      requireImports: ["next/navigation", "@/lib/find/routes"],
      requireSourcePatterns: [/permanentRedirect\b/u],
    },
  ],
  [
    "src/app/(public)/find/page.tsx",
    {
      requireImports: ["next/navigation", "@/lib/find/routes"],
      requireSourcePatterns: [/permanentRedirect\b/u],
    },
  ],
])

function toRepoRelative(absolutePath) {
  return path.relative(ROOT, absolutePath).split(path.sep).join("/")
}

function resolveScriptKind(extension) {
  switch (extension) {
    case ".ts":
      return ts.ScriptKind.TS
    case ".tsx":
      return ts.ScriptKind.TSX
    case ".js":
      return ts.ScriptKind.JS
    case ".jsx":
      return ts.ScriptKind.JSX
    default:
      return ts.ScriptKind.Unknown
  }
}

async function walkFiles(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true })
  const files = []

  for (const entry of entries) {
    const next = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...(await walkFiles(next)))
      continue
    }
    files.push(next)
  }

  return files
}

function collectModuleSpecifiers(sourceFile) {
  const specifiers = []

  function visit(node) {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      specifiers.push(node.moduleSpecifier.text)
    }

    if (ts.isExportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      specifiers.push(node.moduleSpecifier.text)
    }

    ts.forEachChild(node, visit)
  }

  visit(sourceFile)
  return specifiers
}

function validateRouteImportContract({ relativePath, sourceText, specifiers, errors }) {
  const contract = ROUTE_IMPORT_CONTRACTS.get(relativePath)
  if (!contract) return

  for (const requiredImport of contract.requireImports ?? []) {
    if (!specifiers.includes(requiredImport)) {
      errors.push(`Route contract requires import '${requiredImport}': ${relativePath}`)
    }
  }

  for (const forbiddenImport of contract.forbidImports ?? []) {
    if (specifiers.includes(forbiddenImport)) {
      errors.push(`Route contract forbids import '${forbiddenImport}': ${relativePath}`)
    }
  }

  for (const pattern of contract.requireSourcePatterns ?? []) {
    if (!pattern.test(sourceText)) {
      errors.push(`Route contract requires source pattern '${pattern}': ${relativePath}`)
    }
  }
}

async function countLines(absolutePath) {
  const text = await fs.readFile(absolutePath, "utf8")
  if (text.length === 0) return 0
  return text.split(/\r?\n/u).length
}

async function main() {
  const appExists = await fs.stat(APP_ROOT).catch(() => null)
  if (!appExists || !appExists.isDirectory()) {
    console.log("Route entry contract check passed (src/app not found).")
    return
  }

  const files = await walkFiles(APP_ROOT)
  const errors = []
  const warnings = []

  if (PAGE_LAYOUT_BUDGET_ALLOWLIST.size > PAGE_LAYOUT_BUDGET_ALLOWLIST_MAX) {
    errors.push(
      `Route page/layout allowlist exceeds max (${PAGE_LAYOUT_BUDGET_ALLOWLIST_MAX}). Remove temporary exceptions before merge.`,
    )
  }

  for (const absolutePath of files) {
    const relativePath = toRepoRelative(absolutePath)
    const extension = path.extname(relativePath)
    if (!SOURCE_EXTENSIONS.has(extension)) continue
    if (!ROUTE_ENTRY_PATTERN.test(relativePath)) continue

    const sourceText = await fs.readFile(absolutePath, "utf8")
    const sourceFile = ts.createSourceFile(
      relativePath,
      sourceText,
      ts.ScriptTarget.Latest,
      true,
      resolveScriptKind(extension),
    )

    const isPageOrLayout = relativePath.endsWith("/page.tsx") || relativePath.endsWith("/layout.tsx")
    if (isPageOrLayout) {
      const lines = await countLines(absolutePath)
      const warningCutoff = Math.floor(PAGE_LAYOUT_BUDGET * PAGE_LAYOUT_WARNING_THRESHOLD)
      if (lines > PAGE_LAYOUT_BUDGET) {
        if (PAGE_LAYOUT_BUDGET_ALLOWLIST.has(relativePath)) {
          warnings.push(
            `Allowlisted page/layout over budget (${PAGE_LAYOUT_BUDGET}): ${relativePath} (${lines} lines)`,
          )
        } else {
          errors.push(`Route page/layout exceeds budget (${PAGE_LAYOUT_BUDGET}): ${relativePath} (${lines} lines)`)
        }
      } else if (lines > warningCutoff) {
        warnings.push(
          `Approaching route page/layout budget (${PAGE_LAYOUT_BUDGET}): ${relativePath} (${lines} lines)`,
        )
      }

      const hasUseClientDirective = sourceFile.statements.some((statement) => {
        return (
          ts.isExpressionStatement(statement) &&
          ts.isStringLiteral(statement.expression) &&
          statement.expression.text === "use client"
        )
      })

      if (hasUseClientDirective) {
        errors.push(`Route page/layout cannot be client components: ${relativePath}`)
      }
    }

    const specifiers = collectModuleSpecifiers(sourceFile)
    const hasRouteReexport = specifiers.some((specifier) => {
      return specifier.startsWith("@/app/") && /\/page$/u.test(specifier)
    })

    if (hasRouteReexport) {
      errors.push(
        `Route entrypoint cannot import/re-export another route page directly: ${relativePath}. Extract shared feature code instead.`,
      )
    }

    validateRouteImportContract({ relativePath, sourceText, specifiers, errors })
  }

  if (warnings.length > 0) {
    console.log("Route entry contract warnings:")
    for (const warning of warnings) {
      console.log(`- ${warning}`)
    }
  }

  if (errors.length > 0) {
    console.error("Route entry contract check failed:")
    for (const error of errors) {
      console.error(`- ${error}`)
    }
    process.exit(1)
  }

  console.log("Route entry contract check passed.")
}

main().catch((error) => {
  console.error("Unable to run route entry contract check", error)
  process.exit(1)
})
