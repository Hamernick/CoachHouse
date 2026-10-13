import { expect, test } from "@playwright/test"

test.use({ extraHTTPHeaders: { "x-coach-house-visual-regression": "1" } })

for (const colorScheme of ["light", "dark"] as const) {
  test(`shared controls keep visible, contrasting focus (${colorScheme})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme })
    await page.goto("/visual-regression/project-feedback?scenario=accelerator")
    // The lazy-mounted setup form focuses its first field. Wait for that
    // initial focus before checking deliberate pointer/keyboard transitions.
    const input = page.getByTestId("setup-preview").locator("#orgName")
    await expect(input).toBeFocused()
    const button = page.getByRole("button", { name: /^(Fail|Allow) saves$/ })
    await button.click()
    await expect(button).not.toHaveCSS("outline-style", "solid")
    await page.keyboard.press("Shift+Tab")
    await page.keyboard.press("Tab")
    await expect(button).toBeFocused()
    await expect(button).toHaveCSS("outline-width", "2px")
    await expect(button).toHaveCSS("outline-style", "solid")

    const notes = page.getByTestId("lesson-preview").locator("textarea")
    for (const control of [input, notes]) {
      await control.click()
      await expect(control).not.toHaveCSS("outline-style", "solid")
      await page.keyboard.press("a")
      await expect(control).not.toHaveCSS("outline-style", "solid")
      await page.keyboard.press("Shift+Tab")
      await page.keyboard.press("Tab")
      await expect(control).toBeFocused()
      await expect(control).toHaveCSS("outline-width", "2px")
      await expect(control).toHaveCSS("outline-style", "solid")
      await expect(control).toHaveCSS("outline-offset", "2px")
    }

    const contrastRatios = await notes.evaluate((element) => {
      const styles = getComputedStyle(element)
      const canvas = document.createElement("canvas")
      canvas.width = canvas.height = 1
      const context = canvas.getContext("2d")!
      const luminance = (color: string) => {
        context.clearRect(0, 0, 1, 1)
        context.fillStyle = color
        context.fillRect(0, 0, 1, 1)
        const channels = Array.from(context.getImageData(0, 0, 1, 1).data)
          .slice(0, 3)
          .map((value) => {
            const channel = value / 255
            return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
          })
        return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722
      }
      const focus = luminance(styles.outlineColor)
      return ["--background", "--card", "--muted", "--accent", "--sidebar"].map((token) => {
        const surface = luminance(styles.getPropertyValue(token))
        return (Math.max(focus, surface) + 0.05) / (Math.min(focus, surface) + 0.05)
      })
    })
    expect(Math.min(...contrastRatios)).toBeGreaterThanOrEqual(3)

    await input.evaluate((element) => element.setAttribute("aria-invalid", "true"))
    await input.click()
    await expect(input).not.toHaveCSS("outline-style", "solid")
    await page.keyboard.press("Shift+Tab")
    await page.keyboard.press("Tab")
    await expect(input).toBeFocused()
    await expect(input).toHaveCSS("outline-width", "2px")
    await expect(input).toHaveCSS("outline-style", "solid")

    await page.emulateMedia({ forcedColors: "active" })
    await input.click()
    await expect(input).toHaveCSS("outline-width", "2px")
    await expect(input).toHaveCSS("outline-style", "solid")
    await expect(input).not.toHaveCSS("outline-color", "rgba(0, 0, 0, 0)")
  })
}


test("resource search distinguishes pointer and keyboard focus", async ({ page }) => {
  await page.goto("/resources")
  const input = page.locator("[data-public-map-search-input]")
  await input.click()
  await expect(input).toBeFocused()
  await expect(input).not.toHaveCSS("outline-style", "solid")
  await page.keyboard.press("a")
  await expect(input).not.toHaveCSS("outline-style", "solid")
  await page.keyboard.press("Shift+Tab")
  await page.keyboard.press("Tab")
  await expect(input).toBeFocused()
  await expect(input).toHaveCSS("outline-style", "solid")
  await expect(input).toHaveCSS("outline-offset", "-3px")
  await input.click()
  await expect(input).not.toHaveCSS("outline-style", "solid")
})

test("touch search focus remains usable without a ring", async ({ browser }) => {
  const context = await browser.newContext({ hasTouch: true, viewport: { width: 390, height: 844 } })
  const page = await context.newPage()
  await page.goto("/resources")
  const input = page.locator("[data-public-map-search-input]")
  await input.tap()
  await expect(input).toBeFocused()
  await expect(input).not.toHaveCSS("outline-style", "solid")
  await page.keyboard.press("Tab")
  await page.keyboard.press("Shift+Tab")
  await expect(input).toBeFocused()
  await expect(input).toHaveCSS("outline-style", "solid")
  await context.close()
})
