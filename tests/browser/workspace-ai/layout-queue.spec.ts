import { expect, test, type Page } from "@playwright/test"

test.use({ contextOptions: { reducedMotion: "reduce" } })
const state = async (page: Page) => JSON.parse(await page.getByTestId("layout-state").textContent() ?? "{}")
const click = (page: Page, name: string) => page.getByRole("button", { name, exact: true }).click()

test("saved layout waits for graph, editability and projected nodes, then preserves manual and locked cards", async ({ page }) => {
  await page.goto("/layout-queue.html")
  const before = (await state(page)).nodes
  await click(page, "Receive save receipt")
  await expect(page.getByTestId("layout-state")).toContainText('"revision":0')
  await click(page, "Render saved graph")
  await expect(page.getByTestId("layout-state")).toContainText('"revision":1')
  expect((await state(page)).phase).toBe("idle")
  await click(page, "Finish save render")
  await expect(page.getByTestId("layout-state")).toContainText('"editable":true')
  expect((await state(page)).phase).toBe("idle")
  await click(page, "Project saved nodes")
  await expect(page.getByTestId("layout-state")).toContainText('"message":"Arranged 2 Particles."')
  const after = await state(page)
  expect(after.commits).toBe(1)
  expect(after.nodes.slice(0, 2)).toEqual(before)
  expect(after.saved.slice(0, 2)).toEqual(before)
  expect(after.nodes.slice(2)).toEqual(after.saved.slice(2))
})

for (const boundary of ["Switch canvas transport", "Cancel queued layout", "Toggle layout mount"]) test(`queued layout is discarded by ${boundary}`, async ({ page }) => {
  await page.goto("/layout-queue.html")
  await click(page, "Receive save receipt")
  await click(page, boundary)
  if (boundary === "Toggle layout mount") {
    await expect(page.getByText("Unmounted", { exact: true })).toBeVisible()
    await click(page, boundary)
  }
  await click(page, "Render saved graph")
  await click(page, "Project saved nodes")
  await click(page, "Finish save render")
  await expect(page.getByTestId("layout-state")).toContainText('"editable":true')
  expect(await state(page)).toMatchObject({ phase: "idle", commits: 0 })
})
