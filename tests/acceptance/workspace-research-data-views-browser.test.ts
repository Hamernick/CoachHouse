import { spawn } from "node:child_process"
import path from "node:path"
import type { AddressInfo } from "node:net"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { chromium, type Browser } from "@playwright/test"
import { createServer, type ViteDevServer } from "vite"
import { dataViewCommandSchema } from "@/features/workspace-data-views"
import { createClosureDatabaseHarness, databaseUrl } from "./organization-closure-database-helpers"
const db = createClosureDatabaseHarness(spawn)
const actor = "10000000-0000-4000-8000-000000000001"

describe.skipIf(!databaseUrl)("reviewed AI view actual browser and canonical SQL", () => {
  let server: ViteDevServer, browser: Browser, origin: string
  const calls: { method: string; action: string }[] = []
  let loseNextCreationResponse = true
  beforeAll(async () => {
    const reset = await db.query("select public.fixture_data_views()")
    expect(reset.code, reset.stderr).toBe(0)
    server = await createServer({ configFile: false, root: process.cwd(), resolve: { alias: { "@": path.resolve("src") } }, esbuild: { jsx: "automatic" }, define: { "process.env.NEXT_PUBLIC_WORKSPACE_AI_PRESENTATION": JSON.stringify("1") },
      server: { host: "127.0.0.1", port: 0 }, plugins: [{ name: "isolated-research-source-actions", enforce: "pre", transform(code, module) {
        if (module.endsWith("/workspace-ai/server/research-data-view-effects.ts")) return code.replace('import "server-only"', '')
        if (module.endsWith("/workspace-data-views/server.ts")) return `const send = async (method, command) => (await fetch('/fixture-source', { method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({method,command}) })).json(); export const createLinkedSheetView=()=>{throw Error('Unexpected Sheets source')}; export const readExistingDataViewCreation=()=>{throw Error('Unexpected existing source')}; export const runDataViewCommand = command => send('write',command); export const readProjectDataViewCreation = command => send('receipt',command);`
        if (module.endsWith("/workspace-data-views/server/actions.ts")) return `export async function runDataViewCommand(command) { return (await fetch('/fixture-source', { method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({method:'manual',command}) })).json() }`
      }, configureServer(instance) {
        instance.middlewares.use(async (request, response, next) => {
          if (request.url === "/") { response.setHeader("Content-Type", "text/html"); response.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/tests/acceptance/fixtures/workspace-research-data-views-browser.tsx"></script></body></html>'); return }
          if (request.url !== "/fixture-source" || request.method !== "POST") return next()
          let body = ""; for await (const chunk of request) body += chunk
          const { method, command } = JSON.parse(body), parsed = dataViewCommandSchema.safeParse(command)
          response.setHeader("Content-Type", "application/json")
          if (!parsed.success || !["write", "receipt", "manual"].includes(method)) { response.end(JSON.stringify({ ok: false, code: "invalid" })); return }
          calls.push({ method, action: parsed.data.action })
          // Fixed synthetic actor; never an app route or authentication substitute.
          const fn = method === "receipt" ? "read_project_data_view_creation" : "workspace_data_view_command"
          const result = await db.query(`set role authenticated; set request.jwt.claim.sub='${actor}'; select public.${fn}('${JSON.stringify(parsed.data).replaceAll("'", "''")}'::jsonb);`)
          if (result.code === 0 && method === "write" && loseNextCreationResponse) {
            loseNextCreationResponse = false
            response.end(JSON.stringify({ ok: false, code: "unavailable", error: "Synthetic response lost after real source commit." })); return
          }
          response.end(JSON.stringify(result.code === 0 ? { ok: true, data: JSON.parse(result.stdout.trim()) } : { ok: false, code: "denied", error: "Source unavailable" }))
        })
      } }],
    })
    await server.listen(); origin = `http://127.0.0.1:${(server.httpServer!.address() as AddressInfo).port}`
    browser = await chromium.launch({ headless: true })
  }, 30000)
  afterAll(async () => { await browser?.close(); await server?.close(); for (const child of db.clients) child.kill() })
  it("edits, pins, loses a source response, reloads receipts without replay, then opens the actual authorized source", async () => {
    const page = await browser.newPage({ viewport: { width: 1000, height: 900 } })
    page.setDefaultTimeout(7000)
    const errors: string[] = []; page.on("pageerror", error => { errors.push(error.message); console.error(error.stack) })
    await page.goto(origin)
    const title = page.getByLabel("Item 1 title", { exact: true })
    await title.fill("Reviewed project view")
    expect(calls).toEqual([])
    await page.getByRole("button", { name: "Apply reviewed output" }).click()
    await page.getByText("Synthetic response lost after real source commit.").waitFor()
    expect(await title.isDisabled()).toBe(true)
    expect(calls.filter(call => call.method === "write")).toHaveLength(1)
    const created = await db.query("select name from public.organization_data_views")
    expect(created.stdout.trim()).toBe("Reviewed project view")
    await page.reload()
    await title.waitFor()
    expect(await title.inputValue()).toBe("Reviewed project view")
    const before = calls.length
    await page.getByRole("button", { name: "Check saved outputs" }).click()
    await page.getByText("Saved view creation confirmed. Plan application is separate.", { exact: false }).waitFor()
    expect(calls.slice(before)).toEqual([{ method: "receipt", action: "create_view" }])
    expect(calls.filter(call => call.method === "write")).toHaveLength(1)
    await page.getByRole("button", { name: "Apply reviewed output" }).click()
    await page.getByRole("alert").filter({ hasText: "Synthetic plan transaction failed" }).waitFor()
    expect(calls.filter(call => call.method === "write")).toHaveLength(1)
    expect(await page.getByRole("status").innerText()).toContain("Plan application is unconfirmed")
    expect(calls.some(call => call.action === "read")).toBe(false)
    await page.getByRole("button", { name: "Open saved view" }).click()
    await page.getByRole("columnheader", { name: "Project", exact: true }).waitFor()
    expect(calls.some(call => call.method === "manual" && call.action === "read")).toBe(true)
    expect(await page.getByRole("columnheader").allTextContents()).toEqual(["Project", "Status", "Starts", "Ends"])
    const count = await db.query("select count(*) from public.organization_data_views")
    expect(count.stdout.trim()).toBe("1")
    const manual = { action: "create_view", organizationId: actor, viewId: "10000000-0000-4000-8000-000000002504", requestId: "10000000-0000-4000-8000-000000002505", name: "Reviewed project view", source: { kind: "projects" } }
    const manualReply = await db.query(`set role authenticated; set request.jwt.claim.sub='${actor}'; select public.workspace_data_view_command('${JSON.stringify(manual)}'::jsonb);`)
    expect(manualReply.code, manualReply.stderr).toBe(0)
    const parity = await db.query("select count(distinct jsonb_build_object('name',name,'source',source,'tableId',table_id,'config',config,'revision',revision)) from public.organization_data_views")
    expect(parity.stdout.trim()).toBe("1")
    const copies = await db.query("select (select count(*) from public.organization_data_tables)+(select count(*) from public.organization_data_rows)")
    expect(copies.stdout.trim()).toBe("0")
    expect(errors).toEqual([])
    await page.close()
  }, 30000)
})
