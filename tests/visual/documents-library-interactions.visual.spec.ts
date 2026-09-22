import { expect, test, type Page } from "@playwright/test"
import { prepareVisualPage, reviewedPlatformScreenshotName } from "./reviewed-platform-screenshot"

test.beforeEach(async ({ page }) => {
  await prepareVisualPage(page)
})

type FixtureFile = {
  id: string
  name: string
  mimeType: string
  sizeBytes: number
  deletedAt: string | null
  createdAt: string
  updatedAt: string
}

async function openLibrary(page: Page, failTrash = false) {
  let files: FixtureFile[] = ["alpha.bin", "beta.csv"].map((name, index) => ({
    id: String(index),
    name,
    mimeType: index ? "text/csv" : "application/octet-stream",
    sizeBytes: 10,
    deletedAt: null,
    createdAt: "2026-09-04T12:00:00Z",
    updatedAt: "2026-09-04T12:00:00Z",
  }))
  let uploads = 0
  await page.route("**/api/integrations/google-drive/**", (route) =>
    route.fulfill({
      json: {
        connection: { connected: false },
        documents: [
          {
            id: "drive-1",
            name: "Drive budget.xlsx",
            mimeType:
              "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            webViewLink: "https://drive.google.com/file/d/fixture",
            status: "available",
            modifiedAt: null,
          },
        ],
      },
    })
  )
  await page.route("**/documents-qa-download", (route) =>
    route.fulfill({
      body: "test content",
      contentType: "application/octet-stream",
    })
  )
  await page.route(
    "**/api/account/organization-document-files**",
    async (route) => {
      const request = route.request()
      const method = request.method()
      if (method === "GET") {
        if (new URL(request.url()).searchParams.has("id")) {
          await route.fulfill({
            json: { url: "http://localhost:3000/documents-qa-download" },
          })
        } else {
          await route.fulfill({
            json: {
              files,
              quota: {
                usedBytes: files.reduce((sum, file) => sum + file.sizeBytes, 0),
                limitBytes: 5368709120,
              },
            },
          })
        }
        return
      }
      if (method === "POST") {
        uploads += 1
        const file = {
          ...files[0],
          id: `upload-${uploads}`,
          name: "dropped.bin",
          sizeBytes: 5,
          deletedAt: null,
        }
        files = [...files, file]
        await route.fulfill({ json: { file } })
        return
      }
      const payload = request.postDataJSON() as { id: string; action?: string }
      if (method === "PATCH") {
        if (failTrash && payload.id === "1" && payload.action === "trash") {
          await route.fulfill({
            status: 500,
            json: { error: "Fixture storage failure" },
          })
          return
        }
        files = files.map((file) =>
          file.id === payload.id
            ? {
                ...file,
                deletedAt:
                  payload.action === "trash" ? "2026-09-04T12:00:00Z" : null,
              }
            : file
        )
        await route.fulfill({
          json: { file: files.find((file) => file.id === payload.id) },
        })
        return
      }
      files = files.filter((file) => file.id !== payload.id)
      await route.fulfill({ json: { ok: true } })
    }
  )
  await page.goto("/visual-regression/documents-banner")
  await expect(
    page.getByRole("heading", { name: "alpha.bin", exact: true })
  ).toBeVisible()
  return { uploadCount: () => uploads }
}

function card(page: Page, name: string) {
  return page
    .locator("article")
    .filter({ has: page.getByRole("heading", { name, exact: true }) })
}

for (const colorScheme of ["light", "dark"] as const) {
  for (const width of [390, 1440]) {
    test(`Documents list fits ${width}px in ${colorScheme} mode`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 })
      await page.emulateMedia({ colorScheme, reducedMotion: "reduce" })
      await openLibrary(page)
      if (colorScheme === "dark")
        await page.evaluate(() =>
          document.documentElement.classList.add("dark")
        )
      await page.getByRole("button", { name: "List view", exact: true }).click()
      await page
        .getByRole("textbox", { name: "Search documents" })
        .fill("alpha")
      const banner = page.locator(
        '[data-react-grab-owner-id="organization-documents:banner"]'
      )
      await expect(
        page.getByRole("heading", { name: "alpha.bin", exact: true })
      ).toBeVisible()
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth
        )
      ).toBe(true)
      await expect(banner).toHaveScreenshot(
        reviewedPlatformScreenshotName(`documents-list-${width}-${colorScheme}.png`),
        { animations: "disabled" }
      )
    })
  }
}

