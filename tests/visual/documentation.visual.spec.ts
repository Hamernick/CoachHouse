import { expect, test, type Page } from "@playwright/test"
import {
  prepareVisualPage,
  reviewedPlatformScreenshotName,
} from "./reviewed-platform-screenshot"

test.beforeEach(async ({ page }) => {
  await prepareVisualPage(page)
})

async function ready(page: Page) {
  await page.locator("[data-documentation-scroll]").waitFor()
  if (
    (page.viewportSize()?.width ?? 1440) < 768 &&
    new URL(page.url()).pathname === "/visual-regression/documentation" &&
    new URL(page.url()).searchParams.get("viewer") === "marketplace"
  ) {
    await expect(page.getByRole("button", { name: "Open sidebar", exact: true }))
      .toBeVisible()
    await expect(page.getByRole("navigation", { name: "Main navigation", exact: true }))
      .toHaveCount(0)
  }
  await expect(
    page.getByRole("searchbox", { name: "Search documentation", exact: true })
  ).toBeVisible()
  if (
    (page.viewportSize()?.width ?? 1440) < 768 &&
    new URL(page.url()).pathname.startsWith("/documentation")
  ) {
    const navigation = page.getByRole("navigation", {
      name: "Documentation navigation",
      exact: true,
    })
    if (!(await navigation.isVisible())) {
      const openTrigger = page.getByRole("button", {
        name: "Open sidebar",
        exact: true,
      })
      await expect(openTrigger).toBeVisible()
      await openTrigger.click()
      await expect(navigation).toBeVisible()
      await page.keyboard.press("Escape")
      await expect(page.getByRole("dialog")).toHaveCount(0)
    }
  }
  // Avatar images mount after hydration; capture the actual provider logos.
  for (const logo of await page.locator("[data-marketplace-provider-logo]").all()) {
    await expect(logo.locator("img")).toBeVisible()
  }
  const loadExample = page.getByRole("button", {
    name: "Load example",
    exact: true,
  })
  if (await loadExample.count()) await expect(loadExample).toBeEnabled()
  await page.addStyleTag({
    content:
      "[data-testid='react-grab-overlay'], nextjs-portal { visibility: hidden !important; }",
  })
}

async function openDocumentationSearchWithShortcut(page: Page) {
  await page.bringToFront()
  await page
    .getByRole("heading", { name: "Nonprofit documentation", exact: true })
    .click()
  await expect(
    page.getByRole("searchbox", { name: "Search documentation", exact: true })
  ).not.toBeFocused()
  await expect(async () => {
    await page.keyboard.press("Control+k")
    await expect(
      page.getByRole("searchbox", { name: "Search documentation", exact: true })
    ).toBeFocused({ timeout: 1_000 })
  }).toPass({ timeout: 15_000 })
}

