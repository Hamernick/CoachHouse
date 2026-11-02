import { spawn } from "node:child_process"
import path from "node:path"
import type { AddressInfo } from "node:net"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { chromium, type Browser } from "@playwright/test"
import { createServer, type ViteDevServer } from "vite"
import { dataViewCommandSchema } from "@/features/workspace-data-views/lib/schema"
import { createClosureDatabaseHarness, databaseUrl } from "./organization-closure-database-helpers"

const db = createClosureDatabaseHarness(spawn)
const id = (value: number) => `10000000-0000-4000-8000-${String(value).padStart(12, "0")}`

describe.skipIf(!databaseUrl)("saved views real browser and disposable SQL", () => {
  let server: ViteDevServer, browser: Browser, origin: string
  beforeAll(async () => {
    const reset = await db.query("select public.fixture_data_views();")
    expect(reset.code, reset.stderr).toBe(0)
    server = await createServer({ configFile: false, root: process.cwd(), cacheDir: "/tmp/ch-b1-data-view-vite-cache", optimizeDeps: { entries: ["tests/acceptance/fixtures/workspace-data-views-browser.tsx"] }, resolve: { alias: { "@": path.resolve("src") } }, esbuild: { jsx: "automatic" },
      server: { host: "127.0.0.1", port: 0, watch: null }, plugins: [{ name: "isolated-data-view-action", enforce: "pre", transform(_code, module) {
        if (module.endsWith("/workspace-data-views/server/actions.ts")) return `export async function runDataViewCommand(command) { const response = await fetch('/fixture-command', { method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify(command) }); return response.json(); }`
      }, configureServer(instance) {
        instance.middlewares.use(async (request, response, next) => {
          if (request.url === "/") { response.setHeader("Content-Type", "text/html"); response.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/tests/acceptance/fixtures/workspace-data-views-browser.tsx"></script></body></html>'); return }
          if (request.url !== "/fixture-command" || request.method !== "POST") return next()
          let body = ""; for await (const chunk of request) body += chunk
          const parsed = dataViewCommandSchema.safeParse(JSON.parse(body))
          response.setHeader("Content-Type", "application/json")
          if (!parsed.success) { response.end(JSON.stringify({ ok: false, code: "invalid", error: "Invalid command" })); return }
          // Fixed synthetic owner only; this bridge is never an app route/auth substitute.
          const result = await db.query(`set role authenticated; set request.jwt.claim.sub='${id(1)}'; select public.workspace_data_view_command('${JSON.stringify(parsed.data).replaceAll("'", "''")}'::jsonb);`)
          response.end(JSON.stringify(result.code === 0 ? { ok: true, data: JSON.parse(result.stdout.trim()) } : { ok: false, code: result.stderr.includes("changed") ? "conflict" : "denied", error: result.stderr.includes("changed") ? "Source changed. Draft preserved; review the latest value." : "Source unavailable." }))
        })
      } }],
    })
    await server.listen()
    origin = `http://127.0.0.1:${(server.httpServer!.address() as AddressInfo).port}`
    browser = await chromium.launch({ headless: true })
  }, 30000)
  afterAll(async () => { await browser?.close(); await server?.close(); for (const child of db.clients) child.kill() })
  it("creates/imports, edits, saves settings, reloads and preserves a conflicted draft", async () => {
    const page = await browser.newPage({ viewport: { width: 1100, height: 850 } })
    const errors: string[] = []; page.on("pageerror", error => errors.push(error.message))
    await page.route("**/*", route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort())
    await page.goto(origin)
    await page.getByLabel("Source", { exact: true }).selectOption({ label: "Import a CSV copy…" })
    await page.getByLabel("View name").fill("Imported people")
    await page.getByLabel("CSV file").setInputFiles({ name: "people.csv", mimeType: "text/csv", buffer: Buffer.from("Name,City\nAda,Boston\nGrace,Chicago") })
    await page.getByRole("checkbox").check()
    await page.getByRole("button", { name: "Create saved view" }).click()
    await page.getByRole("button", { name: "Edit Name: Ada", exact: true }).waitFor()
    await page.getByRole("button", { name: "Edit Name: Ada", exact: true }).click()
    await page.getByRole("textbox", { name: "Name", exact: true }).fill("Ada Lovelace")
    await page.getByRole("button", { name: "Save cell", exact: true }).click()
    await page.getByRole("button", { name: "Edit Name: Ada Lovelace", exact: true }).waitFor()
    await page.getByRole("button", { name: "View settings" }).click()
    await page.setViewportSize({ width: 320, height: 900 })
    for (const colorScheme of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme })
      await page.evaluate(dark => { document.documentElement.classList.toggle("dark", dark); document.documentElement.style.fontSize = "200%" }, colorScheme === "dark")
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320)
      expect(await page.getByRole("button", { name: "Save view settings", exact: true }).evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true)
      await page.screenshot({ path: `/tmp/ch-b1-data-view-${colorScheme}.png`, fullPage: true })
    }
    await page.evaluate(() => { document.documentElement.classList.remove("dark"); document.documentElement.style.fontSize = "" })
    await page.setViewportSize({ width: 1100, height: 850 })
    await page.getByRole("checkbox", { name: "City", exact: true }).uncheck()
    await page.getByRole("button", { name: "Save view settings" }).click()
    await page.getByRole("button", { name: "View settings" }).waitFor()
    await page.reload()
    await page.getByRole("button", { name: "Edit Name: Ada Lovelace", exact: true }).waitFor()
    expect(await page.getByRole("columnheader").allTextContents()).toEqual(["Name"])
    await page.getByRole("button", { name: "View settings" }).click()
    await page.getByRole("checkbox", { name: "City", exact: true }).check()
    const changedView = await db.query("update public.organization_data_views set revision=revision+1,config=jsonb_set(config,'{sort,direction}','\"desc\"')")
    expect(changedView.code, changedView.stderr).toBe(0)
    await page.getByRole("button", { name: "Save view settings" }).click()
    await page.getByRole("alert").waitFor()
    expect(await page.getByRole("checkbox", { name: "City", exact: true }).isChecked()).toBe(true)
    await page.getByRole("button", { name: "Refresh", exact: true }).click()
    await page.getByRole("button", { name: "Use latest view revision" }).click()
    await page.getByRole("button", { name: "Save view settings" }).click()
    await page.getByRole("button", { name: "View settings" }).waitFor()

    await page.getByRole("button", { name: "Edit Name: Ada Lovelace", exact: true }).click()
    await page.getByRole("textbox", { name: "Name", exact: true }).fill("My unsaved draft")
    const external = await db.query("update public.organization_data_rows set values=jsonb_set(values,'{column_1}','\"Other editor\"'),revision=revision+1 where values->>'column_1'='Ada Lovelace'")
    expect(external.code, external.stderr).toBe(0)
    await page.getByRole("button", { name: "Save cell", exact: true }).click()
    await page.getByRole("alert").waitFor()
    expect(await page.getByRole("textbox", { name: "Name", exact: true }).inputValue()).toBe("My unsaved draft")
    await page.getByRole("button", { name: "Refresh", exact: true }).click()
    await page.getByRole("button", { name: "Use latest revision" }).waitFor()
    expect(await page.getByRole("textbox", { name: "Name", exact: true }).inputValue()).toBe("My unsaved draft")
    await page.getByRole("button", { name: "Use latest revision" }).click()
    await page.getByRole("button", { name: "Save cell", exact: true }).click()
    await page.getByRole("button", { name: "Edit Name: My unsaved draft", exact: true }).waitFor()
    const persisted = await db.query("select values->>'column_1' from public.organization_data_rows where values->>'column_1'='My unsaved draft'")
    expect(persisted.stdout.trim()).toBe("My unsaved draft")
    await page.setViewportSize({ width: 390, height: 844 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    expect(errors).toEqual([])
    await page.close()
  }, 30000)
})
