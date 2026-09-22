import { expect, test, type Page } from "@playwright/test"
import { prepareVisualPage, reviewedPlatformScreenshotName } from "./reviewed-platform-screenshot"
import {
  resolveRoadmapSections,
  updateRoadmapSection,
} from "../../src/lib/roadmap"

test.beforeEach(async ({ page }) => {
  await prepareVisualPage(page)
})

async function mockSaves(page: Page) {
  await page.route("https://unpkg.com/react-grab@*/**", (route) =>
    route.fulfill({ body: "", contentType: "application/javascript" })
  )
  let profile: Record<string, unknown> = {}
  const requests: {
    sectionId?: string
    content?: string
    expectedLastUpdated?: string | null
    status?: string
  }[] = []
  let hold: Promise<void> | null = null
  let release = () => {}
  await page.route("**/roadmap-save/fixture-action", async (route) => {
    const input = route.request().postDataJSON()
    requests.push(input)
    if (hold) await hold
    const current = resolveRoadmapSections(profile).find(
      (section) => section.id === input.sectionId
    )!
    if (current.lastUpdated !== input.expectedLastUpdated) {
      return route.fulfill({
        json: {
          error:
            "This roadmap section was updated elsewhere. Reload before saving.",
        },
      })
    }
    const saved = updateRoadmapSection(profile, input.sectionId, input)
    profile = saved.nextProfile
    return route.fulfill({ json: { section: saved.section } })
  })
  await page.route("**/roadmap-save/fixture-recovery", async (route) => {
    const { sectionId } = route.request().postDataJSON()
    return route.fulfill({
      json: {
        section: resolveRoadmapSections(profile).find(
          (section) => section.id === sectionId
        ),
      },
    })
  })
  await page.goto("/visual-regression/roadmap-save")
  await expect(page.getByLabel("Save state")).toHaveText("Saved")
  return {
    requests,
    get section() {
      return resolveRoadmapSections(profile).find(
        (section) => section.id === "origin_story"
      )!
    },
    pause() {
      hold = new Promise<void>((resolve) => {
        release = resolve
      })
    },
    resume() {
      hold = null
      release()
    },
    remoteEdit(content: string) {
      profile = updateRoadmapSection(profile, "origin_story", {
        content,
      }).nextProfile
    },
  }
}

test("manual saving sends one write and preserves edits made while the request is pending", async ({
  page,
}) => {
  const backend = await mockSaves(page)
  backend.pause()
  await page.getByLabel("Document text").fill("First draft")
  await page.getByRole("button", { name: "Save document", exact: true }).click()
  await expect.poll(() => backend.requests.length).toBe(1)
  await expect(page.getByLabel("Save state")).toHaveText("Saving")
  await page.getByLabel("Document text").fill("First draft with newer typing")
  backend.resume()
  await expect(page.getByLabel("Saved revision")).not.toHaveText("none")
  await expect(page.getByLabel("Document text")).toHaveValue(
    "First draft with newer typing"
  )
  await expect
    .poll(() => backend.section.content)
    .toBe("First draft with newer typing")
  expect(backend.requests).toHaveLength(2)
  expect(backend.requests[1].expectedLastUpdated).not.toBeNull()
  await expect(page.getByLabel("Save state")).toHaveText("Saved")
})

test("publishing and refreshed props keep the latest revision for the next save", async ({
  page,
}) => {
  const backend = await mockSaves(page)
  await page.getByLabel("Document text").fill("Published text")
  await page
    .getByRole("button", { name: "Publish document", exact: true })
    .click()
  await expect(page.getByLabel("Save state")).toHaveText("Saved")
  const firstRevision = backend.section.lastUpdated
  expect(backend.requests).toHaveLength(1)
  await page.getByRole("button", { name: "Refresh original props" }).click()
  await expect(page.getByLabel("Saved revision")).toHaveText(firstRevision!)
  await page.getByLabel("Document text").fill("Next edit")
  await page.getByRole("button", { name: "Save document", exact: true }).click()
  await expect.poll(() => backend.section.content).toBe("Next edit")
  expect(backend.requests).toHaveLength(2)
  expect(backend.requests[1].expectedLastUpdated).toBe(firstRevision)
})

test("autosave persists once and a following manual edit uses its saved revision", async ({
  page,
}) => {
  const backend = await mockSaves(page)
  await page.getByLabel("Document text").fill("Autosaved text")
  await expect.poll(() => backend.section.content).toBe("Autosaved text")
  await expect(page.getByLabel("Save state")).toHaveText("Saved")
  expect(backend.requests).toHaveLength(1)
  const revision = backend.section.lastUpdated
  await page.getByLabel("Document text").fill("A later edit")
  await page.getByRole("button", { name: "Save document", exact: true }).click()
  await expect.poll(() => backend.section.content).toBe("A later edit")
  expect(backend.requests).toHaveLength(2)
  expect(backend.requests[1].expectedLastUpdated).toBe(revision)
})

