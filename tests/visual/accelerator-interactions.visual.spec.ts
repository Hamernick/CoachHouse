import { expect, test } from "@playwright/test"

test.use({ extraHTTPHeaders: { "x-coach-house-visual-regression": "1" } })

for (const [width, colorScheme] of [[1440, "light"], [390, "dark"]] as const) {
  test(`accelerator completion, resources, and editable setup (${width})`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 })
    await page.emulateMedia({ colorScheme })
    await page.route("**/api/public/**", (route) => route.fulfill({ json: { available: true } }))
    await page.addInitScript(() => localStorage.setItem("onboardingDraftV2", JSON.stringify({ values: { orgName: "Stale name", orgSlug: "stale-url" } })))
    await page.goto("/visual-regression/project-feedback?scenario=accelerator")
    const lesson = page.getByTestId("lesson-preview")
    await expect(lesson.getByRole("button", { name: "AI", exact: true })).toHaveCount(0)

    const navigation = lesson.locator(":scope > header")
    await expect(navigation).toBeVisible()
    await expect(lesson.locator("article")).toHaveCount(0)
    await expect(navigation.getByRole("heading", { name: "Class video", exact: true })).toBeVisible()
    await expect(navigation.getByText("2 of 2", { exact: true })).toBeVisible()
    await expect(navigation.getByRole("button", { name: "Done reviewing this lesson" })).toBeVisible()
    const previous = navigation.getByRole("button", { name: "Previous accelerator step" })
    const next = navigation.getByRole("button", { name: "Next accelerator step" })
    await expect(page.getByTestId("accelerator-runtime").getByRole("button", { name: "Previous accelerator step" })).toHaveCount(0)
    await expect(page.getByTestId("accelerator-runtime").getByRole("button", { name: "Next accelerator step" })).toHaveCount(0)
    await expect(previous).toBeEnabled()
    await expect(next).toBeDisabled()
    await previous.click()
    await expect(previous).toBeDisabled()
    await expect(next).toBeEnabled()
    await expect(lesson.getByRole("heading", { name: "Introduction video", exact: true })).toBeVisible()
    await next.click()
    await expect(navigation.getByRole("heading", { name: "Class video", exact: true })).toBeVisible()
    await expect(lesson.locator("video")).toBeVisible()

    await page.getByRole("button", { name: "Fail saves", exact: true }).click()
    await lesson.getByRole("button", { name: "Done reviewing this lesson" }).click()
    await expect(page.getByText("Simulated save failure", { exact: true })).toBeVisible()
    await expect(lesson).toBeVisible()
    await expect(page.getByRole("status").filter({ hasText: "Persisted not started" })).toBeVisible()

    await page.getByRole("button", { name: "Allow saves", exact: true }).click()
    await lesson.locator("video").dispatchEvent("ended")
    await expect(page.getByRole("status").filter({ hasText: "Persisted completed" })).toBeVisible()
    await lesson.getByRole("button", { name: "Done reviewing this lesson" }).click()
    await expect(page.getByText("Overview: Completed", { exact: true })).toBeVisible()
    await expect(navigation.getByRole("button")).toHaveCount(0)
    await page.getByRole("button", { name: "Reopen lesson", exact: true }).click()
    await expect(page.getByRole("status").filter({ hasText: "Persisted completed" })).toBeVisible()

    await expect(page.getByTestId("resource-preview").getByRole("link", { name: "Open resource: Register your nonprofit" })).toHaveAttribute("href", "https://example.org/register")
    const setup = page.getByTestId("setup-preview")
    await expect(setup.locator("#orgName")).toHaveValue("Saved organization")
    await setup.locator("#orgName").fill("Updated organization")
    await expect(setup.locator("#orgSlug")).toHaveValue("stable-url")
    await setup.getByRole("button", { name: "Continue", exact: true }).click()
    await expect(setup.locator("#firstName")).toHaveValue("Test")
    // The Next.js development badge covers Back on narrow screens.
    await page.addStyleTag({ content: "nextjs-portal { visibility: hidden !important; }" })
    await setup.getByRole("button", { name: "Back", exact: true }).click()
    await expect(setup.locator("#orgName")).toHaveValue("Updated organization")
  })
}