test("selection survives list mode and downloads without popups", async ({
  page,
}) => {
  await openLibrary(page)
  await page
    .getByRole("button", { name: "Select alpha.bin", exact: true })
    .click()
  await card(page, "beta.csv").locator("button").first().click()
  await expect(page.getByText("2 selected", { exact: true })).toBeVisible()
  await expect(card(page, "alpha.bin").locator("button").first()).toHaveClass(
    /border-foreground/
  )
  await page.mouse.move(0, 0)
  await card(page, "alpha.bin").locator("button").first().blur()
  await expect(
    card(page, "alpha.bin").locator('button[aria-pressed="true"]')
  ).toHaveCSS("opacity", "1")
  await page.getByRole("button", { name: "List view", exact: true }).click()
  await expect(page.getByText("2 selected", { exact: true })).toBeVisible()
  await expect(
    page.getByRole("heading", { name: "Drive budget.xlsx" })
  ).toBeVisible()
  const downloads: string[] = []
  page.on("download", (download) =>
    downloads.push(download.suggestedFilename())
  )
  await page
    .getByRole("button", { name: "Download 2 selected documents", exact: true })
    .click()
  await expect.poll(() => downloads).toEqual(["alpha.bin", "beta.csv"])
  await expect(page.getByText("2 selected", { exact: true })).toHaveCount(0)
})

test("failed batch deletion keeps failed files selected", async ({ page }) => {
  await openLibrary(page, true)
  await page
    .getByRole("button", { name: "Select alpha.bin", exact: true })
    .click()
  await card(page, "beta.csv").locator("button").first().click()
  page.once("dialog", (dialog) => dialog.accept())
  await page
    .getByRole("button", { name: "Delete 2 selected documents", exact: true })
    .click()
  await expect(page.getByText("1 selected", { exact: true })).toBeVisible()
  await expect(
    card(page, "beta.csv").locator('button[aria-pressed="true"]')
  ).toBeVisible()
  await expect(
    page.getByRole("heading", { name: "alpha.bin", exact: true })
  ).toHaveCount(0)
})

test("trash, restore, and permanent deletion update cards and storage", async ({
  page,
}) => {
  await openLibrary(page)
  const usage = page.getByRole("meter")
  await expect(usage).toHaveAttribute("aria-valuenow", "20")
  await page
    .getByRole("button", { name: "Manage alpha.bin", exact: true })
    .click()
  await page.getByRole("menuitem", { name: "Move to Recently Deleted" }).click()
  await expect(usage).toHaveAttribute("aria-valuenow", "20")
  await page.getByRole("button", { name: /^Filter documents/ }).click()
  await page.getByRole("menuitemcheckbox", { name: "Recently deleted" }).click()
  await page.getByRole("button", { name: "List view", exact: true }).click()
  await expect(
    page.getByRole("heading", { name: "alpha.bin", exact: true })
  ).toBeVisible()
  await page
    .getByRole("button", { name: "Manage alpha.bin", exact: true })
    .click()
  await page.getByRole("menuitem", { name: "Restore", exact: true }).click()
  await expect(
    page.getByRole("heading", { name: "alpha.bin", exact: true })
  ).toHaveCount(0)
  await page.getByRole("button", { name: /^Filter documents/ }).click()
  await page.getByRole("menuitemcheckbox", { name: "Recently deleted" }).click()
  await page
    .getByRole("button", { name: "Manage alpha.bin", exact: true })
    .click()
  await page.getByRole("menuitem", { name: "Move to Recently Deleted" }).click()
  await page.getByRole("button", { name: /^Filter documents/ }).click()
  await page.getByRole("menuitemcheckbox", { name: "Recently deleted" }).click()
  await page
    .getByRole("button", { name: "Manage alpha.bin", exact: true })
    .click()
  page.once("dialog", (dialog) => dialog.accept())
  await page.getByRole("menuitem", { name: "Delete permanently" }).click()
  await expect(usage).toHaveAttribute("aria-valuenow", "10")
})

test("only the file picker uploads general files; the library is not a dropzone", async ({
  page,
}) => {
  const fixture = await openLibrary(page)
  await page.getByRole("button", { name: "List view", exact: true }).click()
  const transfer = await page.evaluateHandle(() => {
    const data = new DataTransfer()
    data.items.add(new File(["hello"], "dropped.bin"))
    return data
  })
  const banner = page.locator(
    '[data-react-grab-owner-id="organization-documents:banner"]'
  )
  await banner.dispatchEvent("dragenter", { dataTransfer: transfer })
  await expect(page.getByText("Drop files to upload")).toHaveCount(0)
  await banner.dispatchEvent("drop", { dataTransfer: transfer })
  expect(fixture.uploadCount()).toBe(0)
  await page.getByRole("button", { name: "New", exact: true }).click()
  const chooser = page.waitForEvent("filechooser")
  await page.getByRole("menuitem", { name: "Upload files" }).click()
  await (
    await chooser
  ).setFiles({
    name: "dropped.bin",
    mimeType: "application/octet-stream",
    buffer: Buffer.from("hello"),
  })
  await expect(
    page.getByRole("heading", { name: "dropped.bin", exact: true })
  ).toBeVisible()
  await expect.poll(fixture.uploadCount).toBe(1)
})
