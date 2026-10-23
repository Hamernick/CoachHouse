import { expect, test, type Page } from "@playwright/test"

async function openBanner(page: Page, colorScheme: "light" | "dark") {
  await page.emulateMedia({ colorScheme, reducedMotion: "reduce" })
  await page.goto("/visual-regression/documents-banner")
  await expect(page.getByRole("heading", { name: "Documents", exact: true })).toBeVisible()
  if (colorScheme === "dark") await page.evaluate(() => document.documentElement.classList.add("dark"))
}

for (const colorScheme of ["light", "dark"] as const) {
  for (const width of [390, 1440]) {
    test(`Core Document choices and actions ${colorScheme} ${width}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 })
      await openBanner(page, colorScheme)
      const banner = page.locator('[data-react-grab-owner-id="organization-documents:banner"]')
      await expect.soft(banner).toHaveScreenshot(`documents-banner-${colorScheme}-${width}.png`, { animations: "disabled", caret: "hide", scale: "css" })
      await page.getByRole("button", { name: "Start Vision", exact: true }).click()
      await expect(page.getByRole("button", { name: "Start writing", exact: true })).toBeVisible()
      await expect.soft(page.getByRole("dialog")).toHaveScreenshot(`core-document-choice-${colorScheme}-${width}.png`)
      await page.getByRole("button", { name: "Choose from Google Drive", exact: true }).click()
      const title = page.getByRole("link", { name: "Open Vision in Google Drive" })
      await expect(title).toHaveText("Vision")
      await expect(title).toHaveAttribute("href", "https://docs.google.com/document/d/visual_fixture_123/edit")
      await page.getByRole("button", { name: "View only", exact: true }).click()
      await expect(page.getByRole("button", { name: "Manage Vision", exact: true })).toHaveCount(0)
      await expect(title).toHaveAttribute("target", "_blank")
      await page.getByRole("button", { name: "Enable editing", exact: true }).click()
      await page.getByRole("button", { name: "Manage Vision", exact: true }).focus()
      await page.keyboard.press("Enter")
      await expect(page.getByRole("menuitem", { name: "Edit", exact: true })).toBeVisible()
      await expect(page.getByRole("menuitem", { name: "Replace with Google Drive…", exact: true })).toBeVisible()
      await expect(page.getByRole("menuitem", { name: "Remove", exact: true })).toBeVisible()
      await expect.soft(page.getByRole("menu")).toHaveScreenshot(`core-document-menu-${colorScheme}-${width}.png`)
      page.once("dialog", (dialog) => dialog.accept())
      await page.getByRole("menuitem", { name: "Remove", exact: true }).click()
      await expect(page.getByRole("button", { name: "Start Vision", exact: true })).toBeVisible()
      await page.getByRole("button", { name: "View only", exact: true }).click()
      await expect(page.getByRole("button", { name: "Manage Vision", exact: true })).toHaveCount(0)
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    })
  }
}

test("empty Core Document opens directly in the editor with Drive available", async ({ page }) => {
  await openBanner(page, "light")
  await page.getByRole("button", { name: "Show editor", exact: true }).click()
  await expect(page.getByRole("button", { name: "Choose from Google Drive", exact: true })).toBeVisible()
  await expect(page.getByRole("button", { name: "Start writing", exact: true })).toHaveCount(0)
  await expect(page.locator('[contenteditable="true"]')).toBeVisible()
  await expect(page.getByRole("button", { name: "Paste options", exact: true })).toBeVisible()
  await expect(page.getByRole("button", { name: "Choose from Google Drive", exact: true })).toBeVisible()
})
