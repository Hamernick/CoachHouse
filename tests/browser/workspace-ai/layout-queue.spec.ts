import { expect, test, type Page } from "@playwright/test"

test.use({ contextOptions: { reducedMotion: "reduce" } })
const state = async (page: Page) => JSON.parse(await page.getByTestId("layout-state").textContent() ?? "{}")
const click = (page: Page, name: string) => page.getByRole("button", { name, exact: true }).click()

test("saved layout waits for graph, editability and projected nodes, then preserves manual and locked cards", async ({ page }) => {
  await page.goto("/layout-queue.html")
  const before = (await state(page)).nodes
  await click(page, "Receive save receipt")
  await expect(page.getByTestId("save-completed")).toHaveText("0")
  await expect(page.getByTestId("layout-state")).toContainText('"revision":0')
  await click(page, "Render saved graph")
  await expect(page.getByTestId("layout-state")).toContainText('"revision":1')
  expect((await state(page)).phase).toBe("idle")
  await click(page, "Finish save render")
  await expect(page.getByTestId("layout-state")).toContainText('"editable":true')
  expect((await state(page)).phase).toBe("idle")
  await click(page, "Project saved nodes")
  await expect(page.getByTestId("layout-state")).toContainText('"message":"Arranged 2 Particles."')
  await expect(page.getByTestId("save-completed")).toHaveText("1")
  const after = await state(page)
  expect(after.commits).toBe(1)
  expect(after.nodes.slice(0, 2)).toEqual(before.slice(0, 2))
  expect(after.saved.slice(0, 2)).toEqual(before.slice(0, 2))
  expect(after.nodes.slice(2, 4)).toEqual(after.saved.slice(2))
  expect(after.nodes.at(-1)).toEqual(before.at(-1))
  const legacy = after.nodes.at(-1)
  for (const node of after.nodes.slice(2, 4)) {
    expect(node.position.x + 280 <= legacy.position.x || legacy.position.x + 280 <= node.position.x || node.position.y + 180 <= legacy.position.y || legacy.position.y + 180 <= node.position.y).toBe(true)
  }
  // The UI's completion promise cannot beat the persisted layout transaction.
  // An immediate reload after completion must restore arranged coordinates.
  await page.reload()
  await expect(page.getByTestId("layout-state")).toContainText('"revision":2')
  expect((await state(page)).saved).toEqual(after.saved)
})

for (const boundary of ["Switch canvas transport", "Cancel queued layout", "Toggle layout mount"]) test(`queued layout is discarded by ${boundary}`, async ({ page }) => {
  await page.goto("/layout-queue.html")
  await click(page, "Receive save receipt")
  await click(page, boundary)
  await expect(page.getByTestId("save-completed")).toHaveText("1")
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

test("superseding a queued request settles its caller without completing the replacement", async ({ page }) => {
  await page.goto("/layout-queue.html")
  await click(page, "Receive save receipt")
  await click(page, "Receive save receipt")
  await expect(page.getByTestId("save-completed")).toHaveText("1")
  expect((await state(page)).commits).toBe(0)
  await click(page, "Cancel queued layout")
  await expect(page.getByTestId("save-completed")).toHaveText("2")
})

test("failed optional arrangement settles after the saved graph without a layout write", async ({ page }) => {
  await page.goto("/layout-queue.html")
  await click(page, "Receive save receipt")
  await click(page, "Render saved graph")
  await click(page, "Project saved nodes")
  await click(page, "Fail pending moves")
  await click(page, "Finish save render")
  await expect(page.getByTestId("save-completed")).toHaveText("1")
  expect(await state(page)).toMatchObject({ revision: 1, phase: "idle", commits: 0, message: "Save pending moves before arranging." })
})
