#!/usr/bin/env node

import { promises as fs } from "node:fs"
import path from "node:path"
import * as ts from "typescript"

const ROOT = process.cwd()
const FEATURES_ROOT = path.join(ROOT, "src", "features")
const ACCEPTANCE_TESTS_ROOT = path.join(ROOT, "tests", "acceptance")
const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx"])
const KEBAB_CASE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const FEATURE_ALIAS_PREFIX = "@/features/"
const publicServerEntrypoints = new Map()

const REQUIRED_DIRECTORIES = ["components", "lib", "server"]
const REQUIRED_FILES = ["README.md", "index.ts", "types.ts", "components/index.ts", "lib/index.ts", "server/actions.ts"]

function toRepoRelative(absolutePath) {
  return path.relative(ROOT, absolutePath).split(path.sep).join("/")
}

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath)
    return true
  } catch {
    return false
  }
}

async function hasPublicServerEntrypoint(featureName) {
  if (!publicServerEntrypoints.has(featureName)) {
    publicServerEntrypoints.set(featureName, (async () => {
      const entryPath = path.join(FEATURES_ROOT, featureName, "server.ts")
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

async function hasFeatureAcceptanceTest(featureName) {
  const candidates = [
    path.join(ACCEPTANCE_TESTS_ROOT, `${featureName}.test.ts`),
    path.join(ACCEPTANCE_TESTS_ROOT, `${featureName}.test.tsx`),
  ]

  for (const candidate of candidates) {
    if (await pathExists(candidate)) return true
  }

  return false
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
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      specifiers.push(node.moduleSpecifier.text)
    }

    if (ts.isExportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
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

function hasSegment(specifier, segment) {
  return specifier.split("/").includes(segment)
}

function getLayerFromPath(repoRelativePath) {
  if (repoRelativePath.includes("/components/")) return "components"
  if (repoRelativePath.includes("/lib/")) return "lib"
  if (repoRelativePath.includes("/server/")) return "server"
  if (repoRelativePath.includes("/hooks/")) return "hooks"
  return "root"
}

function collectSpecifierErrors({ repoRelativePath, featureName, layer, specifier }) {
  const errors = []

  if (specifier.startsWith("@/app/")) {
    errors.push(`${repoRelativePath}: feature modules cannot import app routes/modules (found '${specifier}')`)
  }

  const featureAlias = parseFeatureAlias(specifier)
  if (featureAlias) {
    if (featureAlias.featureName !== featureName) {
      const isPublicEntry =
        featureAlias.rest.length === 0 || (featureAlias.rest.length === 1 && ["index", "client", "server"].includes(featureAlias.rest[0]))
      if (!isPublicEntry) {
        errors.push(
          `${repoRelativePath}: cross-feature imports must use public entrypoint ('@/features/${featureAlias.featureName}'). Found '${specifier}'.`,
        )
      }
    }
  }

  if (layer === "components") {
    const importsServer =
      hasSegment(specifier, "server") &&
      (specifier.startsWith(".") || (featureAlias && featureAlias.featureName === featureName))
    if (importsServer) {
      errors.push(`${repoRelativePath}: components layer cannot import server layer (found '${specifier}')`)
    }
  }

  if (layer === "lib") {
    if (specifier === "react" || specifier.startsWith("react/")) {
      errors.push(`${repoRelativePath}: lib layer must stay framework-agnostic (found '${specifier}')`)
    }

    if (specifier.startsWith("@/components/")) {
      errors.push(`${repoRelativePath}: lib layer cannot import UI components (found '${specifier}')`)
    }

    if (hasSegment(specifier, "server") && specifier.startsWith(".")) {
      errors.push(`${repoRelativePath}: lib layer cannot import server layer (found '${specifier}')`)
    }
  }

  if (layer === "server") {
    const importsComponents =
      hasSegment(specifier, "components") &&
      (specifier.startsWith(".") || specifier.startsWith("@/components/") || (featureAlias && featureAlias.featureName === featureName))
    if (importsComponents) {
      errors.push(`${repoRelativePath}: server layer cannot import components layer (found '${specifier}')`)
    }
  }

  return errors
}

async function main() {
  const rootExists = await pathExists(FEATURES_ROOT)
  if (!rootExists) {
    console.log("Feature contract check passed (src/features not present yet).")
    return
  }

  const rootEntries = await fs.readdir(FEATURES_ROOT, { withFileTypes: true })
  const featureDirs = rootEntries.filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))

  if (featureDirs.length === 0) {
    console.log("Feature contract check passed (no feature slices yet).")
    return
  }

  const errors = []

  for (const featureDir of featureDirs) {
    const featureName = featureDir.name
    const featureRoot = path.join(FEATURES_ROOT, featureName)
    const featureRelativeRoot = `src/features/${featureName}`

    if (!KEBAB_CASE.test(featureName)) {
      errors.push(`${featureRelativeRoot}: feature directory must be kebab-case`)
      continue
    }

    for (const dir of REQUIRED_DIRECTORIES) {
      const target = path.join(featureRoot, dir)
      const exists = await pathExists(target)
      if (!exists) {
        errors.push(`${featureRelativeRoot}: missing required directory '${dir}'`)
      }
    }

    for (const file of REQUIRED_FILES) {
      const target = path.join(featureRoot, file)
      const exists = await pathExists(target)
      if (!exists) {
        errors.push(`${featureRelativeRoot}: missing required file '${file}'`)
      }
    }

    if (!(await hasFeatureAcceptanceTest(featureName))) {
      errors.push(
        `${featureRelativeRoot}: missing acceptance test (expected tests/acceptance/${featureName}.test.ts[x])`,
      )
    }

    const files = await walkFiles(featureRoot)
    for (const absolutePath of files) {
      const extension = path.extname(absolutePath)
      if (!SOURCE_EXTENSIONS.has(extension)) continue

      const sourceText = await fs.readFile(absolutePath, "utf8")
      const repoRelativePath = toRepoRelative(absolutePath)
      const sourceFile = ts.createSourceFile(
        repoRelativePath,
        sourceText,
        ts.ScriptTarget.Latest,
        true,
        resolveScriptKind(extension),
      )

      const layer = getLayerFromPath(repoRelativePath)
      const specifiers = collectModuleSpecifiers(sourceFile)
      if (repoRelativePath === `${featureRelativeRoot}/server.ts`) {
        const hasServerOnlyMarker = sourceFile.statements.some((statement) =>
          ts.isImportDeclaration(statement) &&
          !statement.importClause &&
          ts.isStringLiteral(statement.moduleSpecifier) &&
          statement.moduleSpecifier.text === "server-only",
        )
        if (!hasServerOnlyMarker) {
          errors.push(`${repoRelativePath}: public server entrypoint must import 'server-only'`)
        }
      }
      for (const specifier of specifiers) {
        errors.push(...collectSpecifierErrors({ repoRelativePath, featureName, layer, specifier }))
        const featureAlias = parseFeatureAlias(specifier)
        if (
          featureAlias?.rest.length === 1 &&
          featureAlias.rest[0] === "server" &&
          !(await hasPublicServerEntrypoint(featureAlias.featureName))
        ) {
          errors.push(`${repoRelativePath}: /server imports require a root server.ts with a side-effect 'server-only' import (found '${specifier}')`)
        }
      }

      if (repoRelativePath === `${featureRelativeRoot}/index.ts`) {
        const exportsServer = specifiers.some((specifier) => hasSegment(specifier, "server"))
        if (exportsServer) {
          errors.push(`${repoRelativePath}: public feature entrypoint must not export server internals`)
        }
      }
    }
  }

  if (errors.length > 0) {
    console.error("Feature contract check failed:")
    for (const error of errors) {
      console.error(`- ${error}`)
    }
    process.exit(1)
  }

  console.log("Feature contract check passed.")
}

main().catch((error) => {
  console.error("Unable to run feature contract check", error)
  process.exit(1)
})
