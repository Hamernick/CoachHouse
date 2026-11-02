import path from "node:path"
import { mkdtemp, readFile, writeFile, readdir } from "node:fs/promises"
import os from "node:os"
import { createServer, type Server } from "node:http"
import { gzipSync } from "node:zlib"
import type { AddressInfo } from "node:net"
import { build } from "vite"
import { chromium, type Browser, type Page } from "@playwright/test"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

type Metrics = { firstCommitMs: number; updates: number[]; update: () => void; ready: number }
const stats = (values: number[]) => { const sorted = [...values].sort((a, b) => a - b); return { samples: values.length, min: sorted[0], median: sorted[Math.floor(sorted.length / 2)], p95: sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * .95) - 1)] } }
const enabled = process.env.PARTICLE_PRESENTATION_BENCHMARK === "1"
// Explicit opt-in: isolated production-mode fixture builds, never Next/server restarts.
describe.skipIf(!enabled)("local same-artifact json-render qualification", () => {
  let directory: string, server: Server, browser: Browser, origin: string
  const styles: Record<string, string[]> = {}
  const bundles: Record<string, { bytes: number; gzipBytes: number; jsonRenderModules: number }> = {}
  beforeAll(async () => {
    directory = await mkdtemp(path.join(os.tmpdir(), "ch-presentation-benchmark-"))
    for (const variant of ["baseline", "selected"] as const) {
      const modules = new Set<string>()
      await build({ configFile: false, root: process.cwd(), logLevel: "warn", resolve: { alias: { "@": path.resolve("src") } }, esbuild: { jsx: "automatic", jsxDev: false },
        define: { "process.env.NODE_ENV": JSON.stringify("production"), "process.env.NEXT_PUBLIC_WORKSPACE_AI_PRESENTATION": JSON.stringify(variant === "selected" ? "1" : "0") },
        build: { outDir: path.join(directory, variant), emptyOutDir: false, copyPublicDir: false, minify: "esbuild", lib: { entry: path.resolve("tests/acceptance/fixtures/workspace-research-presentation-benchmark.tsx"), formats: ["iife"], name: "PresentationBenchmark", fileName: () => "fixture.js" } },
        plugins: [{ name: "actual-legacy-review-baseline", enforce: "pre", transform(code, id) {
          // Model Next's server-action boundary in both isolated bundles. Any
          // accidental invocation fails; the benchmark has no source effects.
          if (/^\s*["']use server["']/.test(code)) return [...code.matchAll(/export async function (\w+)/g)]
            .map(match => `export async function ${match[1]}() { throw new Error("Benchmark source effects forbidden") }`).join("\n")
          // Remove only optional adapter imports from the disabled baseline.
          // The repository's existing manual fallback/editor remain unchanged.
          if (variant === "baseline" && id.endsWith("/workspace-ai/components/research-review.tsx")) return code
            .replace('import { researchPresentationEnabled } from "../lib/research-presentation"', 'const researchPresentationEnabled = false')
            .replace('import { ResearchPlanPresentation } from "./research-presentation"', 'const ResearchPlanPresentation = () => null')
        }, generateBundle(_options, output) { for (const value of Object.values(output)) if (value.type === "chunk") for (const id of Object.keys(value.modules)) if (id.includes("@json-render")) modules.add(id) } }],
      })
      styles[variant] = (await readdir(path.join(directory, variant))).filter(file => file.endsWith(".css"))
      let bytes = 0, gzipBytes = 0
      for (const file of await readdir(path.join(directory, variant))) { const value = await readFile(path.join(directory, variant, file)); bytes += value.length; gzipBytes += gzipSync(value).length }
      bundles[variant] = { bytes, gzipBytes, jsonRenderModules: modules.size }
    }
    server = createServer(async (request, response) => {
      const url = new URL(request.url!, "http://localhost"), variant = url.pathname.split("/")[1]
      if (!["baseline", "selected"].includes(variant)) { response.writeHead(404).end(); return }
      response.setHeader("Cache-Control", "no-store")
      if (styles[variant].includes(path.basename(url.pathname))) { response.setHeader("Content-Type", "text/css"); response.end(await readFile(path.join(directory, variant, path.basename(url.pathname)))); return }
      if (url.pathname.endsWith("fixture.js")) { response.setHeader("Content-Type", "application/javascript"); response.end(await readFile(path.join(directory, variant, "fixture.js"))); return }
      response.setHeader("Content-Type", "text/html")
      response.end(`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">${styles[variant].map(file => `<link rel="stylesheet" href="/${variant}/${file}">`).join("")}</head><body><div id="root"></div><script src="/${variant}/fixture.js"></script></body></html>`)
    })
    await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve)); origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
    browser = await chromium.launch({ headless: true })
  }, 60000)
  afterAll(async () => { await browser?.close(); if (server) await new Promise<void>(resolve => server.close(() => resolve())) })
  async function open(variant: string, mixed = false): Promise<Page> {
    const page = await browser.newPage({ viewport: { width: 1100, height: 900 } })
    page.setDefaultTimeout(7000)
    page.on("pageerror", error => console.error(error.stack))
    await page.route("**/*", route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort())
    await page.goto(`${origin}/${variant}/${mixed ? "?mixed=1" : ""}`)
    await page.getByLabel("Item 1 title", { exact: true }).waitFor()
    await page.waitForFunction(() => (window as unknown as { presentationBenchmark: Metrics }).presentationBenchmark.firstCommitMs > 0)
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
    return page
  }
  it("compares identical twelve-note artifacts, reports overhead without asserting a performance gain", async () => {
    const first: Record<string, number[]> = { baseline: [], selected: [] }, updates: Record<string, number[]> = { baseline: [], selected: [] }
    const paints: Record<string, number[]> = { baseline: [], selected: [] }
    const markup: Record<string, string[]> = {}
    // Alternate order; no models, source traffic, CPU throttling or production Next claim.
    for (let run = 0; run < 10; run++) for (const variant of run % 2 ? ["selected", "baseline"] : ["baseline", "selected"]) {
      const page = await open(variant)
      markup[variant] = await page.getByRole("region", { name: "Reviewed artifact" }).getByRole("listitem").allTextContents()
      paints[variant].push(await page.evaluate(() => performance.getEntriesByName("first-contentful-paint")[0]?.startTime ?? 0))
      first[variant].push(await page.evaluate(() => (window as unknown as { presentationBenchmark: Metrics }).presentationBenchmark.firstCommitMs))
      for (let n = 1; n <= 5; n++) { await page.evaluate(() => (window as unknown as { presentationBenchmark: Metrics }).presentationBenchmark.update()); await page.waitForFunction(n => (window as unknown as { presentationBenchmark: Metrics }).presentationBenchmark.ready === n, n) }
      updates[variant].push(...await page.evaluate(() => (window as unknown as { presentationBenchmark: Metrics }).presentationBenchmark.updates))
      await page.close()
    }
    expect(markup.selected).toEqual(markup.baseline)
    expect(bundles.baseline.jsonRenderModules).toBe(0)
    expect(bundles.selected.jsonRenderModules).toBeGreaterThan(0)
    const report = { kind: "local-synthetic-production-bundle", artifacts: "identical twelve notes; original fallback/editor vs selected renderer", styling: "Both variants include current application globals, scoped SDK foundation, and actual component CSS. System font fallback; excludes Next font loading. Earlier unstyled fixture measurements are historical, not a directly comparable baseline.", bundles,
      delta: { bytes: bundles.selected.bytes - bundles.baseline.bytes, gzipBytes: bundles.selected.gzipBytes - bundles.baseline.gzipBytes },
      firstContentfulPaintMs: { baseline: stats(paints.baseline), selected: stats(paints.selected) },
      firstCommitMs: { baseline: stats(first.baseline), selected: stats(first.selected) }, updateCommitMs: { baseline: stats(updates.baseline), selected: stats(updates.selected) },
      limitations: "First contentful paint contains the actual fixed artifact; commit metrics start at entry execution. Server actions are fail-closed fixture stubs. Excludes real sources, Next production route and model spend. No demonstrated runtime savings claim. Ten paired local navigation samples; fifty updates per variant." }
    await writeFile("/tmp/ch-s10-presentation-benchmark.json", JSON.stringify(report, null, 2) + "\n")
    expect([...first.baseline, ...first.selected, ...updates.baseline, ...updates.selected].every(value => Number.isFinite(value) && value >= 0)).toBe(true)
  }, 60000)
  it("preserves mixed artifact edits and focus while incoming typed notes update, with no source/network effects", async () => {
    const page = await open("selected", true), errors: string[] = [], external: string[] = []
    page.on("pageerror", error => errors.push(error.message))
    page.on("request", request => { if (new URL(request.url()).origin !== origin) external.push(request.url()) })
    const title = page.getByLabel("Item 1 title", { exact: true })
    await title.fill("Human-reviewed note"); await title.evaluate(element => (element as HTMLInputElement).setSelectionRange(2, 7))
    await page.evaluate(() => (window as unknown as { presentationBenchmark: Metrics }).presentationBenchmark.update())
    await page.waitForFunction(() => (window as unknown as { presentationBenchmark: Metrics }).presentationBenchmark.ready === 1)
    expect(await title.inputValue()).toBe("Human-reviewed note")
    expect(await title.evaluate(element => element === document.activeElement)).toBe(true)
    expect(await title.evaluate(element => [(element as HTMLInputElement).selectionStart, (element as HTMLInputElement).selectionEnd])).toEqual([2, 7])
    const artifact = page.getByRole("region", { name: "Reviewed artifact" })
    expect(await artifact.innerText()).toContain("Human-reviewed note")
    expect(await artifact.getByLabel("Your name", { exact: false }).count()).toBeGreaterThan(0)
    expect(await artifact.getByLabel("Declared data view columns").innerText()).toContain("Status")
    expect(await artifact.innerText()).toContain("No view has been created by this preview")
    expect(errors).toEqual([]); expect(external).toEqual([])
    await page.close()
  })
})
