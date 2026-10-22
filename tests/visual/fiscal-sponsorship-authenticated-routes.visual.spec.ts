import { createHash, randomUUID } from "node:crypto"
import { readFileSync } from "node:fs"
import { join } from "node:path"

import { createClient, type User } from "@supabase/supabase-js"
import { expect, test, type APIResponse, type Page } from "@playwright/test"

const PRODUCTION_SUPABASE_HOST = "vswzhuwjtgzrkxknrmxu.supabase.co"
const ORGANIZATION_NAME = "Authenticated Route QA Organization"
const PROJECT_NAME = "Authenticated Fiscal Route QA Project"
const SOURCE_PDF_BYTES = readFileSync(
  join(
    process.cwd(),
    "public/fiscal-sponsorship/form-b-fiscal-sponsorship-agreement.pdf"
  )
)
const SOURCE_PDF_SHA256 = createHash("sha256")
  .update(SOURCE_PDF_BYTES)
  .digest("hex")

function requireEnvironment(name: string) {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`${name} is required.`)
  return value
}

const qaUrl = requireEnvironment("FISCAL_AUTH_QA_SUPABASE_URL")
const qaServiceRoleKey = requireEnvironment("FISCAL_AUTH_QA_SERVICE_ROLE_KEY")

if (
  process.env.FISCAL_AUTH_QA_ALLOW_SEED !== "preview-branch" ||
  new URL(qaUrl).hostname === PRODUCTION_SUPABASE_HOST
) {
  throw new Error("Fiscal auth route fixtures require a preview branch.")
}

const admin = createClient(qaUrl, qaServiceRoleKey, {
  auth: { persistSession: false },
})

type AccountKey = "applicant" | "assignedCoach" | "operator" | "deniedCoach"
type QaAccount = {
  email: string
  id: string
  name: string
  password: string
}

const createdUsers: User[] = []
const accounts = {} as Record<AccountKey, QaAccount>
const fixtureIds = {
  application: randomUUID(),
  document: randomUUID(),
  downloadDocument: randomUUID(),
  packet: randomUUID(),
  project: randomUUID(),
  tamperedDocument: randomUUID(),
}
const storagePath = `qa/${fixtureIds.application}/executed-form-b.pdf`

async function expectWriteSucceeded(
  label: string,
  operation: PromiseLike<{ error: { message?: string } | null }>
) {
  const result = await operation
  if (result.error) {
    throw new Error(
      `${label}: ${result.error.message ?? "unknown database error"}`
    )
  }
}

async function createAccount(key: AccountKey, name: string, suffix: string) {
  const email = `fiscal-auth-${key}-${suffix}@example.test`
  const password = `FiscalRoute-${suffix}-9!`
  const { data, error } = await admin.auth.admin.createUser({
    app_metadata: { legal_consent_exempt: "service_provisioned" },
    email,
    email_confirm: true,
    password,
    user_metadata: {
      full_name: name,
      onboarding_completed: true,
      onboarding_intent_focus: "fund",
    },
  })
  if (error || !data.user) {
    throw new Error(`${key} auth fixture: ${error?.message ?? "user missing"}`)
  }

  createdUsers.push(data.user)
  accounts[key] = { email, id: data.user.id, name, password }
}

