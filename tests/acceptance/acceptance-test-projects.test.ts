import { describe, expect, it } from "vitest"
import { readFile, readdir } from "node:fs/promises"
import path from "node:path"

import {
  ACCEPTANCE_PROJECT_NAMES,
  classifyAcceptanceSource,
  compareAcceptanceProjectManifests,
} from "../../scripts/sync-acceptance-projects.mjs"
import acceptanceConfig from "../../vitest.config"
import acceptanceProjectsConfig from "../../vitest.projects.config"

const ROOT = process.cwd()
const MANIFEST_PATH = path.join(ROOT, "tests/acceptance/projects.json")

type InlineAcceptanceProject = {
  test?: {
    name?: string
    setupFiles?: string[]
  }
}

async function readManifest() {
  return JSON.parse(await readFile(MANIFEST_PATH, "utf8"))
}

async function listTestFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true })
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const absolutePath = path.join(directory, entry.name)
      return entry.isDirectory() ? listTestFiles(absolutePath) : [absolutePath]
    })
  )
  return nested
    .flat()
    .filter((file) => file.endsWith(".test.ts"))
    .map((file) => path.relative(ROOT, file).split(path.sep).join("/"))
    .sort()
}

describe("acceptance test projects", () => {
  it("classifies every acceptance file exactly once", async () => {
    const [actual, expectedFiles] = await Promise.all([
      readManifest(),
      listTestFiles(path.join(ROOT, "tests/acceptance")),
    ])

    const files = ACCEPTANCE_PROJECT_NAMES.flatMap(
      (name) => actual.projects[name]
    ).sort()
    expect(new Set(files).size).toBe(files.length)
    expect(files).toEqual(expectedFiles)
  })

  it("uses deterministic project rules", () => {
    expect(
      classifyAcceptanceSource(
        'import { execFile } from "node:child_process"\nexecFile("node", [])'
      )
    ).toBe("cli")
    expect(
      classifyAcceptanceSource(
        'import { readFile } from "node:fs/promises"\nreadFile("src/a.ts")'
      )
    ).toBe("contract")
    expect(
      classifyAcceptanceSource(
        'import { a } from "@/a"\nimport { b } from "@/b"'
      )
    ).toBe("integration")
    expect(classifyAcceptanceSource('import { a } from "@/a"')).toBe("behavior")
    expect(
      classifyAcceptanceSource(
        'import { readFileSync } from "node:fs"\nimport Stripe from "stripe"\nreadFileSync("fixture.json")'
      )
    ).toBe("behavior")
  })

  it("detects missing and duplicate coverage", async () => {
    const expected = await readManifest()
    const actual = structuredClone(expected)
    const missing = actual.projects.behavior.shift()
    actual.projects.contract.push(actual.projects.contract[0])

    const errors = compareAcceptanceProjectManifests(actual, expected)
    expect(
      errors.some((error) => error.includes(`behavior missing: ${missing}`))
    ).toBe(true)
    expect(errors.some((error) => error.includes("duplicate file:"))).toBe(true)
  })

  it("keeps the full command as the checked union of all projects", async () => {
    const [packageJson, actualManifest] = await Promise.all([
      readFile(path.join(ROOT, "package.json"), "utf8").then(JSON.parse),
      readManifest(),
    ])
    const fullCommand = packageJson.scripts["test:acceptance"]

    expect(fullCommand).toContain("check:acceptance-projects")
    expect(fullCommand).not.toContain("--project")
    expect(acceptanceConfig.test?.include?.slice().sort()).toEqual(
      ACCEPTANCE_PROJECT_NAMES.flatMap(
        (name) => actualManifest.projects[name]
      ).sort()
    )
    for (const projectName of ACCEPTANCE_PROJECT_NAMES) {
      expect(packageJson.scripts[`test:acceptance:${projectName}`]).toContain(
        `--project ${projectName}`
      )
      expect(packageJson.scripts[`test:acceptance:${projectName}`]).toContain(
        "vitest.projects.config.ts"
      )
    }
  })

  it("keeps heavy server mocks out of the contract project", () => {
    const projects = acceptanceProjectsConfig.test
      ?.projects as InlineAcceptanceProject[]
    const contractProject = projects.find(
      (project) => project.test?.name === "contract"
    )
    const fullSetupProjects = projects.filter((project) =>
      ["behavior", "cli", "integration"].includes(project.test?.name ?? "")
    )

    expect(contractProject?.test?.setupFiles).toEqual([])
    expect(fullSetupProjects).toHaveLength(3)
    expect(
      fullSetupProjects.every((project) =>
        project.test?.setupFiles?.includes("./tests/acceptance/test-utils.ts")
      )
    ).toBe(true)
  })

  it("keeps the existing shared eight-worker ceiling", () => {
    expect(acceptanceConfig.test?.maxWorkers).toBe(8)
    expect(acceptanceProjectsConfig.test?.maxWorkers).toBe(8)
  })
})
