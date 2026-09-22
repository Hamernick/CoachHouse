import { expect, test } from "@playwright/test"

test("Brand Identity keeps uploads independent and persists them through reload", async ({
  page,
}) => {
  // Every test gets a fresh browser context; no account or existing kit is changed.
  const image = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a9p8AAAAASUVORK5CYII=",
    "base64"
  )
  const fixture = (name: string) => ({
    name,
    mimeType: "image/png",
    buffer: image,
  })
  await page.goto("/documentation/tools/brand-identity")
  const downloadZip = page.getByRole("button", {
    name: "Download ZIP",
    exact: true,
  })
  await expect(downloadZip).toBeEnabled()
  await expect(
    page.getByRole("textbox", { name: "Actionable 1", exact: true })
  ).toHaveValue("Donate")
  await page
    .getByRole("textbox", { name: "Actionable 3", exact: true })
    .fill("Join")
  await page
    .getByLabel("Primary logo file", { exact: true })
    .setInputFiles(fixture("logo-canary.png"))
  await expect(
    page.getByRole("button", { name: "Replace primary logo", exact: true })
  ).toBeEnabled()
  await page
    .getByLabel("Illustration 01 file", { exact: true })
    .setInputFiles(fixture("illustration-canary.png"))
  await expect(
    page.getByRole("button", { name: "Replace illustration 01", exact: true })
  ).toBeEnabled()
  for (const label of ["Application image", "Vertical post image"]) {
    await page
      .getByLabel(`${label} file`, { exact: true })
      .setInputFiles(fixture(`${label}.png`))
    await expect(
      page.getByRole("button", {
        name: `Replace ${label.toLowerCase()}`,
        exact: true,
      })
    ).toBeEnabled()
  }
  await expect(page.getByText("4 files", { exact: true })).toBeVisible()

  await page.reload()
  await expect(downloadZip).toBeEnabled()
  await expect(
    page.getByRole("textbox", { name: "Actionable 3", exact: true })
  ).toHaveValue("Join")
  for (const name of [
    "primary logo",
    "illustration 01",
    "application image",
    "vertical post image",
  ]) {
    await expect(
      page.getByRole("button", { name: `Replace ${name}`, exact: true })
    ).toBeEnabled()
  }
  for (const name of [
    "Primary logo preview",
    "Illustration 01 preview",
    "Application image preview",
    "Vertical post image preview",
  ]) {
    await expect
      .poll(() =>
        page
          .getByAltText(name, { exact: true })
          .evaluate((element) => (element as HTMLImageElement).naturalWidth)
      )
      .toBe(1)
  }
  await expect(
    page.getByRole("button", { name: "Upload brand mark", exact: true })
  ).toBeEnabled()
  await expect(page.getByText("4 files", { exact: true })).toBeVisible()
  const illustration = page.getByRole("group", {
    name: "Illustration 01 dropzone",
    exact: true,
  })
  await illustration.hover()
  await expect(
    page.getByRole("button", { name: "Download illustration 01", exact: true })
  ).toBeVisible()
  const preview = page.getByAltText("Illustration 01 preview", { exact: true })
  await expect(preview).toHaveCSS("object-fit", "cover")
  await expect(preview).toHaveCSS("padding", "0px")
  await expect(page.getByText("Replace image", { exact: true })).toHaveCount(0)

  const downloaded = page.waitForEvent("download")
  await downloadZip.click()
  expect((await downloaded).suggestedFilename()).toMatch(/\.zip$/)

  await page
    .getByRole("group", { name: "Vertical post image dropzone", exact: true })
    .hover()
  await page
    .getByRole("button", { name: "Remove vertical post image", exact: true })
    .click()
  await expect(page.getByText("3 files", { exact: true })).toBeVisible()
  await page.reload()
  await expect(
    page.getByRole("button", {
      name: "Upload vertical post image",
      exact: true,
    })
  ).toBeEnabled()
  await expect(
    page.getByRole("button", { name: "Replace application image", exact: true })
  ).toBeEnabled()
  await expect(
    page.getByRole("button", { name: "Replace primary logo", exact: true })
  ).toBeEnabled()
  await expect(
    page.getByRole("button", { name: "Replace illustration 01", exact: true })
  ).toBeEnabled()
  await expect(page.getByText("3 files", { exact: true })).toBeVisible()
})
