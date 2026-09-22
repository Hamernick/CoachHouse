import { existsSync } from "node:fs"
import { test, type Page } from "@playwright/test"

/** Use a separately reviewed Linux reference when one exists; preserve the original. */
export function reviewedPlatformScreenshotName(name: string) {
  if (process.platform !== "linux") return name
  const linuxName = name.replace(/\.png$/, "-linux.png")
  return existsSync(test.info().snapshotPath(linuxName)) ? linuxName : name
}

/** Developer tooling loads asynchronously and is not part of the product screenshot. */
export async function prepareVisualPage(page: Page) {
  await page.route("https://unpkg.com/react-grab@*/**", (route) =>
    route.fulfill({ body: "", contentType: "application/javascript" })
  )
}