test("a genuine newer remote revision stays protected and keeps the local draft", async ({
  page,
}) => {
  const backend = await mockSaves(page)
  backend.remoteEdit("Another editor's saved text")
  await page.getByLabel("Document text").fill("My unsaved text")
  await page.getByRole("button", { name: "Save document", exact: true }).click()
  await expect(
    page
      .getByText("The saved document changed. Your draft is still here.")
      .first()
  ).toBeVisible()
  await expect(page.getByLabel("Document text")).toHaveValue("My unsaved text")
  expect(backend.section.content).toBe("Another editor's saved text")
})

test("conflicts pause autosave and let the user review and explicitly save their draft", async ({
  page,
}) => {
  const backend = await mockSaves(page)
  backend.remoteEdit("Another editor's saved text")
  await page.getByLabel("Document text").fill("My unsaved text")
  await page.getByRole("button", { name: "Save document", exact: true }).click()
  await expect(
    page.getByRole("button", { name: "Review changes" })
  ).toBeVisible()
  await page.clock.install()
  await page.clock.fastForward(30_000)
  expect(backend.requests).toHaveLength(1)
  await page.getByRole("button", { name: "Review changes" }).click()
  const dialog = page.getByRole("dialog")
  await expect(
    dialog.getByRole("region", { name: "Your draft", exact: true })
  ).toContainText("My unsaved text")
  await expect(
    dialog.getByRole("region", { name: "Saved document", exact: true })
  ).toContainText("Another editor's saved text")
  await dialog.getByRole("button", { name: "Save my version" }).click()
  await expect.poll(() => backend.section.content).toBe("My unsaved text")
  expect(backend.requests).toHaveLength(2)
  expect(backend.requests[1].expectedLastUpdated).not.toBeNull()
})

test("using the saved version clears the local draft without writing over the server", async ({
  page,
}) => {
  const backend = await mockSaves(page)
  backend.remoteEdit("Saved on another tab")
  await page.getByLabel("Document text").fill("Local draft")
  await page.getByRole("button", { name: "Save document", exact: true }).click()
  await page.getByRole("button", { name: "Review changes" }).click()
  await page.getByRole("button", { name: "Use saved version" }).click()
  await expect(page.getByLabel("Document text")).toHaveValue(
    "Saved on another tab"
  )
  expect(backend.requests).toHaveLength(1)
})

test("a reloaded draft keeps its original revision and cannot silently overwrite remote changes", async ({
  page,
}) => {
  const backend = await mockSaves(page)
  backend.remoteEdit("Remote saved version")
  await page.getByLabel("Document text").fill("Local unsaved draft")
  await page.getByRole("button", { name: "Save document", exact: true }).click()
  await expect(
    page.getByRole("button", { name: "Review changes" })
  ).toBeVisible()
  await page.reload()
  await expect(page.getByLabel("Document text")).toHaveValue(
    "Local unsaved draft"
  )
  await page.getByRole("button", { name: "Save document", exact: true }).click()
  await expect(
    page.getByRole("button", { name: "Review changes" })
  ).toBeVisible()
  expect(backend.section.content).toBe("Remote saved version")
  expect(
    backend.requests.every((request) => request.expectedLastUpdated === null)
  ).toBe(true)
})

test("switching accounts or organizations does not restore another scope's draft", async ({
  page,
}) => {
  const backend = await mockSaves(page)
  backend.remoteEdit("Remote text")
  await page.getByLabel("Document text").fill("Private unsaved draft")
  await page.getByRole("button", { name: "Save document", exact: true }).click()
  await expect(
    page.getByRole("button", { name: "Review changes" })
  ).toBeVisible()
  await page.getByRole("button", { name: "Switch organization" }).click()
  await expect(page.getByLabel("Document text")).toHaveValue("")
  await page.getByRole("button", { name: "Switch account" }).click()
  await expect(page.getByLabel("Document text")).toHaveValue("")
})

test("queues another section and pending typing while a save is in flight", async ({
  page,
}) => {
  const backend = await mockSaves(page)
  backend.pause()
  await page.getByLabel("Document text").fill("Origin draft")
  await page.getByRole("button", { name: "Save document", exact: true }).click()
  await expect.poll(() => backend.requests.length).toBe(1)
  await page.getByLabel("Document text").fill("Origin with pending typing")
  await page.getByRole("button", { name: "Open board_strategy" }).click()
  await page.getByLabel("Document text").fill("Board draft")
  await page.getByRole("button", { name: "Save document", exact: true }).click()
  backend.resume()
  await expect.poll(() => backend.requests.length).toBe(3)
  await expect
    .poll(() => backend.section.content)
    .toBe("Origin with pending typing")
  expect(
    backend.requests.some(
      (request) =>
        request.sectionId === "board_strategy" &&
        request.content === "Board draft"
    )
  ).toBe(true)
})

