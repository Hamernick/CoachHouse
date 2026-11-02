import { expect, test } from "@playwright/test"

async function setup(page: import("@playwright/test").Page) {
  await page.goto("/?revisions")
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear() })
  await page.reload()
}

async function rename(page: import("@playwright/test").Page) {
  const options = page.getByRole("button", { name: "Options for Workshop preparation", exact: true })
  await options.focus()
  await options.press("Enter")
  await page.getByRole("menuitem", { name: "Rename", exact: true }).click()
  return page.getByRole("textbox", { name: "Plan title", exact: true })
}

test("SDK plan editor saves through the existing writer, reloads, and cancels without writing", async ({ page }) => {
  await setup(page)
  const input = await rename(page)
  await expect(input).toBeFocused()
  await input.fill("Workshop logistics")
  await input.press("Enter")
  await expect(input).toHaveCount(0)
  await page.reload()
  const options = page.getByRole("button", { name: "Options for Workshop logistics", exact: true })
  await expect(options).toBeVisible()
  await options.click()
  await page.getByRole("menuitem", { name: "Rename", exact: true }).click()
  await input.fill("Discard this edit")
  await input.press("Escape")
  await expect(input).toHaveCount(0)
  await expect(options).toBeVisible()
  expect(JSON.parse(await page.getByTestId("revision-state").textContent() ?? "{}").particles[0].data.planning.plans[0].title).toBe("Workshop logistics")
})

test("SDK portal follows light/dark theme and keyboard return, fits mobile, and preserves surrounding styles", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.emulateMedia({ reducedMotion: "reduce" })
  await setup(page)
  const options = page.getByRole("button", { name: "Options for Workshop preparation", exact: true })
  for (const dark of [false, true]) {
    await page.evaluate(value => document.documentElement.classList.toggle("dark", value), dark)
    await options.focus(); await options.press("Enter")
    const item = page.getByRole("menuitem", { name: "Rename", exact: true })
    await expect(item).toBeVisible()
    const tokens = await item.evaluate(element => {
      const styles = getComputedStyle(element.closest("[data-radix-popper-content-wrapper]")!)
      return { gray: styles.getPropertyValue("--gray-0").trim(), radius: styles.getPropertyValue("--radius-xl").trim() }
    })
    expect(tokens.gray).toBe(dark ? "#0d0d0d" : "#ffffff")
    expect(tokens.radius).toBe("0.75rem")
    await item.press("Escape")
    await expect(page.getByRole("menu")).toHaveCount(0)
    await expect(options).toBeFocused()
  }
  const input = await rename(page)
  await expect(input).toBeFocused()
  expect(await input.evaluate(element => getComputedStyle(element).fontSize)).toBe("16px")
  expect(await page.getByRole("button", { name: "Save title" }).evaluate(element => element.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  // SDK foundation is scoped: unrelated Tailwind typography/breakpoints stay intact.
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--breakpoint-sm").trim())).toBe("40rem")
})