test("library search supports keyboard, deep links, browser history, and empty recovery", async ({
  page,
}) => {
  const errors: string[] = []
  page.on("pageerror", (error) => errors.push(error.message))
  await page.goto("/documentation", {
    waitUntil: "domcontentloaded",
  })
  await ready(page)
  const input = page
    .getByRole("search", { name: "Documentation", exact: true })
    .getByRole("searchbox", {
      name: "Search documentation",
      exact: true,
    })
  await expect(page.getByRole("searchbox")).toHaveCount(1)
  await openDocumentationSearchWithShortcut(page)
  await expect(input).toBeFocused()
  await input.fill("color proportions")
  await input.press("Enter")
  await expect(page).toHaveURL(/\/documentation\/search\?q=color\+proportions$/)
  const results = page.getByRole("list", {
    name: "Documentation search results",
  })
  await expect(results.getByRole("link")).toHaveCount(1)
  await results.getByRole("link").click()
  await expect(page).toHaveURL(/\/tools\/brand-identity#color-palette$/)
  await ready(page)
  await expect(page.locator("#color-palette")).toBeInViewport()
  await page.goBack()
  await expect(input).toHaveValue("color proportions")
  await page.goForward()
  await expect(page).toHaveURL(/#color-palette$/)
  await page.goto("/documentation/search?q=qzxnotaword")
  await expect(
    page.getByRole("heading", { name: "No matching pages" })
  ).toBeVisible()
  await input.fill("mission")
  await page
    .getByRole("button", { name: "Search documentation", exact: true })
    .click()
  await expect(page).toHaveURL(/\/documentation\/search\?q=mission$/)
  await expect(results.getByRole("link").first()).toBeVisible()
  await page.getByRole("link", { name: "Clear search", exact: true }).click()
  await expect(input).toHaveValue("")
  await expect(
    page.getByRole("heading", { name: "Explore a topic" })
  ).toBeVisible()
  expect(errors).toEqual([])
})

test("CRM draft survives search, navigation, reload, export, and confirmed reset", async ({
  page,
}) => {
  await page.goto("/documentation/tools/crm#sandbox")
  await ready(page)
  await page.getByRole("button", { name: "Load example", exact: true }).click()
  await page
    .getByRole("button", { name: "Start planning", exact: true })
    .click()
  const organization = page.getByLabel("Organization name", { exact: true })
  await expect(organization).toHaveValue(
    "Willow Street Family Resource Network"
  )
  await organization.fill("Local review organization")
  await page
    .locator("[data-canvas-editor]")
    .getByRole("button", { name: "Collapse step", exact: true })
    .click()
  const search = page.getByRole("searchbox", {
    name: "Search documentation",
    exact: true,
  })
  await search.fill("mission")
  await search.press("Enter")
  await expect(
    page.getByRole("heading", { name: "Search results" })
  ).toBeVisible()
  await page.goBack()
  await ready(page)
  const editor = page.locator("[data-canvas-editor]")
  if (!(await editor.count())) {
    await page
      .getByRole("button", { name: "Start planning", exact: true })
      .click()
  }
  await expect(editor).toBeVisible()
  await expect(organization).toHaveValue("Local review organization")
  await page.reload()
  await ready(page)
  await expect(organization).toHaveValue("Local review organization")
  await page
    .locator("[data-canvas-editor]")
    .getByRole("button", { name: "Collapse step", exact: true })
    .click()
  await page
    .getByRole("button", { name: "Open Review & export", exact: true })
    .click()
  const download = page.waitForEvent("download")
  await page
    .getByRole("button", { name: "Download plan CSV", exact: true })
    .click()
  expect((await download).suggestedFilename()).toBe(
    "nonprofit-crm-data-stewardship-plan.csv"
  )
  await page
    .locator("[data-canvas-editor]")
    .getByRole("button", { name: "Collapse step", exact: true })
    .click()
  page.once("dialog", (dialog) => dialog.accept())
  await page.getByRole("button", { name: "Reset", exact: true }).click()
  await page.getByRole("button", { name: "Open Purpose", exact: true }).click()
  await expect(organization).toHaveValue("")
})

test("Marketplace retains resource filters, shortlist persistence, and export", async ({
  page,
}) => {
  await page.goto("/documentation/marketplace")
  await ready(page)
  await expect(page.locator("[data-marketplace-results-count]")).toHaveText(
    "34 resources"
  )
  await page
    .getByRole("searchbox", { name: "Search resources", exact: true })
    .fill("TechSoup")
  await expect(page.locator("[data-marketplace-results-count]")).toHaveText(
    "2 resources"
  )
  await page
    .getByRole("button", { name: /^Save TechSoup/ })
    .first()
    .click()
  await page.reload()
  await expect(page.locator("[data-marketplace-shortlist-count]")).toHaveText(
    "1"
  )
  await expect(
    page.getByRole("button", { name: /^Remove TechSoup/ })
  ).toBeVisible()
  await page.getByRole("button", { name: "Saved 1", exact: true }).click()
  const download = page.waitForEvent("download")
  await page.getByRole("button", { name: /Download CSV/ }).click()
  expect((await download).suggestedFilename()).toBe(
    "coach-house-marketplace-shortlist.csv"
  )
})

test("Marketplace category pills and searchable filters retain URL state", async ({
  page,
}) => {
  await page.goto("/documentation/marketplace")
  await ready(page)
  await page.getByRole("radio", { name: "Software", exact: true }).click()
  await expect(page.locator("[data-marketplace-results-count]")).toHaveText(
    "16 resources"
  )
  await page
    .getByRole("button", { name: "Browse resource filters", exact: true })
    .click()
  const filterSearch = page.getByRole("combobox", {
    name: "Find a resource filter",
    exact: true,
  })
  await filterSearch.fill("free if")
  await filterSearch.press("Enter")
  await expect(page.locator("[data-marketplace-results-count]")).toHaveText(
    "3 resources"
  )
  await page.reload()
  await expect(
    page.getByRole("radio", { name: "Software", exact: true })
  ).toBeChecked()
  await expect(
    page.getByRole("button", {
      name: "Remove Free if eligible filter",
      exact: true,
    })
  ).toBeVisible()
  await expect(
    page.getByRole("tab", { name: "People", exact: true })
  ).toHaveCount(0)
  await expect(page.getByRole("link", { name: /public member/i })).toHaveCount(
    0
  )
  await page
    .getByRole("button", { name: "Remove Software filter", exact: true })
    .click()
  await expect(page).not.toHaveURL(/type=software/)
  await page.getByRole("button", { name: "Clear filters", exact: true }).click()
  const search = page.getByRole("searchbox", {
    name: "Search resources",
    exact: true,
  })
  await search.pressSequentially("Google Workspace")
  await expect(search).toHaveValue("Google Workspace")
  await expect(page.locator("[data-marketplace-results-count]")).toHaveText(
    "1 resource"
  )
  await search.fill("all")
  await expect(search).toHaveValue("all")
  await expect(page).toHaveURL(/q=all/)
  await search.fill("no-matching-resource-20260915")
  await expect(
    page.getByText("No resources match these filters", { exact: true })
  ).toBeVisible()
  await page.getByRole("button", { name: "Clear filters", exact: true }).click()
  await expect(page.locator("[data-marketplace-results-count]")).toHaveText(
    "34 resources"
  )
})

test("mobile navigation closes after choosing a guide and contents links reach sections", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.emulateMedia({ reducedMotion: "reduce" })
  await page.goto("/documentation", {
    waitUntil: "domcontentloaded",
  })
  await ready(page)
  await page
    .getByRole("button", {
      name: "Open sidebar",
      exact: true,
    })
    .click()
  const rail = page.getByRole("navigation", {
    name: "Documentation navigation",
    exact: true,
  })
  await rail.getByRole("link", { name: "Quickstart", exact: true }).click()
  await expect(page).toHaveURL(/\/documentation\/quickstart$/)
  await expect(page.getByRole("dialog")).toHaveCount(0)
  await page.getByRole("button", { name: "On this page", exact: true }).click()
  await page
    .getByRole("navigation", { name: "Article contents", exact: true })
    .getByRole("link", { name: "Readiness checklist", exact: true })
    .click()
  await expect(page).toHaveURL(/#checklist$/)
  await expect(
    page
      .getByRole("navigation", { name: "Article contents", exact: true })
      .getByRole("link", { name: "Readiness checklist", exact: true })
  ).toHaveAttribute("aria-current", "location")
  await expect(page.locator("#checklist-title")).toBeInViewport()
  const headingBounds = await page.locator("#checklist-title").boundingBox()
  const searchBounds = await page
    .getByRole("search", { name: "Documentation", exact: true })
    .boundingBox()
  expect(headingBounds!.y).toBeGreaterThan(
    searchBounds!.y + searchBounds!.height
  )
})

test("article contents indicator follows scrolling, section links, and browser history", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto("/documentation/quickstart#checklist")
  await ready(page)
  const contents = page
    .getByRole("complementary", { name: "On this page", exact: true })
    .getByRole("navigation", { name: "Article contents", exact: true })
  const checklist = contents.getByRole("link", {
    name: "Readiness checklist",
    exact: true,
  })
  const indicator = contents.locator('[data-slot="section-rail-indicator"]')
  async function expectIndicatorAtCurrentLink() {
    await expect
      .poll(async () => {
        const active = await contents
          .locator('[aria-current="location"]')
          .boundingBox()
        const marker = await indicator.boundingBox()
        return active && marker
          ? Math.max(
              Math.abs(active.y - marker.y),
              Math.abs(active.height - marker.height)
            )
          : Infinity
      })
      .toBeLessThan(1)
  }
  await expect(checklist).toHaveAttribute("aria-current", "location")
  await expectIndicatorAtCurrentLink()
  await contents.getByRole("link", { name: "Sources", exact: true }).click()
  await expect(page).toHaveURL(/#sources$/)
  await expect(
    contents.getByRole("link", { name: "Sources", exact: true })
  ).toHaveAttribute("aria-current", "location")
  await expectIndicatorAtCurrentLink()
  await page.goBack()
  await expect(page).toHaveURL(/#checklist$/)
  await expect(checklist).toHaveAttribute("aria-current", "location")
  await expectIndicatorAtCurrentLink()
  await page.locator("[data-documentation-scroll]").evaluate((element) => {
    element.scrollTo({ top: 0, behavior: "instant" })
  })
  await expect(contents.getByRole("link").first()).toHaveAttribute(
    "aria-current",
    "location"
  )
  await expectIndicatorAtCurrentLink()
  await page.emulateMedia({ reducedMotion: "reduce" })
  await checklist.click()
  await expect(checklist).toHaveAttribute("aria-current", "location")
  await expectIndicatorAtCurrentLink()
  expect(
    await indicator.evaluate(
      (element) => getComputedStyle(element).transitionProperty
    )
  ).toBe("none")
})

for (const viewer of ["free", "paid", "locked"]) {
  test(`documentation remains available in the ${viewer} account shell`, async ({
    page,
  }) => {
    await page.goto(`/visual-regression/documentation?viewer=${viewer}`)
    await ready(page)
    await expect(
      page.getByRole("heading", {
        name: "Nonprofit documentation",
        exact: true,
      })
    ).toBeVisible()
    await expect(
      page.getByRole("searchbox", { name: "Search documentation", exact: true })
    ).toBeVisible()
    await openDocumentationSearchWithShortcut(page)
    await expect(
      page.getByRole("searchbox", { name: "Search documentation", exact: true })
    ).toBeFocused()
    await expect(page.getByRole("dialog")).toHaveCount(0)
    await expect(
      page.getByRole("navigation", {
        name: "Documentation navigation",
        exact: true,
      })
    ).toHaveCount(1)
  })
}

for (const mode of ["light", "dark"] as const) {
  test(`documentation search and article fit mobile in ${mode} mode`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.emulateMedia({ colorScheme: mode, reducedMotion: "reduce" })
    await page.addInitScript(
      (theme) => localStorage.setItem("theme", theme),
      mode
    )
    await page.goto("/documentation/search?q=CRM")
    await ready(page)
    const search = page.getByRole("searchbox", {
      name: "Search documentation",
      exact: true,
    })
    expect(
      await search.evaluate((input) =>
        parseFloat(getComputedStyle(input).fontSize)
      )
    ).toBeGreaterThanOrEqual(16)
    expect(
      await page
        .locator("[data-documentation-scroll]")
        .evaluate((el) => el.scrollWidth <= el.clientWidth)
    ).toBe(true)
    await expect
      .soft(page)
      .toHaveScreenshot(
        reviewedPlatformScreenshotName(
          `documentation-search-mobile-${mode}.png`
        ),
        { animations: "disabled", caret: "hide", maxDiffPixelRatio: 0.01 }
      )
    await page
      .getByRole("list", { name: "Documentation search results" })
      .getByRole("link")
      .first()
      .click()
    await ready(page)
    await expect(page).toHaveURL(/\/documentation\/tools\/crm$/)
    expect(
      await page
        .locator("[data-documentation-scroll]")
        .evaluate((el) => el.scrollWidth <= el.clientWidth)
    ).toBe(true)
    await expect
      .soft(page)
      .toHaveScreenshot(
        reviewedPlatformScreenshotName(
          `documentation-article-mobile-${mode}.png`
        ),
        { animations: "disabled", caret: "hide", maxDiffPixelRatio: 0.01 }
      )
    for (const [route, surface] of [
      ["/documentation/marketplace", "marketplace"],
      ["/documentation", "home"],
    ]) {
      await page.goto(route)
      await ready(page)
      expect(
        await page
          .locator("[data-documentation-scroll]")
          .evaluate((el) => el.scrollWidth <= el.clientWidth)
      ).toBe(true)
      await expect
        .soft(page)
        .toHaveScreenshot(
          reviewedPlatformScreenshotName(
            `documentation-${surface}-mobile-${mode}.png`
          ),
          {
            animations: "disabled",
            caret: "hide",
            maxDiffPixelRatio: 0.01,
          }
        )
    }
  })
}

test("documentation home and article desktop baselines", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto("/documentation", {
    waitUntil: "domcontentloaded",
  })
  await ready(page)
  await expect
    .soft(page)
    .toHaveScreenshot(
      reviewedPlatformScreenshotName("documentation-home-desktop.png"),
      {
        animations: "disabled",
        caret: "hide",
        maxDiffPixelRatio: 0.01,
      }
    )
  await page.goto("/documentation/best-practices/mission")
  await ready(page)
  await expect
    .soft(page)
    .toHaveScreenshot(
      reviewedPlatformScreenshotName("documentation-article-desktop.png"),
      {
        animations: "disabled",
        caret: "hide",
        maxDiffPixelRatio: 0.01,
      }
    )
  for (const [route, surface] of [
    ["/documentation/quickstart", "quickstart"],
    ["/documentation/marketplace", "marketplace"],
    ["/documentation/tools/brand-identity", "brand-identity"],
  ]) {
    await page.goto(route)
    await ready(page)
    if (surface === "brand-identity")
      await expect(
        page.getByRole("status").filter({ hasText: "Saved on this device" })
      ).toBeVisible()
    await expect
      .soft(page)
      .toHaveScreenshot(
        reviewedPlatformScreenshotName(`documentation-${surface}-desktop.png`),
        {
          animations: "disabled",
          caret: "hide",
          maxDiffPixelRatio: 0.01,
        }
      )
  }
})

test("Marketplace resource guides lead from discovery to setup and saved choices", async ({
  page,
}) => {
  await page.goto("/documentation/marketplace?q=Ad%20Grants")
  await page
    .getByRole("link", { name: "Google Ad Grants", exact: true })
    .click()
  await expect(page).toHaveURL(/marketplace\/google-ad-grants$/)
  await expect(
    page.getByRole("heading", { name: "Google Ad Grants", exact: true })
  ).toBeVisible()
  await expect(
    page.getByRole("link", { name: "Follow Google's activation steps" })
  ).toHaveAttribute("href", "https://www.google.com/grants/get-started/")
  await expect(
    page.getByRole("heading", { name: "Fundraising", exact: true })
  ).toBeAttached()
  await expect(
    page.getByRole("heading", { name: "Volunteer recruitment", exact: true })
  ).toBeAttached()
  await expect(
    page.getByRole("heading", { name: "Reach your community", exact: true })
  ).toBeAttached()
  await page
    .getByRole("button", { name: "Save Google Ad Grants", exact: true })
    .click()
  await page.reload()
  await expect(
    page.getByRole("button", {
      name: "Remove Google Ad Grants from saved resources",
      exact: true,
    })
  ).toHaveAttribute("aria-pressed", "true")
  await page.getByRole("button", { name: "Saved 1", exact: true }).click()
  await expect(
    page
      .getByRole("dialog")
      .getByRole("link", { name: "Google Ad Grants", exact: true })
  ).toHaveAttribute("href", "/documentation/marketplace/google-ad-grants")
})

for (const [layout, mode, width, height] of [
  ["desktop", "light", 1280, 900],
  ["mobile", "dark", 390, 844],
] as const) {
  test(`Marketplace and completed plans have reviewed ${layout} baselines`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height })
    await page.emulateMedia({ colorScheme: mode, reducedMotion: "reduce" })
    await page.addInitScript(
      (theme) => localStorage.setItem("theme", theme),
      mode
    )
    for (const [route, surface, planner] of [
      [
        "/visual-regression/documentation?viewer=marketplace",
        "marketplace-fixture",
        false,
      ],
      ["/documentation/marketplace/google-ad-grants", "ad-grants", false],
      ["/documentation/tools/campaigns#sandbox", "campaign-review", true],
      [
        "/documentation/best-practices/fundraising#sandbox",
        "fundraising-review",
        true,
      ],
    ] as const) {
      await page.goto(route)
      await ready(page)
      if (planner) {
        await page
          .getByRole("button", { name: "Load example", exact: true })
          .click()
        await page
          .getByRole("button", { name: "List view", exact: true })
          .click()
        await page
          .getByRole("list", { name: "Planner steps" })
          .getByRole("button")
          .last()
          .click()
        await expect(
          page.getByRole("button", { name: /Download.*CSV/ }).first()
        ).toBeVisible()
      }
      await expect
        .soft(page)
        .toHaveScreenshot(
          reviewedPlatformScreenshotName(
            `documentation-${surface}-${layout}-${mode}.png`
          ),
          {
            animations: "disabled",
            caret: "hide",
            maxDiffPixelRatio: 0.01,
          }
        )
    }
  })
}