for (const width of [390, 1440]) {
  for (const colorScheme of ["light", "dark"] as const) {
    test(`conflict recovery fits ${width}px in ${colorScheme} mode`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 })
      await page.emulateMedia({ colorScheme, reducedMotion: "reduce" })
      const backend = await mockSaves(page)
      backend.remoteEdit(
        "<h2>Board strategy</h2><p>The saved plan includes <strong>three new members</strong>.</p>"
      )
      await page
        .getByLabel("Document text")
        .fill(
          "<h2>Board strategy</h2><p>My draft proposes <strong>four new members</strong>.</p>"
        )
      await page
        .getByRole("button", { name: "Save document", exact: true })
        .click()
      await page.getByRole("button", { name: "Review changes" }).click()
      const dialog = page.getByRole("dialog")
      await expect(
        dialog.getByRole("button", { name: "Save my version" })
      ).toBeEnabled()
      await expect(
        dialog.getByRole("region", { name: "Saved document", exact: true })
      ).toContainText("three new members")
      await expect.soft(dialog).toHaveScreenshot(
        reviewedPlatformScreenshotName(`roadmap-conflict-${width}-${colorScheme}.png`),
        { animations: "disabled" }
      )
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth
        )
      ).toBe(true)
    })
  }
}

test("a second remote change during conflict review still cannot be overwritten", async ({
  page,
}) => {
  const backend = await mockSaves(page)
  backend.remoteEdit("First remote change")
  await page.getByLabel("Document text").fill("My draft")
  await page.getByRole("button", { name: "Save document", exact: true }).click()
  await page.getByRole("button", { name: "Review changes" }).click()
  await expect(
    page.getByRole("dialog").getByRole("button", { name: "Save my version" })
  ).toBeEnabled()
  backend.remoteEdit("Second remote change")
  await page.getByRole("button", { name: "Save my version" }).click()
  await expect(
    page.getByRole("button", { name: "Review changes" })
  ).toBeVisible()
  expect(backend.section.content).toBe("Second remote change")
  await expect(page.getByLabel("Document text")).toHaveValue("My draft")
})

test("offline drafts wait and resume saving after reconnecting", async ({
  page,
  context,
}) => {
  const errors: string[] = []
  page.on("pageerror", (error) => errors.push(error.message))
  await page.clock.install()
  const backend = await mockSaves(page)
  await context.setOffline(true)
  const offlineMessage = page.getByText(
    "Offline. Your changes are waiting to save."
  )
  // Wait for the connection effect before editing; the initial Saved label is SSR.
  await expect(offlineMessage).toBeVisible()
  const editor = page.getByLabel("Document text")
  await editor.fill("Offline draft")
  await expect(page.getByLabel("Save state")).toHaveText("Unsaved")
  await page.clock.fastForward(15_000)
  await expect(editor).toHaveValue("Offline draft")
  expect(backend.requests).toHaveLength(0)
  await context.setOffline(false)
  await expect(offlineMessage).toBeHidden()
  await page.clock.runFor(3_000)
  await expect.poll(() => backend.section.content).toBe("Offline draft")
  await expect(editor).toHaveValue("Offline draft")
  await expect(page.getByLabel("Save state")).toHaveText("Saved")
  expect(errors).toEqual([])
})

test("unavailable browser storage warns without breaking editing or saving", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const original = Storage.prototype.setItem
    Storage.prototype.setItem = function (key, value) {
      if (key.startsWith("roadmap-draft:"))
        throw new DOMException("Quota exceeded", "QuotaExceededError")
      return original.call(this, key, value)
    }
  })
  const backend = await mockSaves(page)
  await page.getByLabel("Document text").fill("Recoverable in memory")
  await expect(
    page.getByText(
      "Browser backup is unavailable. Keep this page open until your changes are saved."
    )
  ).toBeVisible()
  await page.getByRole("button", { name: "Save document", exact: true }).click()
  await expect.poll(() => backend.section.content).toBe("Recoverable in memory")
  await expect(page.getByLabel("Document text")).toHaveValue(
    "Recoverable in memory"
  )
})

test("discarding immediately before switching does not autosave discarded text", async ({
  page,
}) => {
  const backend = await mockSaves(page)
  await page.getByLabel("Document text").fill("Discard this")
  await page.getByRole("button", { name: "Discard and switch" }).click()
  await page.getByRole("button", { name: "Open origin_story" }).click()
  await expect(page.getByLabel("Document text")).toHaveValue("")
  await page.clock.install()
  await page.clock.fastForward(15_000)
  expect(backend.requests).toHaveLength(0)
  expect(
    await page.evaluate(() =>
      localStorage.getItem("roadmap-draft:v2:fixture-user:fixture-org")
    )
  ).toBeNull()
})
