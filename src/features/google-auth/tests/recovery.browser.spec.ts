import { createHash } from "node:crypto"
import { expect, test, type Page } from "@playwright/test"

const sdkUrl = "https://accounts.google.com/gsi/client"
const sdk = `
window.authAttempts = [];
window.google = { accounts: { id: {
  initialize(config) { window.authAttempts.push(config); },
  renderButton(element, options) {
    const button = document.createElement('button');
    button.type = 'button'; button.textContent = 'Mock Google sign-in';
    button.onclick = options.click_listener;
    element.appendChild(button);
  }
} } };
`
type ProviderWindow = Window & {
  authAttempts: {
    nonce: string
    callback: (value: { credential: string }) => void
  }[]
}

async function callback(
  page: Page,
  index: number,
  credential = "fixture-credential"
) {
  await page.evaluate(
    ({ index, credential }) => {
      ;(window as unknown as ProviderWindow).authAttempts
        .at(index)!
        .callback({ credential })
    },
    { index, credential }
  )
}

async function attemptCount(page: Page) {
  return page.evaluate(() => (window as unknown as ProviderWindow).authAttempts.length)
}

test("SDK failure and retry preserve form values and drafts; support details work without clipboard", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  let loads = 0
  let documents = 0
  page.on("request", (request) => {
    if (request.isNavigationRequest() && request.frame() === page.mainFrame())
      documents++
  })
  await page.route(sdkUrl, (route) =>
    ++loads === 1
      ? route.abort()
      : route.fulfill({ contentType: "application/javascript", body: sdk })
  )
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: () => Promise.reject(new Error("Denied")) },
    })
  })
  await page.goto("/login?redirect=%2Fworkspace&private=secret-url-value")
  await expect(
    page.getByRole("alert").filter({ hasText: "Google sign-in could not load" })
  ).toBeVisible()
  await page.getByLabel("Email", { exact: true }).fill("fixture@example.org")
  await page.getByLabel("Password", { exact: true }).fill("fixture-password")
  await page.evaluate(() => {
    localStorage.setItem(
      "roadmap-draft:fixture-user:fixture-org",
      "unsaved draft"
    )
    sessionStorage.setItem("document-draft-fixture", "unsaved document")
  })
  await page.getByRole("button", { name: "Trouble signing in?" }).click()
  await page
    .getByRole("button", { name: "Restart sign-in", exact: true })
    .click()
  await expect(
    page.getByRole("button", { name: "Mock Google sign-in" })
  ).toBeVisible()
  await expect(page.getByLabel("Email", { exact: true })).toHaveValue(
    "fixture@example.org"
  )
  await expect(page.getByLabel("Password", { exact: true })).toHaveValue(
    "fixture-password"
  )
  expect(
    await page.evaluate(() => [
      localStorage.getItem("roadmap-draft:fixture-user:fixture-org"),
      sessionStorage.getItem("document-draft-fixture"),
    ])
  ).toEqual(["unsaved draft", "unsaved document"])
  expect(documents).toBe(1)
  expect(loads).toBe(2)
  await page.getByRole("button", { name: "Mock Google sign-in" }).click()
  // Google can display origin_mismatch without delivering any callback to the app.
  await expect(
    page.getByRole("button", { name: "Restart sign-in", exact: true })
  ).toBeEnabled()
  await page.getByRole("button", { name: "Copy sign-in details" }).click()
  const copied = await page
    .getByRole("textbox", { name: "Sign-in details" })
    .inputValue()
  expect(JSON.parse(copied)).toMatchObject({
    stage: "button_clicked",
    lastFailure: "script_unavailable",
    origin: "http://localhost:3146",
  })
  expect(copied).not.toMatch(
    /fixture-password|fixture@example|secret-url-value|unsaved/
  )
  await expect(
    page.getByRole("link", { name: "Open Coach House sign-in" })
  ).toHaveAttribute(
    "href",
    "https://coachhouse.app/login?redirect=%2Fworkspace"
  )
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth
    )
  ).toBe(true)
  await page.screenshot({
    path: ".tmp/google-auth-browser/mobile-recovery.png",
    fullPage: true,
  })
})

