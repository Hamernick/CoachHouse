import { expect, test, type Locator } from "@playwright/test"
import { build } from "vite"
import tailwindcss from "@tailwindcss/postcss"
import { resolve } from "node:path"

let script = ""
let css = ""

test.beforeAll(async () => {
  const result = await build({
    configFile: false,
    logLevel: "error",
    resolve: { alias: { "@": resolve("src") } },
    esbuild: { jsx: "automatic" },
    css: { postcss: { plugins: [tailwindcss()] } },
    define: { "process.env.NODE_ENV": JSON.stringify("development") },
    build: { write: false, minify: false, rollupOptions: { input: resolve(__dirname, "fixture.tsx") } },
  })
  if (Array.isArray(result) || !("output" in result)) throw new Error("Expected one fixture bundle")
  for (const entry of result.output) {
    if (entry.type === "chunk") script += entry.code
    else if (entry.fileName.endsWith(".css")) css += entry.source
  }
})

test.beforeEach(async ({ page }) => {
  await page.setContent('<div id="root"></div>')
  await page.addStyleTag({ content: css })
  await page.addScriptTag({ type: "module", content: script })
  await expect(page.locator("#vertical")).toHaveAttribute("data-scroll-fade-end", "visible")
})

async function edges(locator: Locator, start: string, end: string) {
  await expect(locator).toHaveAttribute("data-scroll-fade-start", start)
  await expect(locator).toHaveAttribute("data-scroll-fade-end", end)
}
const mask = (locator: Locator) => locator.evaluate(el => getComputedStyle(el).maskImage)

test("top, partial scroll, middle and final row have truthful masks", async ({ page }) => {
  const list = page.locator("#vertical")
  await edges(list, "hidden", "visible")
  expect(await mask(list)).toContain("32px")
  await list.evaluate(el => { el.scrollTop = 5 })
  await edges(list, "visible", "visible")
  await expect.poll(() => mask(list)).toContain("5px")
  await list.evaluate(el => { el.scrollTop = 150 })
  await expect.poll(() => list.evaluate(el => el.style.getPropertyValue("--scroll-fade-start-distance"))).toBe("150px")
  await list.evaluate(el => { el.scrollTop = el.scrollHeight })
  await edges(list, "visible", "hidden")
  await expect.poll(() => mask(list)).toContain("100%")
})

test("nonoverflowing, nested and unmeasured regions stay fully visible", async ({ page }) => {
  for (const id of ["short", "inner", "unmanaged"]) expect(await mask(page.locator(`#${id}`))).toBe("none")
  await page.locator("#outer").evaluate(el => { el.scrollTop = 40 })
  await edges(page.locator("#outer"), "visible", "visible")
  expect(await mask(page.locator("#inner"))).toBe("none")
})

test("horizontal edges follow LTR and RTL physical scroll positions", async ({ page }) => {
  await edges(page.locator("#horizontal"), "hidden", "visible")
  await page.locator("#horizontal").evaluate(el => { el.scrollLeft = el.scrollWidth })
  await edges(page.locator("#horizontal"), "visible", "hidden")
  await edges(page.locator("#rtl"), "visible", "hidden")
  await page.locator("#rtl").evaluate(el => { el.scrollLeft = -100 })
  await edges(page.locator("#rtl"), "visible", "visible")
  await page.locator("#rtl").evaluate(el => { el.scrollLeft = -el.scrollWidth })
  await edges(page.locator("#rtl"), "hidden", "visible")
})

test("resizing and asynchronously changing content recompute overflow", async ({ page }) => {
  const list = page.locator("#vertical")
  await list.evaluate(el => { el.style.height = "600px" })
  await edges(list, "hidden", "hidden")
  expect(await mask(list)).toBe("none")
  await page.locator("#rows").evaluate(el => { el.style.height = "900px" })
  await edges(list, "hidden", "visible")
  await page.locator("#rows").evaluate(el => { el.replaceChildren(); el.style.height = "0px" })
  await edges(list, "hidden", "hidden")
})

test("keyboard focus is never faded and disable/re-enable cleans measurement", async ({ page }) => {
  const viewport = page.locator("#focus")
  await viewport.focus()
  expect(await mask(viewport)).toBe("none")
  await page.keyboard.press("Tab")
  await expect(viewport.getByRole("textbox", { name: "First field" })).toBeFocused()
  expect(await mask(viewport)).toBe("none")
  await page.getByRole("button", { name: "Toggle fades" }).click()
  await expect(page.locator("#vertical")).not.toHaveAttribute("data-scroll-fade-managed", "true")
  expect(await page.locator("#vertical").evaluate(el => el.style.getPropertyValue("--scroll-fade-start-distance"))).toBe("")
  await page.getByRole("button", { name: "Toggle fades" }).click()
  await edges(page.locator("#vertical"), "hidden", "visible")
})

test("short panes cap fade size and reduced motion keeps edge accuracy", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" })
  const list = page.locator("#vertical")
  await list.evaluate(el => { el.style.height = "40px"; el.scrollTop = 100 })
  await edges(list, "visible", "visible")
  expect(await list.evaluate(el => getComputedStyle(el).animationName)).toBe("none")
  expect(await mask(list)).toContain("25%")
  await list.evaluate(el => { el.scrollTop = el.scrollHeight })
  await edges(list, "visible", "hidden")
})