async function seedFixture() {
  const suffix = randomUUID().replaceAll("-", "").slice(0, 12)
  await createAccount("applicant", "Fiscal QA Applicant", suffix)
  await createAccount("assignedCoach", "Fiscal QA Assigned Coach", suffix)
  await createAccount("operator", "Fiscal QA Sponsor Operator", suffix)
  await createAccount("deniedCoach", "Fiscal QA Unassigned Coach", suffix)

  await expectWriteSucceeded(
    "profile fixtures",
    admin.from("profiles").upsert(
      Object.values(accounts).map((account) => ({
        email: account.email,
        full_name: account.name,
        id: account.id,
        is_tester: true,
      })),
      { onConflict: "id" }
    )
  )
  await expectWriteSucceeded(
    "organization fixture",
    admin.from("organizations").insert({
      profile: {
        formationStatus: "registered",
        name: ORGANIZATION_NAME,
      },
      user_id: accounts.applicant.id,
    })
  )
  await expectWriteSucceeded(
    "staff fixtures",
    admin.from("platform_staff_members").insert([
      {
        access_level: "coach",
        granted_by: accounts.operator.id,
        user_id: accounts.assignedCoach.id,
      },
      {
        access_level: "developer",
        granted_by: accounts.operator.id,
        user_id: accounts.operator.id,
      },
      {
        access_level: "coach",
        granted_by: accounts.operator.id,
        user_id: accounts.deniedCoach.id,
      },
    ])
  )
  await expectWriteSucceeded(
    "coach assignment fixture",
    admin.from("organization_coach_assignments").insert({
      assigned_by: accounts.operator.id,
      coach_user_id: accounts.assignedCoach.id,
      organization_id: accounts.applicant.id,
    })
  )
  await expectWriteSucceeded(
    "subscription fixture",
    admin.from("subscriptions").insert({
      metadata: { plan_tier: "organization", source: "fiscal_auth_route_qa" },
      status: "active",
      stripe_subscription_id: `qa_fiscal_auth_${suffix}`,
      user_id: accounts.applicant.id,
    })
  )
  await expectWriteSucceeded(
    "project fixture",
    admin.from("organization_projects").insert({
      created_by: accounts.applicant.id,
      end_date: "2027-12-31",
      id: fixtureIds.project,
      name: PROJECT_NAME,
      org_id: accounts.applicant.id,
      start_date: "2026-08-06",
    })
  )
  await expectWriteSucceeded(
    "application fixture",
    admin.from("fiscal_sponsorship_applications").insert({
      applicant_full_name: accounts.applicant.name,
      applicant_first_name: "Fiscal",
      applicant_last_name: "Applicant",
      created_by: accounts.applicant.id,
      document_template_payload: {
        agreement: { organizationName: ORGANIZATION_NAME },
      },
      id: fixtureIds.application,
      legal_entity_type: "individual",
      mailing_city: "Chicago",
      mailing_postal_code: "60601",
      mailing_state: "IL",
      mailing_street_address: "100 Test Avenue",
      org_id: accounts.applicant.id,
      phone_number: "312-555-0100",
      primary_email: accounts.applicant.email,
      project_id: fixtureIds.project,
      project_name: PROJECT_NAME,
      source_snapshot: {
        organization: { name: ORGANIZATION_NAME },
      },
      status: "agreement_ready",
      updated_by: accounts.applicant.id,
    })
  )

  const fields = {
    applicantFullName: accounts.applicant.name,
    applicationDate: "2026-08-06",
    legalEntityName: ORGANIZATION_NAME,
    legalEntityType: "Individual",
    mailingCity: "Chicago",
    mailingPostalCode: "60601",
    mailingState: "IL",
    mailingStreetAddress: "100 Test Avenue",
    mailingStreetAddress2: "",
    phoneNumber: "312-555-0100",
    primaryEmail: accounts.applicant.email,
    projectId: fixtureIds.project,
    projectName: PROJECT_NAME,
  }

  await expectWriteSucceeded(
    "agreement document fixture",
    admin.from("fiscal_sponsorship_documents").insert({
      application_id: fixtureIds.application,
      field_values: fields,
      generated_by: accounts.operator.id,
      id: fixtureIds.document,
      kind: "agreement",
      org_id: accounts.applicant.id,
      project_id: fixtureIds.project,
      review_status: "accepted",
      status: "sent_for_signature",
      storage_bucket: "fiscal-signing",
      template_key: "form_b_fiscal_sponsorship_agreement",
      template_sha256:
        "21245b9560f49a42e981e1c3335e2186f70978e8b34c3e09f4112b199ac77c42",
      template_version: 2,
      title: "Form B Fiscal Sponsorship Agreement",
    })
  )
  await expectWriteSucceeded(
    "stored PDF fixture",
    admin.storage.from("fiscal-signing").upload(storagePath, SOURCE_PDF_BYTES, {
      contentType: "application/pdf",
      upsert: false,
    })
  )
  await expectWriteSucceeded(
    "download document fixtures",
    admin.from("fiscal_sponsorship_documents").insert([
      {
        application_id: fixtureIds.application,
        file_sha256: SOURCE_PDF_SHA256,
        generated_by: accounts.operator.id,
        id: fixtureIds.downloadDocument,
        kind: "executed_agreement",
        mime: "application/pdf",
        org_id: accounts.applicant.id,
        project_id: fixtureIds.project,
        review_status: "accepted",
        size_bytes: SOURCE_PDF_BYTES.byteLength,
        status: "executed",
        storage_bucket: "fiscal-signing",
        storage_path: storagePath,
        title: "Executed Form B QA",
        version: 1,
      },
      {
        application_id: fixtureIds.application,
        file_sha256: "0".repeat(64),
        generated_by: accounts.operator.id,
        id: fixtureIds.tamperedDocument,
        kind: "executed_agreement",
        mime: "application/pdf",
        org_id: accounts.applicant.id,
        project_id: fixtureIds.project,
        review_status: "accepted",
        size_bytes: SOURCE_PDF_BYTES.byteLength,
        status: "executed",
        storage_bucket: "fiscal-signing",
        storage_path: storagePath,
        title: "Tampered Form B QA",
        version: 2,
      },
    ])
  )
  await expectWriteSucceeded(
    "signature packet fixture",
    admin.from("fiscal_sponsorship_signature_packets").insert({
      applicant_signer_email: accounts.applicant.email,
      applicant_signer_id: accounts.applicant.id,
      applicant_signer_name: accounts.applicant.name,
      application_id: fixtureIds.application,
      coach_signer_email: accounts.operator.email,
      coach_signer_id: accounts.operator.id,
      coach_signer_name: accounts.operator.name,
      document_id: fixtureIds.document,
      id: fixtureIds.packet,
      org_id: accounts.applicant.id,
      project_id: fixtureIds.project,
      provider: "native",
      sent_at: new Date().toISOString(),
      sent_by: accounts.operator.id,
      status: "sent",
      template_version: "2",
    })
  )
  await expectWriteSucceeded(
    "applicant draft fixture",
    admin.from("fiscal_sponsorship_signing_drafts").insert({
      application_id: fixtureIds.application,
      confirmed_fields: Object.keys(fields).filter(
        (field) => field !== "mailingStreetAddress2"
      ),
      field_values: fields,
      org_id: accounts.applicant.id,
      packet_id: fixtureIds.packet,
      project_id: fixtureIds.project,
      signature_method: "typed",
      signature_value: accounts.applicant.name,
      signer_id: accounts.applicant.id,
      signer_role: "applicant",
      signer_title: "Project Director",
    })
  )
}

