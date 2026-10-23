#!/usr/bin/env node

import { promises as fs } from "node:fs"
import path from "node:path"
import * as ts from "typescript"

const ROOT = process.cwd()
const SRC_ROOT = path.join(ROOT, "src")
const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx"])
const ALIAS_PREFIX = "@/"
const FEATURE_ALIAS_PREFIX = "@/features/"
const publicServerEntrypoints = new Map()

const UI_ALIAS_ALLOWLIST = ["@/components/ui", "@/lib/", "@/hooks/use-mobile"]

function toRepoRelative(absolutePath) {
  return path.relative(ROOT, absolutePath).split(path.sep).join("/")
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

function collectModuleSpecifiers(sourceFile) {
  const specifiers = []

  function visit(node) {
    if (
      ts.isImportDeclaration(node) &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      specifiers.push(node.moduleSpecifier.text)
    }

    if (
      ts.isExportDeclaration(node) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      specifiers.push(node.moduleSpecifier.text)
    }

    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "require" &&
      node.arguments.length > 0 &&
      ts.isStringLiteral(node.arguments[0])
    ) {
      specifiers.push(node.arguments[0].text)
    }

    if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments.length > 0 &&
      ts.isStringLiteral(node.arguments[0])
    ) {
      specifiers.push(node.arguments[0].text)
    }

    ts.forEachChild(node, visit)
  }

  visit(sourceFile)
  return specifiers
}

function isAppActionImport(specifier) {
  if (!specifier.startsWith("@/app/")) return false
  if (specifier.startsWith("@/app/actions/")) return true
  return /@\/app\/.+\/actions(?:\/|$)/u.test(specifier)
}

function isUiAllowedAlias(specifier) {
  return UI_ALIAS_ALLOWLIST.some((prefix) => {
    if (prefix.endsWith("/")) return specifier.startsWith(prefix)
    return specifier === prefix || specifier.startsWith(`${prefix}/`)
  })
}

function isRoutePrivateSpecifier(specifier) {
  return specifier.includes("/_components/") || specifier.includes("/_lib/")
}

function parseFeatureAlias(specifier) {
  if (!specifier.startsWith(FEATURE_ALIAS_PREFIX)) return null
  const relative = specifier.slice(FEATURE_ALIAS_PREFIX.length)
  const parts = relative.split("/").filter(Boolean)
  if (parts.length === 0) return null
  return {
    featureName: parts[0],
    rest: parts.slice(1),
  }
}

async function hasPublicServerEntrypoint(featureName) {
  if (!publicServerEntrypoints.has(featureName)) {
    publicServerEntrypoints.set(featureName, (async () => {
      const entryPath = path.join(SRC_ROOT, "features", featureName, "server.ts")
      const sourceText = await fs.readFile(entryPath, "utf8").catch(() => null)
      if (sourceText === null) return false
      const sourceFile = ts.createSourceFile(entryPath, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
      return sourceFile.statements.some((statement) =>
        ts.isImportDeclaration(statement) &&
        !statement.importClause &&
        ts.isStringLiteral(statement.moduleSpecifier) &&
        statement.moduleSpecifier.text === "server-only",
      )
    })())
  }
  return publicServerEntrypoints.get(featureName)
}

function applyBoundaryRules({ sourceFilePath, specifier }) {
  const errors = []

  if (!specifier.startsWith(ALIAS_PREFIX)) {
    return errors
  }

  const isUiPrimitive = sourceFilePath.startsWith("src/components/ui/")
  const isComponent = sourceFilePath.startsWith("src/components/")
  const isLibLayer =
    sourceFilePath.startsWith("src/lib/") ||
    sourceFilePath.startsWith("src/actions/")
  const isFeatureLayer = sourceFilePath.startsWith("src/features/")
  const featureAlias = parseFeatureAlias(specifier)

  if (isUiPrimitive && !isUiAllowedAlias(specifier)) {
    errors.push(
      `${sourceFilePath}: UI primitives may only import from '@/components/ui/**' and '@/lib/**' (found '${specifier}')`
    )
  }

  if (
    isLibLayer &&
    (specifier.startsWith("@/components/") || specifier.startsWith("@/app/"))
  ) {
    errors.push(
      `${sourceFilePath}: src/lib and src/actions cannot import UI/routes (found '${specifier}')`
    )
  }

  if (
    isComponent &&
    !isUiPrimitive &&
    specifier.startsWith("@/app/") &&
    !isAppActionImport(specifier)
  ) {
    errors.push(
      `${sourceFilePath}: components may not import route modules from src/app (found '${specifier}'). Use shared actions/lib modules.`
    )
  }

  if (
    !sourceFilePath.startsWith("src/app/") &&
    isRoutePrivateSpecifier(specifier)
  ) {
    errors.push(
      `${sourceFilePath}: route-private modules ('_components'/'_lib') cannot be imported outside src/app routes (found '${specifier}')`
    )
  }

  if (featureAlias && !isFeatureLayer) {
    const isPublicEntrypoint =
      featureAlias.rest.length === 0 ||
      (featureAlias.rest.length === 1 &&
        ["client", "index", "server"].includes(featureAlias.rest[0]))
    if (!isPublicEntrypoint) {
      errors.push(
        `${sourceFilePath}: imports from features must use a public entrypoint ('@/features/${featureAlias.featureName}' or its client/server entrypoint). Found '${specifier}'.`
      )
    }
  }

  return errors
}

async function run() {
  const stats = await fs.stat(SRC_ROOT).catch(() => null)
  if (!stats || !stats.isDirectory()) {
    console.error(
      "Unable to run import boundary checks: src directory not found"
    )
    process.exit(1)
  }

  const files = await walkFiles(SRC_ROOT)
  const errors = []

  for (const absolutePath of files) {
    const extension = path.extname(absolutePath)
    if (!SOURCE_EXTENSIONS.has(extension)) continue

    const sourceText = await fs.readFile(absolutePath, "utf8")
    const repoRelative = toRepoRelative(absolutePath)
    const sourceFile = ts.createSourceFile(
      repoRelative,
      sourceText,
      ts.ScriptTarget.Latest,
      true,
      resolveScriptKind(extension)
    )

    const specifiers = collectModuleSpecifiers(sourceFile)

    for (const specifier of specifiers) {
      errors.push(
        ...applyBoundaryRules({ sourceFilePath: repoRelative, specifier })
      )
      const featureAlias = parseFeatureAlias(specifier)
      if (
        featureAlias?.rest.length === 1 &&
        featureAlias.rest[0] === "server" &&
        !(await hasPublicServerEntrypoint(featureAlias.featureName))
      ) {
        errors.push(`${repoRelative}: /server imports require a root server.ts with a side-effect 'server-only' import (found '${specifier}')`)
      }
    }
  }

  if (errors.length > 0) {
    console.error("Import boundary check failed:\n")
    for (const error of errors) {
      console.error(`- ${error}`)
    }
    process.exit(1)
  }

  console.log("Import boundaries check passed.")
}

run().catch((error) => {
  console.error("Unable to run import boundary check", error)
  process.exit(1)
})
