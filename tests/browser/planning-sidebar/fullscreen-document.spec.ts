import { expect, test } from "@playwright/test"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"

let script = "", css = ""
test.beforeAll(() => {
  const artifact = JSON.parse(readFileSync(resolve("test-results/fullscreen-document-bundle.json"), "utf8"))
  script = artifact.script; css = artifact.css
})
test.beforeEach(async ({ page }) => {
  await page.route("https://planning.test/", route => route.fulfill({ contentType: "text/html", body: '<div id="root"></div>' }))
  await page.goto("https://planning.test/")
  await page.addStyleTag({ content: css })
  await page.addScriptTag({ content: script, type: "module" })
})

test("fullscreen document covers planning and viewport controls and restores focus", async ({ page }, testInfo) => {
  const open = page.getByRole("button", { name: "Preview document" })
  for (const mobile of [false, true]) {
    if (mobile) { await page.setViewportSize({ width: 390, height: 844 }); await page.emulateMedia({ reducedMotion: "reduce" }) }
    await open.click()
    const viewer = page.getByRole("dialog", { name: "Fullscreen document" })
    await expect(viewer).toBeVisible()
    await expect.poll(() => viewer.evaluate(element => {
      const bounds = element.getBoundingClientRect()
      const previous = document.body.style.pointerEvents
      document.body.style.pointerEvents = "auto"
      try {
        return [[24, 24], [24, 120], [bounds.width - 24, 24], [bounds.width - 24, bounds.height - 100]].every(([x, y]) => {
          const top = document.elementFromPoint(bounds.x + x, bounds.y + y)
          return top && (top === element || element.contains(top)) &&
            element.parentElement?.classList.contains("workspace-layout-surface")
        })
      } finally { document.body.style.pointerEvents = previous }
    })).toBe(true)
    await page.screenshot({ path: testInfo.outputPath(mobile ? "fullscreen-mobile.png" : "fullscreen-desktop.png") })
    await expect(page.getByRole("textbox", { name: "Retained planning draft" })).toHaveCount(0)
    await page.getByRole("textbox", { name: "Document text" }).fill("Readable document")
    if (mobile) await page.getByRole("button", { name: "Exit full screen" }).click()
    else await page.keyboard.press("Escape")
    await expect(viewer).toHaveCount(0)
    await expect(open).toBeFocused()
    await expect(page.getByRole("textbox", { name: "Retained planning draft" })).toHaveValue("Keep this draft")
    await page.getByRole("textbox", { name: "Retained planning draft" }).fill("Keep this draft")
  }
})
