import { expect, test, type Page } from "@playwright/test"
import type { CalendarSummary } from "../../src/features/google-calendar/types"
import { reviewedPlatformScreenshotName } from "./reviewed-platform-screenshot"

test.use({ timezoneId: "America/New_York", locale: "en-US" })

async function mockCalendar(
  page: Page,
  overrides: Partial<CalendarSummary> = {}
) {
  await page.clock.setFixedTime(new Date("2026-09-08T16:00:00Z"))
  let state: CalendarSummary = {
    activeOrgId: "org-a",
    configured: true,
    connected: true,
    enabled: true,
    status: "connected",
    email: "calendar@example.org",
    selectedCalendars: [
      { id: "personal", name: "Personal", timeZone: "America/New_York" },
    ],
    exportOrgId: null,
    canExport: true,
    timeZone: "America/New_York",
    lastSyncedAt: "2026-09-08T14:00:00Z",
    error: null,
    syncing: false,
    ...overrides,
  }
  const requests: string[] = []
  await page.route("**/api/integrations/google-calendar/**", async (route) => {
    const request = route.request()
    const operation = new URL(request.url()).pathname.split("/").pop()!
    requests.push(operation)
    let result: unknown = state
    if (operation === "calendars")
      result = {
        calendars: [
          { id: "personal", name: "Personal", timeZone: "America/New_York" },
          { id: "work", name: "Work", timeZone: "UTC" },
        ],
      }
    if (operation === "enabled") {
      state = { ...state, enabled: request.postDataJSON().enabled }
      result = state
    }
    if (operation === "disconnect") {
      state = {
        ...state,
        connected: false,
        enabled: false,
        status: "not_connected",
        email: null,
        selectedCalendars: [],
      }
      result = state
    }
    if (operation === "settings") {
      state = {
        ...state,
        enabled: true,
        selectedCalendars: request
          .postDataJSON()
          .calendarIds.map((id: string) => ({ id, name: id, timeZone: "UTC" })),
      }
      result = state
    }
    if (operation === "sync") result = { complete: true }
    if (operation === "events")
      result = {
        events: state.enabled
          ? [
              {
                id: "private",
                calendarId: "personal",
                calendarName: "Personal",
                title: "Personal appointment",
                start: "2026-09-08T14:00:00Z",
                end: "2026-09-08T15:00:00Z",
                allDay: false,
                url: "https://calendar.google.com/calendar/event?eid=private",
              },
            ]
          : [],
      }
    return route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(result),
    })
  })
  await page.route("**/api/integrations/google-drive/connection", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        connection: {
          connected: false,
          googleEmail: null,
          status: "not_connected",
        },
      }),
    })
  )
  return {
    requests,
    setWorkspace: (activeOrgId: string) => {
      state = { ...state, activeOrgId }
    },
  }
}
for (const width of [390, 1440])
  for (const scheme of ["light", "dark"] as const) {
    test(
      "Calendar setup and private agenda " + width + " " + scheme,
      async ({ page }) => {
        await page.setViewportSize({ width, height: 900 })
        await page.emulateMedia({ colorScheme: scheme })
        await mockCalendar(page)
        await page.goto("/visual-regression/google-calendar")
        await page.evaluate(
          (dark) => document.documentElement.classList.toggle("dark", dark),
          scheme === "dark"
        )
        await expect(
          page.getByRole("link", {
            name: "Open Personal appointment in Google Calendar",
          })
        ).toBeVisible()
        await expect(page.getByText("Google · Only you")).toBeVisible()
        await expect(page).toHaveScreenshot(
          "google-calendar-" + width + "-" + scheme + ".png",
          { animations: "disabled", maxDiffPixelRatio: 0.02 }
        )
        await page
          .getByRole("button", { name: "Manage Google Calendar" })
          .click()
        const dialog = page.getByRole("dialog", { name: "Google Calendar" })
        await expect(dialog.getByText("Calendars to display")).toBeVisible()
        await expect(
          dialog.getByRole("checkbox", { name: "Personal", exact: true })
        ).toBeChecked()
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= window.innerWidth
          )
        ).toBe(true)
        await expect(dialog).toHaveScreenshot(
          reviewedPlatformScreenshotName(
            "google-calendar-setup-" + width + "-" + scheme + ".png"
          ),
          { animations: "disabled", maxDiffPixelRatio: 0.02 }
        )
        await dialog
          .getByRole("switch", { name: "Calendar sync", exact: true })
          .click()
        await expect(
          dialog.getByRole("switch", { name: "Calendar sync", exact: true })
        ).not.toBeChecked()
        await page.keyboard.press("Escape")
        await expect(
          page.getByRole("link", {
            name: "Open Personal appointment in Google Calendar",
          })
        ).toHaveCount(0)
      }
    )
  }
