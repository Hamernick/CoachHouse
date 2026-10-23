import { randomUUID } from "node:crypto"
import { createClient } from "@supabase/supabase-js"
import { expect, type Page } from "@playwright/test"

export function supportQaEnvironment() {
  const required = (name: string) => {
    const value = process.env[`SUPPORT_AUTH_QA_${name}`]?.trim()
    if (!value) throw new Error(`SUPPORT_AUTH_QA_${name} is required`)
    return value
  }
  const url = required("SUPABASE_URL")
  const database = required("POSTGRES_URL")
  const local = new Set(["localhost", "127.0.0.1", "[::1]"])
  if (required("ALLOW_SEED") !== "disposable-local" || !local.has(new URL(url).hostname)
    || !local.has(new URL(database).hostname)) throw new Error("Support fixtures require explicitly disposable loopback Auth and database targets")
  return { url, database, anon: required("ANON_KEY"), service: required("SERVICE_ROLE_KEY") }
}

export type SupportQaAccount = { id: string; email: string; password: string; name: string }
export async function seedWorkspaceSupportFixture() {
  const env = supportQaEnvironment()
  const admin = createClient(env.url, env.service, { auth: { persistSession: false }, global: { fetch: (url, init) => fetch(url, { ...init, signal: AbortSignal.timeout(10_000) }) } })
  const accounts: SupportQaAccount[] = []
  const suffix = randomUUID().slice(0, 8)
  const write = async (operation: PromiseLike<{ error: { message: string } | null }>) => {
    const { error } = await operation
    if (error) throw new Error(error.message)
  }
  const cleanup = async () => {
    // Only exact IDs created by this invocation; never reset the database or use broad deletes.
    for (const account of [...accounts].reverse()) await admin.auth.admin.deleteUser(account.id)
  }
  try {
    for (const name of ["Support admin", "Support coach one", "Support coach two", "Support fourth", "Free fixture", "Paid fixture", "Viewer fixture", "Editor fixture", "Revoked fixture"]) {
      const email = `support-qa-${accounts.length}-${suffix}@example.test`
      const password = `Local-${randomUUID()}-9!`
      const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true,
        app_metadata: { legal_consent_exempt: "service_provisioned" },
        user_metadata: { full_name: name, onboarding_completed: true, onboarding_intent_focus: "fund" } })
      if (error || !data.user) throw new Error(error?.message ?? "Missing fixture user")
      accounts.push({ id: data.user.id, email, password, name: `${name} ${suffix}` })
    }
    await write(admin.from("profiles").upsert(accounts.map(a => ({ id: a.id, email: a.email, full_name: a.name, is_tester: true }))))
    for (const owner of accounts.slice(4, 6)) await write(admin.from("organizations").upsert({ user_id: owner.id,
      profile: { name: owner.name, formationStatus: "registered", roadmap: { sections: [
        { id: "origin_story", content: "<p>Original local fixture.</p>", lastUpdated: new Date().toISOString() },
        { id: "budget", content: "<p>Local budget.</p>", budgetRows: [], lastUpdated: new Date().toISOString() },
      ] } } }))
    await write(admin.from("platform_staff_members").upsert([...accounts.slice(0, 4), accounts[8]].map((a, i) => ({ user_id: a.id, access_level: i === 0 ? "developer" : "coach" }))))
    await write(admin.from("workspace_support_grants").insert([...accounts.slice(0, 4), accounts[8]].map(a => ({ user_id: a.id, revoked_at: a === accounts[8] ? new Date().toISOString() : null }))))
    await write(admin.from("organization_coach_assignments").insert(accounts.slice(1, 4).flatMap(coach => accounts.slice(4, 6).map(org => ({
      coach_user_id: coach.id, organization_id: org.id, assigned_by: accounts[0].id,
    })))))
    await write(admin.from("subscriptions").insert({ user_id: accounts[5].id, status: "active", stripe_subscription_id: `qa_support_${suffix}`, metadata: { plan_tier: "organization" } }))
    await write(admin.from("organization_memberships").insert([
      { org_id: accounts[5].id, member_id: accounts[6].id, role: "member" },
      { org_id: accounts[5].id, member_id: accounts[7].id, role: "staff" },
    ]))
    return { admin, accounts, support: accounts.slice(0, 4), organizations: accounts.slice(4, 6), cleanup }
  } catch (error) { await cleanup(); throw error }
}

export async function loginSupportFixture(page: Page, account: SupportQaAccount) {
  await page.goto("/team/login?redirect=%2Fworkspace")
  await page.getByLabel("Email", { exact: true }).fill(account.email)
  await page.locator('input[name="password"]').fill(account.password)
  await page.getByRole("button", { name: "Sign in", exact: true }).click()
  await expect(page.getByRole("button", { name: "Switch organization", exact: true })).toBeVisible()
}
export async function switchSupportFixture(page: Page, organization: SupportQaAccount) {
  await page.getByRole("button", { name: "Switch organization", exact: true }).click()
  await page.getByPlaceholder("Search by organization, name, or email…").fill(organization.name)
  await page.getByRole("option").filter({ hasText: organization.name }).click()
  await expect(page.getByRole("button", { name: "Switch organization", exact: true })).toContainText(organization.name)
  await expect(page.getByText(/Switching to/)).toHaveCount(0)
}
