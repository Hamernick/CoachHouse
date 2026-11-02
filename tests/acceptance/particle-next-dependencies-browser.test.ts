import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { chromium, type Browser } from "@playwright/test"

const origin = process.env.PARTICLE_NEXT_FIXTURE_ORIGIN
// Explicit opt-in to the existing local server; never start/restart it or use a hosted origin.
describe.skipIf(!origin)("Particle dependencies in actual Next", () => {
  let browser: Browser
  beforeAll(async () => {
    const target = new URL(origin!)
    if (target.hostname !== "127.0.0.1" || target.port !== "3008" || target.protocol !== "http:") throw new Error("Use the verified local Next preview only.")
    browser = await chromium.launch({ headless: true })
  })
  afterAll(async () => { await browser?.close() })
  it.each(["light", "dark"] as const)("renders real dependencies and preserves editing through progress in %s", async colorScheme => {
    const context = await browser.newContext({ viewport: { width: 1100, height: 900 }, colorScheme })
    const page = await context.newPage(), errors: string[] = [], external: string[] = []
    page.on("pageerror", error => errors.push(error.message))
    await page.routeWebSocket(/.*/, socket => {
      const requested = new URL(socket.url())
      if (requested.hostname === "127.0.0.1" && requested.port === "3008") socket.connectToServer()
      else { external.push(requested.origin); socket.close() }
    })
    await page.route("**/*", route => {
      const requested = new URL(route.request().url())
      if (requested.origin === origin) return route.continue()
      external.push(requested.origin + requested.pathname)
      return route.abort()
    })
    const response = await page.goto(`${origin}/visual-regression/workspace-ontology?fixture=dependencies`, { waitUntil: "domcontentloaded" })
    expect(response?.status()).toBe(200)
    const fixture = page.getByRole("region", { name: "Particle dependency qualification" })
    await fixture.getByLabel("Plan title", { exact: true }).waitFor()
    // SSR controls can precede hydration; wait for the actual stream listener.
    await page.locator("section[data-progress-ready=true]").waitFor()
    // The renderer receives actual canonical artifact shapes; strings are not a mock component.
    await expect.poll(() => fixture.locator('[aria-label="Typed artifact preview"]').innerText()).toContain("Hello neighbors")
    const title = fixture.getByLabel("Item 1 title", { exact: true })
    await title.fill("Reviewed invitation")
    await title.evaluate(element => (element as HTMLInputElement).setSelectionRange(2, 7))
    await page.evaluate(() => window.dispatchEvent(new Event("particle-dependency-progress")))
    await expect.poll(() => fixture.locator("output").innerText()).toContain("planning · 1")
    expect(await title.inputValue()).toBe("Reviewed invitation")
    expect(await title.evaluate(element => element === document.activeElement)).toBe(true)
    expect(await title.evaluate(element => [(element as HTMLInputElement).selectionStart, (element as HTMLInputElement).selectionEnd])).toEqual([2, 7])
    await page.keyboard.press("Tab")
    expect(await fixture.getByRole("textbox", { name: "Item 1 details", exact: true }).evaluate(element => element === document.activeElement)).toBe(true)
    const preview = fixture.locator('[aria-label="Typed artifact preview"]')
    expect(await preview.innerText()).toContain("Reviewed invitation")
    // Native form preview is a clearly labeled local rehearsal, not a submit action.
    expect(await preview.getByRole("button", { name: "Check answers" }).count()).toBe(1)
    expect(await preview.getByRole("button", { name: /publish|submit|save/i }).count()).toBe(0)
    expect(await page.locator("html").evaluate(element => element.classList.contains("dark"))).toBe(colorScheme === "dark")
    const contrast = await fixture.locator("header p").evaluate(element => {
      const canvas = document.createElement("canvas"), context = canvas.getContext("2d")!
      const rgb = (color: string) => { context.clearRect(0, 0, 1, 1); context.fillStyle = color; context.fillRect(0, 0, 1, 1); return [...context.getImageData(0, 0, 1, 1).data].slice(0, 3) }
      const luminance = (color: number[]) => color.map(channel => { const value = channel / 255; return value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4 }).reduce((sum, value, index) => sum + value * [.2126, .7152, .0722][index], 0)
      const foreground = luminance(rgb(getComputedStyle(element).color)), background = luminance(rgb(getComputedStyle(document.body).backgroundColor))
      return (Math.max(foreground, background) + .05) / (Math.min(foreground, background) + .05)
    })
    expect(contrast).toBeGreaterThanOrEqual(4.5)
    await page.evaluate(() => window.scrollTo(0, 0))
    await page.screenshot({ path: `/tmp/ch-s11-next-${colorScheme}.png`, fullPage: true })
    expect(errors).toEqual([])
    // Existing app-shell development scripts are blocked, not executed. The
    // selected dependencies must introduce no other external request.
    expect(external.every(url => [
      "https://unpkg.com/react-grab@0.2.0/dist/index.global.js",
      "https://va.vercel-scripts.com/v1/script.debug.js",
      "https://va.vercel-scripts.com/v1/speed-insights/script.debug.js",
    ].includes(url))).toBe(true)
    await context.close()
  }, 90000)
  it("keeps the focused fixture contained at320px with touch/reduced motion and enlarged text", async () => {
    const context = await browser.newContext({ viewport: { width: 320, height: 900 }, isMobile: true, hasTouch: true, reducedMotion: "reduce" })
    const page = await context.newPage()
    await page.routeWebSocket(/.*/, socket => {
      const requested = new URL(socket.url())
      if (requested.hostname === "127.0.0.1" && requested.port === "3008") socket.connectToServer()
      else socket.close()
    })
    await page.route("**/*", route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort())
    await page.goto(`${origin}/visual-regression/workspace-ontology?fixture=dependencies`, { waitUntil: "domcontentloaded" })
    const title = page.getByLabel("Plan title", { exact: true }); await title.waitFor()
    await page.locator("section[data-progress-ready=true]").waitFor()
    expect(await page.evaluate(() => document.activeElement?.tagName)).not.toMatch(/INPUT|TEXTAREA/)
    await page.addStyleTag({ content: "html{font-size:200%}" })
    await title.fill("A deliberately long title that stays editable on a narrow screen")
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= 320)).toBe(true)
    const question = page.locator('[aria-label="Question order"]')
    const overflow = await question.evaluate(root => {
      const bounds = root.getBoundingClientRect()
      return [...root.querySelectorAll<HTMLElement>("button,input,textarea")].filter(element => {
        const rect = element.getBoundingClientRect()
        return rect.width > 0 && (rect.left < bounds.left - 1 || rect.right > bounds.right + 1)
      }).map(element => element.getAttribute("aria-label") || element.tagName)
    })
    expect(overflow).toEqual([])
    const add = page.getByRole("button", { name: "Add item", exact: true })
    const box = await add.boundingBox(); expect(box?.height).toBeGreaterThanOrEqual(44)
    await add.click()
    await expect.poll(() => page.getByLabel("Item 3 title", { exact: true }).evaluate(element => element === document.activeElement)).toBe(true)
    expect(await title.inputValue()).toContain("deliberately long")
    await page.screenshot({ path: "/tmp/ch-s11-next-mobile-enlarged.png", fullPage: true })
    await context.close()
  }, 90000)
})