test("Tools controls the same Calendar connection and disconnect preserves Google events", async ({
  page,
}) => {
  const { requests } = await mockCalendar(page)
  await page.goto("/visual-regression/workspace-tools")
  const toggle = page.getByRole("switch", { name: "Google Calendar sync" })
  await expect(toggle).toBeChecked()
  await toggle.click()
  await expect(toggle).not.toBeChecked()
  await toggle.click()
  await expect(toggle).toBeChecked()
  await expect(
    page.getByRole("button", { name: "Manage", exact: true })
  ).toHaveCount(0)
  await page.goto("/visual-regression/google-calendar")
  await page
    .getByRole("button", { name: "Manage Google Calendar", exact: true })
    .click()
  const dialog = page.getByRole("dialog", { name: "Google Calendar" })
  await dialog.getByRole("button", { name: "Disconnect", exact: true }).click()
  await expect(dialog).toContainText("Existing Google events remain.")
  await dialog.getByRole("button", { name: "Disconnect", exact: true }).click()
  await expect(dialog).toHaveCount(0)
  expect(requests).toContain("disconnect")
  await page.goto("/visual-regression/workspace-tools")
  await expect(
    page.getByRole("switch", { name: "Google Drive connection" })
  ).not.toBeChecked()
})

test("The Tools switch starts setup and stays off when setup is canceled", async ({
  page,
}) => {
  const { requests } = await mockCalendar(page, {
    connected: false,
    enabled: false,
    status: "not_connected",
    email: null,
    selectedCalendars: [],
  })
  await page.goto("/visual-regression/workspace-tools")
  const toggle = page.getByRole("switch", { name: "Google Calendar sync" })
  await expect(
    page.getByRole("button", { name: "Set up", exact: true })
  ).toHaveCount(0)
  await expect(toggle).toBeEnabled()
  await toggle.click()
  const dialog = page.getByRole("dialog", {
    name: "Google Calendar",
    exact: true,
  })
  await expect(
    dialog.getByRole("button", { name: "Continue with Google", exact: true })
  ).toBeVisible()
  await dialog.getByRole("button", { name: "Close", exact: true }).click()
  await expect(toggle).not.toBeChecked()
  expect(requests).not.toContain("enabled")
  expect(requests).not.toContain("connect")
})

test("An unconfigured Calendar explains the app setup requirement without enabling sync", async ({
  page,
}) => {
  const { requests } = await mockCalendar(page, {
    configured: false,
    connected: false,
    enabled: false,
    status: "not_connected",
    email: null,
    selectedCalendars: [],
  })
  await page.goto("/visual-regression/workspace-tools")
  const toggle = page.getByRole("switch", { name: "Google Calendar sync" })
  await expect(page.getByText("Unavailable", { exact: true })).toBeVisible()
  await toggle.click()
  const dialog = page.getByRole("dialog", {
    name: "Google Calendar",
    exact: true,
  })
  await expect(dialog).toContainText(
    "Google Calendar isn’t enabled for Coach House yet."
  )
  await dialog.getByRole("button", { name: "Check again", exact: true }).click()
  await dialog.getByRole("button", { name: "Close", exact: true }).click()
  await expect(toggle).not.toBeChecked()
  expect(requests).not.toContain("enabled")
  expect(requests).not.toContain("connect")
})
test("Denied consent presents a recovery action", async ({ page }) => {
  await mockCalendar(page)
  await page.goto(
    "/visual-regression/workspace-tools?googleCalendar=authorization_denied"
  )
  await expect(page.getByRole("dialog")).toContainText(
    "connection was canceled"
  )
})

