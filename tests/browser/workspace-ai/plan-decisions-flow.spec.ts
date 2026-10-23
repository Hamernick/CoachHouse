import { test, expect } from "@playwright/test"
test("explicit decisions synchronize list/tree, preserve history, and survive reload", async ({ page }) => {
  await page.route("**/*", route => new URL(route.request().url()).hostname === "127.0.0.1" ? route.continue() : route.abort())
  await page.goto("/?objectives")
  await page.getByRole("button", { name: "Objectives", exact: true }).click()
  await page.getByRole("button", { name: "Launch a volunteer program", exact: true }).click()
  await page.getByRole("button", { name: "Add plan", exact: true }).click()
  await page.getByLabel("Plan name", { exact: true }).fill("Venue plan")
  for (const [index, title] of ["Choose venue", "Host in person", "Host online"].entries()) {
    await page.getByRole("button", { name: "Add item", exact: true }).click()
    await page.getByLabel(`Item ${index + 1} title`, { exact: true }).fill(title)
  }
  await page.getByRole("button", { name: "Save plan", exact: true }).click()
  // Connections remain saved data; the user removed their manual editor.
  await page.evaluate(() => {
    const data = JSON.parse(localStorage.getItem("objective-fixture")!)
    const plan = data.planning.plans[0]
    plan.edges = plan.stepIds.slice(1).map((target: string, index: number) => ({
      id: crypto.randomUUID(), source: plan.stepIds[0], target,
      label: index === 0 ? "Venue available" : "No venue",
    }))
    localStorage.setItem("objective-fixture", JSON.stringify(data))
  })
  await page.reload()
  await page.getByRole("button", { name: "Objectives", exact: true }).click()
  await page.getByRole("button", { name: "Launch a volunteer program", exact: true }).click()
  await page.getByRole("button", { name: "Edit Venue plan plan", exact: true }).click()
  await page.getByRole("button", { name: "Item 1 options", exact: true }).click()
  await page.getByRole("menuitem", { name: "Type", exact: true }).click()
  await page.getByRole("menuitemradio", { name: "Decision", exact: true }).click()
  await page.getByRole("button", { name: "Save plan", exact: true }).click()
  await expect(page.getByRole("dialog")).toHaveCount(0)
  await page.getByRole("button", { name: "Venue plan 0/1 · Awaiting a decision", exact: true }).click()
  await expect(page.getByRole("checkbox", { name: "Host online", exact: true })).toBeDisabled()
  await page.getByRole("combobox", { name: "Outcome for Choose venue in Venue plan", exact: true }).click()
  await page.getByRole("option", { name: "No venue", exact: true }).click()
  await page.getByRole("checkbox", { name: "Host online", exact: true }).check()
  await expect(page.getByRole("button", { name: "Venue plan 2/2", exact: true })).toBeVisible()
  await page.getByRole("button", { name: "Show Venue plan tree", exact: true }).click()
  await expect(page.getByRole("checkbox", { name: "Complete Host in person", exact: true })).toBeDisabled()
  await page.getByRole("combobox", { name: "Tree outcome for Choose venue in Venue plan", exact: true }).click()
  await page.getByRole("option", { name: "Venue available", exact: true }).click()
  await expect(page.getByRole("checkbox", { name: "Complete Host online", exact: true })).toBeChecked()
  await expect(page.getByRole("checkbox", { name: "Complete Host online", exact: true })).toBeDisabled()
  await expect(page.getByRole("checkbox", { name: "Complete Host in person", exact: true })).toBeEnabled()
  await page.screenshot({ path: "/tmp/workspace-plan-decisions.png" })
  await page.reload()
  await page.getByRole("button", { name: "Objectives", exact: true }).click()
  await page.getByRole("button", { name: "Launch a volunteer program", exact: true }).click()
  await page.getByRole("button", { name: "Venue plan 1/2", exact: true }).click()
  const choice = page.getByRole("combobox", { name: "Outcome for Choose venue in Venue plan", exact: true })
  await expect(choice).toContainText("Venue available")
  await choice.click()
  await page.getByRole("option", { name: "Needs information", exact: true }).click()
  await expect(page.getByRole("button", { name: "Venue plan 0/1 · Awaiting a decision", exact: true })).toBeVisible()
  await expect(page.getByRole("checkbox", { name: "Host online", exact: true })).toBeChecked()
  await expect(page.getByRole("checkbox", { name: "Host online", exact: true })).toBeDisabled()
  // Another editor wins after this tree loaded; its revision must not be overwritten.
  await page.getByRole("button", { name: "Show Venue plan tree", exact: true }).click()
  await page.evaluate(() => {
    const data = JSON.parse(localStorage.getItem("objective-fixture")!)
    data.planning.plans[0].revision++
    localStorage.setItem("objective-fixture", JSON.stringify(data))
  })
  await page.getByRole("combobox", { name: "Tree outcome for Choose venue in Venue plan", exact: true }).click()
  await page.getByRole("option", { name: "No venue", exact: true }).click()
  await expect(page.getByRole("alert")).toContainText("changed")
  await expect(page.getByRole("combobox", { name: "Outcome for Choose venue in Venue plan", exact: true })).toContainText("Needs information")

})
