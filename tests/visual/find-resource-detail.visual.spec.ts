import { expect, test } from "@playwright/test"
import { mockPublicResourceDirectory } from "./fixtures/public-resource-directory"
import type { FindResourceIndexItem } from "../../src/features/find-resource-index/types"

// Explicit test data, served only by intercepted public requests.
const shelter: FindResourceIndexItem & { description: string } = {
  id: "resource_map:detail-loading-shelter",
  itemType: "external_resource",
  title: "Housing Forward - Emergency Overnight Shelter",
  subtitle: "Emergency overnight shelter",
  description: "Overnight shelter and housing assistance.",
  city: "Oak Park",
  state: "IL",
  country: "United States",
  latitude: 41.885,
  longitude: -87.785,
  primaryResourceCategory: "housing",
  resourceCategories: ["housing"],
  verificationStatus: "external_data",
  visibility: "published",
}

for (const width of [1280, 390]) {
  test(`resource details open without suspending the Find shell at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 })
    const errors: string[] = []
    page.on("pageerror", (error) => errors.push(error.message))
    page.on("console", (message) => {
      if (
        message.type() === "error" &&
        /maximum update depth|react error #185|app route error/i.test(message.text())
      ) {
        errors.push(message.text())
      }
    })
    await mockPublicResourceDirectory(page, [shelter])
    await page.route("**/api/public/resource-map/items/**", (route) =>
      route.fulfill({ json: { version: 1, resourceItem: shelter } })
    )
    await page.goto("/resources?react-grab=0")
    const search = page.getByRole("searchbox", {
      name: "Find organizations and resources",
    })
    await search.fill("housing")
    const result = page
      .locator('[data-public-map-result-trigger="true"]')
      .filter({ hasText: shelter.title })
    await expect(result).toBeVisible()
    await result.click()
    const detail = page.getByRole("region", { name: "Resource profile", exact: true })
    await expect(
      detail.getByRole("heading", { name: shelter.title, exact: true })
    ).toBeVisible()
    await expect(
      detail.getByText("Oak Park", { exact: false }).first()
    ).toBeVisible()
    await expect(
      page.getByText("Something went wrong", { exact: true })
    ).toHaveCount(0)
    await detail.getByRole("button", { name: "Back to search" }).click()
    await expect(search).toHaveValue("housing")
    await result.click()
    await expect(
      detail.getByRole("heading", { name: shelter.title, exact: true })
    ).toBeVisible()
    expect(errors).toEqual([])
  })
}