test("An open setup cannot redirect board export after a workspace switch", async ({
  page,
}) => {
  const { requests, setWorkspace } = await mockCalendar(page)
  await page.goto("/visual-regression/google-calendar")
  await page.getByRole("button", { name: "Manage Google Calendar" }).click()
  const dialog = page.getByRole("dialog", { name: "Google Calendar" })
  await dialog
    .getByRole("checkbox", { name: "Export this workspace’s board events" })
    .check()
  await expect(
    dialog.getByRole("button", { name: "Save and sync" })
  ).toBeEnabled()
  setWorkspace("org-b")
  await page.evaluate(() => window.dispatchEvent(new Event("focus")))
  await expect(dialog.getByRole("alert")).toContainText(
    "Your workspace changed"
  )
  await expect(
    dialog.getByRole("button", { name: "Save and sync" })
  ).toBeDisabled()
  expect(requests).not.toContain("settings")
})

for (const width of [390, 1440]) {
  test(`Shell calendar releases locks and preserves selection at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 })
    await mockCalendar(page)
    await page.goto("/visual-regression/google-calendar?surface=shell")
    const calendar = page.getByRole("region", { name: "Workspace calendar" })
    await page
      .getByRole("button", { name: "Show calendar", exact: true })
      .click()
    await calendar
      .getByRole("button", {
        name: "Wednesday, September 9th, 2026",
        exact: true,
      })
      .click()
    await expect(
      calendar.getByRole("button", {
        name: "Wednesday, September 9th, 2026, selected",
        exact: true,
      })
    ).toBeVisible()
    if (width === 390) {
      const closeCalendar = page.getByRole("button", {
        name: "Close calendar",
        exact: true,
      })
      const target = await closeCalendar.boundingBox()
      expect(target?.width).toBeGreaterThanOrEqual(44)
      expect(target?.height).toBeGreaterThanOrEqual(44)
      await closeCalendar.click()
    } else {
      await page.keyboard.press("Escape")
    }
    await expect(calendar).toHaveCount(0)

    // Mount a workspace drawer after the first calendar visit. A retained,
    // hidden calendar layer would now sit underneath the drawer's pointer lock.
    await page
      .getByRole("button", { name: "Open workspace drawer", exact: true })
      .click()
    await expect(
      page.getByRole("dialog", { name: "Workspace drawer", exact: true })
    ).toBeVisible()
    await page.locator('button[aria-label="Show calendar"]').click()
    await expect(
      calendar.getByRole("button", {
        name: "Wednesday, September 9th, 2026, selected",
        exact: true,
      })
    ).toBeVisible()
    await calendar
      .getByRole("button", { name: "Show next month", exact: true })
      .click()
    await expect(
      calendar.getByRole("heading", { name: "October 2026" })
    ).toBeVisible()
    await calendar
      .getByRole("button", { name: "Friday, October 9th, 2026", exact: true })
      .click()
    await calendar
      .getByRole("button", { name: "Manage Google Calendar", exact: true })
      .click()
    const setup = page.getByRole("dialog", {
      name: "Google Calendar",
      exact: true,
    })
    await setup.getByRole("button", { name: "Close", exact: true }).click()
    await expect(setup).toHaveCount(0)
    await calendar
      .getByRole("button", {
        name: "Saturday, October 10th, 2026",
        exact: true,
      })
      .click()
    await page.keyboard.press("Escape")
    await expect(calendar).toHaveCount(0)
    await page
      .getByRole("button", { name: "Workspace action (0)", exact: true })
      .click()
    await expect(
      page.getByRole("button", { name: "Workspace action (1)", exact: true })
    ).toBeVisible()
    await page.locator('button[aria-label="Show calendar"]').click()
    await expect(
      calendar.getByRole("heading", { name: "October 2026" })
    ).toBeVisible()
    await expect(
      calendar.getByRole("button", {
        name: "Saturday, October 10th, 2026, selected",
        exact: true,
      })
    ).toBeVisible()
  })
}