async function signInAs(page: Page, account: QaAccount, redirectPath: string) {
  await page.goto(`/team/login?redirect=${encodeURIComponent(redirectPath)}`)
  await page.getByLabel("Email").fill(account.email)
  await page.locator('input[name="password"]').fill(account.password)
  await page.getByRole("button", { name: "Sign in" }).click()
  await expect(page).toHaveURL((url) => url.pathname === redirectPath, {
    timeout: 60_000,
  })
}

async function expectVerifiedDownload(response: APIResponse) {
  expect(response.status()).toBe(200)
  expect(response.headers()["cache-control"]).toContain("private, no-store")
  expect(response.headers()["content-disposition"]).toBe(
    'attachment; filename="Executed-Form-B-QA.pdf"'
  )
  expect(response.headers()["content-type"]).toContain("application/pdf")
  expect(response.headers()["x-document-sha256"]).toBe(SOURCE_PDF_SHA256)
  expect(
    createHash("sha256")
      .update(await response.body())
      .digest("hex")
  ).toBe(SOURCE_PDF_SHA256)
}

test.describe.serial("authenticated fiscal sponsorship routes", () => {
  test.beforeAll(async () => {
    await seedFixture()
  })

  test.afterAll(async () => {
    const cleanupOperations = [
      [
        "draft cleanup",
        admin
          .from("fiscal_sponsorship_signing_drafts")
          .delete()
          .eq("packet_id", fixtureIds.packet),
      ],
      [
        "packet cleanup",
        admin
          .from("fiscal_sponsorship_signature_packets")
          .delete()
          .eq("id", fixtureIds.packet),
      ],
      [
        "document cleanup",
        admin
          .from("fiscal_sponsorship_documents")
          .delete()
          .in("id", [
            fixtureIds.document,
            fixtureIds.downloadDocument,
            fixtureIds.tamperedDocument,
          ]),
      ],
      [
        "stored PDF cleanup",
        admin.storage.from("fiscal-signing").remove([storagePath]),
      ],
      [
        "application cleanup",
        admin
          .from("fiscal_sponsorship_applications")
          .delete()
          .eq("id", fixtureIds.application),
      ],
      [
        "project cleanup",
        admin
          .from("organization_projects")
          .delete()
          .eq("id", fixtureIds.project),
      ],
      [
        "coach assignment cleanup",
        admin
          .from("organization_coach_assignments")
          .delete()
          .eq("organization_id", accounts.applicant.id),
      ],
      [
        "subscription cleanup",
        admin
          .from("subscriptions")
          .delete()
          .eq("user_id", accounts.applicant.id),
      ],
      [
        "organization cleanup",
        admin
          .from("organizations")
          .delete()
          .eq("user_id", accounts.applicant.id),
      ],
      [
        "staff cleanup",
        admin
          .from("platform_staff_members")
          .delete()
          .in("user_id", [
            accounts.assignedCoach.id,
            accounts.operator.id,
            accounts.deniedCoach.id,
          ]),
      ],
    ] as const
    for (const [label, operation] of cleanupOperations) {
      await expectWriteSucceeded(label, operation)
    }

    const deletionOrder: AccountKey[] = [
      "applicant",
      "deniedCoach",
      "assignedCoach",
      "operator",
    ]
    for (const key of deletionOrder) {
      const user = createdUsers.find(
        (candidate) => candidate.id === accounts[key]?.id
      )
      if (!user) continue
      const { error } = await admin.auth.admin.deleteUser(user.id)
      if (error) throw new Error(`${key} cleanup: ${error.message}`)
    }
  })

  test("signed-out visitors preserve the signing return path", async ({
    page,
  }) => {
    const signingPath = `/fiscal-sponsorship/sign/${fixtureIds.packet}`
    const unauthorizedDownload = await page.request.get(
      `/api/fiscal-sponsorship/documents/${fixtureIds.downloadDocument}?download=1`
    )
    expect(unauthorizedDownload.status()).toBe(401)

    await page.goto(signingPath)
    await expect(page).toHaveURL((url) => {
      return (
        url.pathname === "/login" &&
        url.searchParams.get("redirect") === signingPath
      )
    })
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible()
  })

  test("applicant loads Form B, its verified PDF preview, and W-9", async ({
    page,
  }) => {
    const signingPath = `/fiscal-sponsorship/sign/${fixtureIds.packet}`
    await signInAs(page, accounts.applicant, signingPath)
    await expect(
      page.getByRole("heading", { name: "Sign Form B Agreement" })
    ).toBeVisible()
    await expect(page.getByText("Review the prefilled fields")).toBeVisible()
    await expect(page.getByText("Changes save automatically")).toBeVisible()

    const preview = await page.request.get(
      `/api/fiscal-sponsorship/signing/${fixtureIds.packet}/preview`
    )
    expect(preview.status()).toBe(200)
    expect(preview.headers()["content-type"]).toContain("application/pdf")
    expect(preview.headers()["x-document-sha256"]).toMatch(/^[a-f0-9]{64}$/)
    expect((await preview.body()).byteLength).toBeGreaterThan(10_000)

    const download = await page.request.get(
      `/api/fiscal-sponsorship/documents/${fixtureIds.downloadDocument}?download=1`
    )
    await expectVerifiedDownload(download)
    const tamperedDownload = await page.request.get(
      `/api/fiscal-sponsorship/documents/${fixtureIds.tamperedDocument}?download=1`
    )
    expect(tamperedDownload.status()).toBe(409)
    await expect(tamperedDownload.json()).resolves.toEqual({
      error: "Document integrity verification failed.",
    })

    await page.goto(`/fiscal-sponsorship/w9/${fixtureIds.project}`)
    await expect(
      page.getByRole("heading", { name: "Complete IRS Form W-9" })
    ).toBeVisible()
    await expect(page.getByText(PROJECT_NAME, { exact: false })).toBeVisible()
    await expect(
      page.getByText(ORGANIZATION_NAME, { exact: false })
    ).toBeVisible()
  })

  test("assigned coach loads the reviewer state", async ({ page }) => {
    const signingPath = `/fiscal-sponsorship/sign/${fixtureIds.packet}`
    await signInAs(page, accounts.assignedCoach, signingPath)
    await expect(
      page.getByRole("heading", { name: "Sign Form B Agreement" })
    ).toBeVisible()
    await expect(
      page.getByText("Waiting for the applicant to sign first.")
    ).toBeVisible()
    await expectVerifiedDownload(
      await page.request.get(
        `/api/fiscal-sponsorship/documents/${fixtureIds.downloadDocument}?download=1`
      )
    )
  })

  test("sponsor operator loads the reviewer state", async ({ page }) => {
    const signingPath = `/fiscal-sponsorship/sign/${fixtureIds.packet}`
    await signInAs(page, accounts.operator, signingPath)
    await expect(
      page.getByRole("heading", { name: "Sign Form B Agreement" })
    ).toBeVisible()
    await expect(
      page.getByText("Waiting for the applicant to sign first.")
    ).toBeVisible()
    await expectVerifiedDownload(
      await page.request.get(
        `/api/fiscal-sponsorship/documents/${fixtureIds.downloadDocument}?download=1`
      )
    )
  })

  test("unassigned coach receives no signing session", async ({ page }) => {
    const signingPath = `/fiscal-sponsorship/sign/${fixtureIds.packet}`
    await signInAs(page, accounts.deniedCoach, signingPath)
    await expect(
      page.getByText("Signing Session Unavailable", { exact: true })
    ).toBeVisible()
    await expect(
      page.getByText("You are not assigned to this signature packet.")
    ).toBeVisible()
    const deniedDownload = await page.request.get(
      `/api/fiscal-sponsorship/documents/${fixtureIds.downloadDocument}?download=1`
    )
    expect(deniedDownload.status()).toBe(404)
  })
})
