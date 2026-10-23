import { test, expect } from "@playwright/test"

test.beforeEach(async ({ request }) => { await request.post("/__fixture/reset") })
async function selectNeighborhood(page: import("@playwright/test").Page, label = "Mission document") {
  const editor = page.getByLabel(label, { exact: true })
  await editor.click()
  await editor.evaluate(element => {
    // Browser-native text selection avoids macOS/Linux Home-key differences.
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT)
    let node: Node | null
    while ((node = walker.nextNode())) {
      const index = node.textContent?.indexOf("neighborhood") ?? -1
      if (index < 0) continue
      const range = document.createRange()
      range.setStart(node, index); range.setEnd(node, index + 12)
      const selection = window.getSelection()!
      selection.removeAllRanges(); selection.addRange(range)
      document.dispatchEvent(new Event("selectionchange"))
      return
    }
    throw new Error("Selection fixture text is missing")
  })
  await page.getByRole("group", { name: `${label} selected text formatting`, exact: true }).getByRole("button", { name: "Ask for changes", exact: true }).click()
  await expect(page.getByRole("region", { name: "Change selected text" }).getByRole("blockquote")).toHaveText("neighborhood")
  await page.getByRole("textbox", { name: "Requested changes" }).fill("Make this more inclusive")
  await page.getByRole("button", { name: "Generate selection suggestion" }).click()
  await expect(page.getByRole("button", { name: "Apply", exact: true })).toBeVisible()
  return editor
}
test("selection proposal stays private, replaces only the range and uses normal save/reopen", async ({ page, request }) => {
  await page.goto("/")
  const editor = await selectNeighborhood(page)
  await expect(editor).toHaveText("We support neighborhood gardens.")
  await page.getByRole("button", { name: "Apply", exact: true }).click()
  await expect(editor).toHaveText("We support community gardens.")
  await expect(editor.locator("strong")).toHaveText("community")
  await page.getByRole("button", { name: "Discard selection suggestion" }).click()
  await page.getByRole("button", { name: "Save document", exact: true }).click()
  await expect(page.getByTestId("editor-state")).toContainText("Saved")
  await page.getByRole("button", { name: "Reopen document" }).click()
  await expect(page.getByLabel("Mission document", { exact: true })).toHaveText("We support community gardens.")
  const state = await (await request.get("/__fixture/state")).json()
  expect(state.generations).toBe(1)
  expect(state.saves).toBe(1)
})
test("typing after a request preserves the suggestion and blocks stale replacement", async ({ page }) => {
  await page.goto("/")
  const editor = await selectNeighborhood(page)
  await editor.press("End")
  await editor.pressSequentially(" Updated.")
  await expect(page.getByRole("button", { name: "Apply", exact: true })).toBeDisabled()
  await expect(editor).toContainText("Updated.")
  await expect(page.getByLabel("Suggested replacement")).toContainText("community")
})
test("native undo restores only the selection edit", async ({ page }) => {
  await page.goto("/")
  const editor = await selectNeighborhood(page)
  await page.getByRole("button", { name: "Apply", exact: true }).click()
  await expect(editor).toContainText("community")
  await page.getByRole("button", { name: "Discard selection suggestion" }).click()
  await editor.press("ControlOrMeta+z")
  await expect(editor).toHaveText("We support neighborhood gardens.")
})


test("local note sessions and collaborative sessions receive native selection transactions", async ({ page }) => {
  await page.goto("/?selection-session")
  const note = await selectNeighborhood(page, "Session note")
  await page.getByRole("button", { name: "Apply", exact: true }).click()
  await expect(note).toHaveText("We support community gardens.")
  await expect(page.getByLabel("Saved note draft")).toContainText("community")
  await page.getByRole("button", { name: "Discard selection suggestion" }).click()
  const shared = page.getByLabel("Shared document", { exact: true })
  await shared.fill("We support neighborhood gardens.")
  const collaborator = page.getByLabel("Collaborator document", { exact: true })
  await expect(collaborator).toHaveText("We support neighborhood gardens.")
  await selectNeighborhood(page, "Shared document")
  await page.getByRole("button", { name: "Apply", exact: true }).click()
  await expect(collaborator).toHaveText("We support community gardens.")
  await page.getByRole("button", { name: "Discard selection suggestion" }).click()
  await shared.press("ControlOrMeta+z")
  await expect(collaborator).toHaveText("We support neighborhood gardens.")
})
test("collaborator edits block a stale selection; narrow dark review stays inside viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.emulateMedia({ reducedMotion: "reduce", colorScheme: "dark" })
  await page.goto("/?selection-session")
  await page.locator("html").evaluate(element => element.classList.add("dark"))
  const shared = page.getByLabel("Shared document", { exact: true })
  await shared.fill("We support neighborhood gardens.")
  await selectNeighborhood(page, "Shared document")
  const panel = page.getByRole("region", { name: "Change selected text" })
  const bounds = await panel.boundingBox()
  expect(bounds!.x).toBeGreaterThanOrEqual(0)
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390)
  await page.screenshot({ path: "/tmp/workspace-selection-review-dark.png", fullPage: false })
  await page.getByLabel("Collaborator document", { exact: true }).fill("A collaborator changed the document.")
  await expect(page.getByRole("button", { name: "Apply", exact: true })).toBeDisabled()
  await expect(shared).toHaveText("A collaborator changed the document.")
})
