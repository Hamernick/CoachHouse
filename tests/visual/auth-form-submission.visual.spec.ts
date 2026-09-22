import { expect, test } from "@playwright/test"

test("sign-in never sends credentials in the URL before hydration", async ({ browser, baseURL }) => {
  const context = await browser.newContext({ baseURL, javaScriptEnabled: false })
  const page = await context.newPage()
  try {
    await page.goto("/team/login?redirect=%2Fadmin%2Fdashboard")
    await page.getByLabel("Email", { exact: true }).fill("hydration-check@example.com")
    await page.getByLabel("Password", { exact: true }).fill("Disposable-hydration-check")
    // Intercept the native navigation: no authentication or email is attempted.
    await page.route("**/*", async (route) => {
      if (route.request().isNavigationRequest()) {
        await route.fulfill({ status: 200, contentType: "text/html", body: "Submission intercepted" })
      } else {
        await route.continue()
      }
    })
    const submitted = page.waitForRequest((request) => request.isNavigationRequest())
    await page.getByRole("button", { name: "Sign in", exact: true }).click()
    const request = await submitted
    expect(request.method()).toBe("POST")
    expect(request.url()).not.toContain("password=")
    expect(request.url()).not.toContain("hydration-check")
    expect(request.postData()).toContain("password=Disposable-hydration-check")
  } finally {
    await context.close()
  }
})