for (const [width, height] of [[320, 640], [700, 900], [820, 480], [1024, 768]] as const) {
  test(`accelerator responsive controls and details (${width}x${height})`, async ({ page }) => {
    await page.setViewportSize({ width, height })
    await page.goto("/visual-regression/project-feedback?scenario=accelerator")
    const lesson = page.getByTestId("lesson-preview")
    const header = lesson.locator(":scope > header")
    const previous = header.getByRole("button", { name: "Previous accelerator step" })
    await expect(previous).toBeVisible()
    await expect.poll(() => lesson.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true)
    const videoBox = await lesson.locator("video").boundingBox()
    const lessonBox = await lesson.boundingBox()
    if (width >= 1024) expect(videoBox!.y + videoBox!.height).toBeLessThanOrEqual(lessonBox!.y + lessonBox!.height + 1)
    if (width < 1024) {
      const details = header.getByRole("button", { name: "Details", exact: true })
      await expect(details).toHaveCount(0)
      await expect(lesson.locator("aside")).toBeVisible()
      for (const control of [previous, header.getByRole("button", { name: "Done reviewing this lesson" })]) {
        const box = await control.boundingBox()
        expect(box!.height).toBeGreaterThanOrEqual(44)
        expect(box!.width).toBeGreaterThanOrEqual(44)
      }
      const dialog = lesson.locator("aside")
      const video = (await lesson.locator("video").boundingBox())!
      expect((await dialog.boundingBox())!.y).toBeGreaterThanOrEqual(video.y + video.height)
      await expect(dialog).toBeVisible()
      await dialog.getByRole("button", { name: "Resources", exact: true }).click()
      await expect(dialog.getByRole("link", { name: /Nonprofit formation reference/ })).toBeVisible()
      await dialog.getByRole("button", { name: "Coach", exact: true }).click()
      await expect(dialog.getByRole("button", { name: "Schedule a meeting" })).toBeVisible()
      await dialog.getByRole("button", { name: "Notes", exact: true }).click()
      await expect(dialog.getByRole("textbox")).toBeVisible()
      await expect.poll(() => dialog.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true)
      await expect(page.getByRole("dialog", { name: "Details", exact: true })).toHaveCount(0)
      await previous.click()
      await expect(header.getByRole("heading", { name: "Introduction video", exact: true })).toBeVisible()
      expect((await header.getByRole("button", { name: "Close accelerator lesson" }).boundingBox())!.height).toBeGreaterThanOrEqual(44)
    } else {
      await expect(header.getByRole("button", { name: "Details", exact: true })).toHaveCount(0)
      await expect(lesson.locator("aside")).toBeVisible()
    }
  })
}

test("height-limited lesson video retains its aspect ratio", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto("/visual-regression/project-feedback?scenario=accelerator")
  const lesson = page.getByTestId("lesson-preview")
  const video = lesson.locator("video")
  const frame = video.locator("../..")
  for (const height of [240, 650, 300]) {
    await lesson.evaluate((element, height) => {
      element.style.height = `${height}px`
    }, height)
    await expect.poll(async () => {
      const box = (await frame.boundingBox())!
      return Math.abs(box.width / box.height - 16 / 9)
    }).toBeLessThan(0.01)
    const box = (await frame.boundingBox())!
    const body = (await lesson.locator("[data-workspace-accelerator-lesson-content]").boundingBox())!
    expect(box.width).toBeGreaterThan(0)
    expect(box.height).toBeGreaterThan(0)
    expect(box.y + box.height).toBeLessThanOrEqual(body.y + body.height + 1)
    expect(box.x + box.width).toBeLessThanOrEqual(body.x + body.width + 1)
    expect(Math.abs(box.x + box.width / 2 - body.x - body.width / 2)).toBeLessThan(1)
    const media = (await video.boundingBox())!
    expect(Math.abs(media.width / media.height - 16 / 9)).toBeLessThan(0.02)
  }
})

test("lesson adapts to drawer width inside a wide desktop", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto("/visual-regression/project-feedback?scenario=accelerator")
  const lesson = page.getByTestId("lesson-preview")
  for (const width of [580, 740, 920, 1000, 700]) {
    await lesson.evaluate((el, width) => { el.style.width = `${width}px`; el.style.marginInline = "auto" }, width)
    const details = lesson.getByRole("button", { name: "Details", exact: true })
    if (width < 960) {
      await expect(details).toHaveCount(0)
      await expect(lesson.locator("aside")).toBeVisible()
      await expect.poll(async () => (await lesson.locator("video").boundingBox())!.width).toBeGreaterThan(width - 50)
      await expect.poll(async () => {
        const video = (await lesson.locator("video").boundingBox())!
        return (await lesson.locator("aside").boundingBox())!.y >= video.y + video.height
      }).toBe(true)
      for (const button of [lesson.getByRole("button", { name: "Previous accelerator step" }), lesson.getByRole("button", { name: "Done reviewing this lesson" })]) {
        await expect.poll(async () => (await button.boundingBox())!.height).toBeGreaterThanOrEqual(44)
      }
    } else {
      await expect(details).toHaveCount(0)
      await expect(lesson.locator("aside")).toBeVisible()
    }
    await expect.poll(() => lesson.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true)
  }
  const notes = lesson.locator("aside").getByRole("textbox")
  await notes.scrollIntoViewIfNeeded()
  await expect(notes).toBeVisible()
  await expect(page.getByRole("dialog", { name: "Details", exact: true })).toHaveCount(0)
})