test("restart rejects old callbacks, binds the new nonce and permits retry after an expired exchange", async ({
  page,
}) => {
  await page.route(sdkUrl, (route) =>
    route.fulfill({ contentType: "application/javascript", body: sdk })
  )
  const exchanges: { nonce: string; id_token: string }[] = []
  await page.route("**/auth/v1/token**", (route) => {
    exchanges.push(route.request().postDataJSON())
    return route.fulfill({
      status: 400,
      contentType: "application/json",
      body: JSON.stringify({
        error: "invalid_grant",
        error_description: "expired",
      }),
    })
  })
  await page.goto("/login")
  await expect(
    page.getByRole("button", { name: "Mock Google sign-in" })
  ).toBeVisible()
  const previous = await attemptCount(page)
  const oldNonce = await page.evaluate(
    () => (window as unknown as ProviderWindow).authAttempts.at(-1)!.nonce
  )
  await page.getByRole("button", { name: "Trouble signing in?" }).click()
  await page
    .getByRole("button", { name: "Restart sign-in", exact: true })
    .click()
  await expect.poll(() => attemptCount(page)).toBeGreaterThan(previous)
  const nonceHash = await page.evaluate(
    () => (window as unknown as ProviderWindow).authAttempts.at(-1)!.nonce
  )
  expect(nonceHash).not.toBe(oldNonce)
  await callback(page, previous - 1, "stale-credential")
  await page.evaluate(() => {
    const current = (window as unknown as ProviderWindow).authAttempts.at(-1)!
    current.callback({ credential: "fixture-credential" })
    current.callback({ credential: "fixture-credential" })
  })
  await expect(
    page.getByRole("alert").filter({ hasText: "Unable to sign in with Google" })
  ).toBeVisible()
  expect(exchanges).toHaveLength(1)
  expect(exchanges[0].id_token).toBe("fixture-credential")
  expect(createHash("sha256").update(exchanges[0].nonce).digest("hex")).toBe(
    nonceHash
  )
  await expect.poll(() => attemptCount(page)).toBeGreaterThan(previous + 1)
  await callback(page, -1, "retry-credential")
  await expect.poll(() => exchanges.length).toBe(2)
  expect(exchanges[1].nonce).not.toBe(exchanges[0].nonce)
  await expect(
    page.getByRole("button", { name: "Restart sign-in", exact: true })
  ).toBeEnabled()
})

test("successful exchange follows the safe return path and copied details remain public", async ({
  page,
}) => {
  const events: string[] = []
  page.on("console", (message) => {
    if (message.text().includes("google_auth_browser_stage"))
      events.push(message.text())
  })
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"])
  await page.route(sdkUrl, (route) =>
    route.fulfill({ contentType: "application/javascript", body: sdk })
  )
  await page.route("**/auth/v1/token**", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        access_token: "fixture-access-token",
        refresh_token: "fixture-refresh-token",
        token_type: "bearer",
        expires_in: 3600,
        user: {
          id: "00000000-0000-0000-0000-000000000001",
          aud: "authenticated",
          email: "fixture@example.org",
        },
      }),
    })
  )
  await page.goto("/login?redirect=%2Fforgot-password")
  await expect(
    page.getByRole("button", { name: "Mock Google sign-in" })
  ).toBeVisible()
  await page.getByRole("button", { name: "Trouble signing in?" }).click()
  await page.getByRole("button", { name: "Copy sign-in details" }).click()
  await expect(
    page.getByText("Sign-in details copied. Send them to Coach House support.")
  ).toBeVisible()
  const copied = await page.evaluate(() => navigator.clipboard.readText())
  expect(JSON.parse(copied).stage).toBe("ready")
  await page.screenshot({
    path: ".tmp/google-auth-browser/desktop-recovery.png",
    fullPage: true,
  })
  await callback(page, -1)
  await expect(page).toHaveURL((url) => url.pathname === "/forgot-password")
  expect(events.some((event) => JSON.parse(event).stage === "signed_in")).toBe(
    true
  )
  expect(events.join(" ")).not.toMatch(
    /fixture-credential|fixture-access-token|fixture-refresh-token|fixture@example/
  )
})
