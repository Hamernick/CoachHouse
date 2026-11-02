import path from "node:path"
import type { AddressInfo } from "node:net"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { chromium, type Browser } from "@playwright/test"
import { createServer, type ViteDevServer } from "vite"
describe("branded publication reading and review, controlled local transport", () => {
  let server: ViteDevServer, browser: Browser, origin: string
  beforeAll(async () => {
    server = await createServer({ configFile: false, root: process.cwd(), cacheDir: "/tmp/ch-s06-reading-vite-cache",
      optimizeDeps: { entries: ["tests/acceptance/fixtures/workspace-publication-reading-browser.tsx"],
        // The adapter's SDK exports are also reached through the dynamic Share
        // preview. Resolve that known dependency set during fixture setup so
        // a late optimizer reload cannot interrupt a reading interaction.
        include: ["Button", "Input", "Textarea", "Checkbox", "Switch", "Badge", "Alert", "SelectControl", "RadioGroup", "Popover", "Menu", "EmptyMessage", "Avatar", "SegmentedControl"].map(component => `@openai/apps-sdk-ui/components/${component}`),
      },
      define: { "process.env": "{}" }, resolve: { alias: { "@": path.resolve("src") } }, esbuild: { jsx: "automatic" }, server: { host: "127.0.0.1", port: 0, watch: null },
      plugins: [{ name: "publication-reading-boundaries", enforce: "pre", resolveId(source, importer) {
        if ((source === "@/features/workspace-particles" || source === path.resolve("src/features/workspace-particles")) && importer?.includes("workspace-sharing/")) return path.resolve("src/features/workspace-particles/lib/particle-public-content.ts")
        if ((source === "@/features/workspace-particles/client" || source === path.resolve("src/features/workspace-particles/client")) && importer?.includes("workspace-sharing/")) return path.resolve("src/features/workspace-particles/components/notes-rich-editor.tsx")
        if ((source === "../actions" || source === "../server/actions") && importer?.includes("workspace-sharing/")) return path.resolve("tests/browser/workspace-ai/sharing-actions.ts")
        if (source === "../note-actions" && importer?.includes("workspace-sharing/")) return "\0publication-note-action"
        if (source === "../source-actions" && importer?.includes("workspace-data-views/")) return "\0publication-data-view-action"
        if (source === "../access-actions" && importer?.includes("workspace-sharing/")) return path.resolve("tests/browser/workspace-ai/guest-actions.ts")
      }, load(id) {
        if (id === "\0publication-data-view-action") return 'export async function runDataViewCommand(){throw new Error("No data view operation authorized by reading fixture")}'
        if (id === "\0publication-note-action") return 'export async function workspacePageNoteAction(){throw new Error("No note operation authorized by reading fixture")} '
      }, configureServer(instance) { instance.middlewares.use((request, response, next) => {
        if (request.url?.split("?")[0] !== "/") return next()
        response.setHeader("Content-Type", "text/html")
        response.end('<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/tests/acceptance/fixtures/workspace-publication-reading-browser.tsx"></script></body></html>')
      }) } }],
    })
    await server.listen(); origin = `http://127.0.0.1:${(server.httpServer!.address() as AddressInfo).port}`
    browser = await chromium.launch({ headless: true })
  }, 30000)
  afterAll(async () => { await browser?.close(); await server?.close() })
  it.each(["light", "dark"] as const)("keeps committed reading contained and keyboard accessible at320px/enlarged text in %s", async colorScheme => {
    const context = await browser.newContext({ viewport: { width: 320, height: 840 }, isMobile: true, hasTouch: true, colorScheme, reducedMotion: "reduce", timezoneId: "America/Chicago" })
    const page = await context.newPage(), errors: string[] = [], external: string[] = []
    page.setDefaultTimeout(5000)
    let revoked = false, documentReads = 0
    page.on("pageerror", error => errors.push(error.stack ?? error.message))
    await page.route("**/*", async route => {
      const url = new URL(route.request().url())
      if (url.origin !== origin) { external.push(url.origin); return route.abort() }
      if (url.pathname.startsWith("/api/public/workspace-page-documents/")) { documentReads++; return route.fulfill({ status: revoked ? 404 : 200, contentType: "text/plain", body: revoked ? "" : "Approved text\n<script>private()</script>\n=SUM(A1:A2)", headers: { "cache-control": "no-store" } }) }
      if (url.pathname.startsWith("/api/public/workspace-page-assets/")) return route.fulfill({ status: 404, body: "", headers: { "cache-control": "no-store" } })
      return route.continue()
    })
    try {
      await page.goto(origin, { waitUntil: "domcontentloaded" })
      await page.getByRole("heading", { level: 1, name: "Published community organization" }).waitFor()
      await page.addStyleTag({ content: "html{font-size:200%}" })
      expect(await page.locator("html").evaluate(element => element.classList.contains("dark"))).toBe(colorScheme === "dark")
      expect(await page.getByRole("heading", { level: 1 }).count()).toBe(1)
      const brand = await page.locator("main > header span[aria-hidden]").first().evaluate(element => ({ background: getComputedStyle(element).backgroundColor, foreground: getComputedStyle(element).color }))
      expect(brand).toEqual({ background: "rgb(59, 130, 246)", foreground: "rgb(0, 0, 0)" })
      expect(await page.locator("input,textarea,[contenteditable=true]").count()).toBe(0)
      expect(documentReads).toBe(0)
      await page.keyboard.press("Tab")
      expect(await page.getByRole("link", { name: "Public information" }).evaluate(element => element === document.activeElement)).toBe(true)
      await page.keyboard.press("Tab")
      expect(await page.getByRole("region", { name: "Notes table" }).evaluate(element => element === document.activeElement)).toBe(true)
      const bounds = await page.getByRole("article", { name: "Gathering" }).locator("dd").last().evaluate(element => {
        const rect = element.getBoundingClientRect(), parent = element.closest('[data-workspace-node-part="body"]')!.getBoundingClientRect()
        return { left: rect.left, right: rect.right, parentLeft: parent.left, parentRight: parent.right }
      })
      expect(bounds.left).toBeGreaterThanOrEqual(bounds.parentLeft); expect(bounds.right).toBeLessThanOrEqual(bounds.parentRight)
      const read = page.getByRole("button", { name: "Read document" }); await read.focus(); await page.keyboard.press("Enter")
      await page.getByRole("region", { name: /contents$/ }).waitFor()
      expect(await page.locator("pre").innerText()).toContain("<script>private()</script>")
      expect(await page.locator("pre script,pre a").count()).toBe(0)
      await page.getByRole("button", { name: "Close document" }).click(); revoked = true
      await page.getByRole("button", { name: "Read document" }).click(); await page.getByText("Document unavailable.", { exact: true }).waitFor()
      expect(await page.locator("pre").count()).toBe(0)
      const image = page.getByRole("article", { name: "Workshop image" }); await image.scrollIntoViewIfNeeded()
      await image.getByText("Image unavailable. Reload the page.").waitFor()
      const controls = await page.locator("button,a[href*='docs.google.com']").evaluateAll(elements => elements.map(element => {
        const rect = element.getBoundingClientRect(), parent = element.closest('[data-workspace-node-part="body"]')!.getBoundingClientRect(); return { label: element.textContent, left: rect.left, right: rect.right, parentLeft: parent.left, parentRight: parent.right, height: rect.height, scrollWidth: element.scrollWidth, clientWidth: element.clientWidth, scrollHeight: element.scrollHeight, clientHeight: element.clientHeight, clipped: element.scrollHeight > element.clientHeight || element.scrollWidth > element.clientWidth }
      }))
      expect(controls.filter(item => item.left < item.parentLeft || item.right > item.parentRight || item.height < 44 || item.clipped)).toEqual([])
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320)
      expect(external).toEqual([]); expect(errors).toEqual([])
      await page.screenshot({ path: `/tmp/ch-s06-public-reading-${colorScheme}.png`, fullPage: true })
    } finally { if(errors.length) console.error(errors); await context.close() }
  }, 45000)
  it.each(["light", "dark"] as const)("reviews actual selected-content controls without publishing and invalidates changed draft preview in %s", async colorScheme => {
    const context = await browser.newContext({ viewport: { width: 320, height: 840 }, isMobile: true, hasTouch: true, colorScheme, reducedMotion: "reduce" })
    const page = await context.newPage(); page.setDefaultTimeout(5000)
    page.on("pageerror", error => console.error(error.stack))
    await page.route("**/*", route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort())
    try {
      await page.goto(`${origin}/?review`, { waitUntil: "domcontentloaded" })
      const title = page.getByRole("textbox", { name: "Page title" }); await title.waitFor()
      await page.addStyleTag({ content: "html{font-size:200%}" }); await title.fill("Reviewed community page")
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320)
      expect(await page.getByText("Named first", { exact: true }).evaluate(element => element.getBoundingClientRect().width)).toBeGreaterThan(120)
      await page.screenshot({ path: `/tmp/ch-b1-sharing-${colorScheme}.png`, fullPage: true })
      const actions = page.getByRole("button", { name: "Page actions", exact: true })
      await actions.focus(); await page.keyboard.press("Enter")
      await page.getByRole("menuitem", { name: "Save draft", exact: true }).waitFor()
      await page.keyboard.press("Escape")
      expect(await actions.evaluate(element => element === document.activeElement)).toBe(true)
      await page.getByRole("button", { name: "Preview", exact: true }).focus(); await page.keyboard.press("Enter")
      const preview = page.getByLabel("Public page preview"); await preview.waitFor()
      expect(await preview.innerText()).toContain("Fixture organization")
      expect(await preview.innerText()).toContain("Reviewed community page")
      await page.getByRole("button", { name: "Edit", exact: true }).focus()
      await page.keyboard.press("Enter")
      await title.waitFor()
      await title.fill("Private changed draft")
      expect(await preview.count()).toBe(0)
      const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("sharing-canvas-fixture")!))
      expect(saved.calls.filter((call: { action: string }) => call.action === "review")).toHaveLength(1)
      expect(saved.calls.some((call: { action: string }) => call.action === "commit")).toBe(false)
      expect(saved.pages).toEqual([])
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320)
    } finally { await context.close() }
  }, 45000)
})
