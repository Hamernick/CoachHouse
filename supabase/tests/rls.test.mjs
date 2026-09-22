#!/usr/bin/env node
import { randomUUID } from "node:crypto"
import { readFileSync, existsSync } from "node:fs"
import { resolve } from "node:path"

import { createClient } from "@supabase/supabase-js"
import { runResourceMapRlsTests } from "./resource-map-rls.mjs"

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return
  const raw = readFileSync(filePath, "utf8")
  raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .forEach((line) => {
      const idx = line.indexOf("=")
      if (idx === -1) return
      const key = line.slice(0, idx).trim()
      if (!key || process.env[key] !== undefined) return
      let value = line.slice(idx + 1).trim()
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1)
      }
      process.env[key] = value
    })
}

loadEnvFile(resolve(process.cwd(), ".env.local"))

const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !anonKey || !serviceRole) {
  console.log(
    "[supabase] Skipping RLS tests – set SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY."
  )
  process.exit(0)
}

const adminClient = createClient(url, serviceRole, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function tableExists(tableName) {
  const { error } = await adminClient.from(tableName).select("*").limit(1)

  if (!error) return true

  const missing =
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    /could not find|does not exist|not exist/i.test(error.message ?? "")

  if (missing) return false

  throw error
}

const suffix = randomUUID().slice(0, 8)
const memberEmail = `member-${suffix}@example.com`
const adminEmail = `admin-${suffix}@example.com`
const ownerEmail = `owner-${suffix}@example.com`
const staffEmail = `staff-${suffix}@example.com`
const boardEmail = `board-${suffix}@example.com`
const orgAdminEmail = `org-admin-${suffix}@example.com`
const coachEmail = `coach-${suffix}@example.com`
const secondCoachEmail = `coach-2-${suffix}@example.com`
const password = `TempPass!${suffix}`
const signupLegalConsent = {
  version: "2026-09-10.1",
  termsSha256:
    "8757308d709eac552572d79642b0374f6c41ee7c5277b50b961ce9948577e03c",
  privacySha256:
    "dd58c9175fd80b067658f07e503883f4f983c357413092e1533df8aeeccc0135",
  acceptedAt: new Date().toISOString(),
}

async function ensureProfile(id, role, fullName) {
  const { error } = await adminClient.from("profiles").upsert(
    {
      id,
      role,
      full_name: fullName,
    },
    { onConflict: "id" }
  )
  if (error) throw error
}

async function createUsers() {
  // All synthetic users include consent at insertion time; do not depend on
  // exemption metadata being available when the signup trigger executes.
  const {
    data: { user: member },
    error: memberError,
  } = await adminClient.auth.admin.createUser({
    email: memberEmail,
    password,
    email_confirm: true,
    user_metadata: { legal_consent: signupLegalConsent },
  })
  if (memberError) throw memberError

  const {
    data: { user: admin },
    error: adminError,
  } = await adminClient.auth.admin.createUser({
    user_metadata: { legal_consent: signupLegalConsent },
    email: adminEmail,
    password,
    email_confirm: true,
  })
  if (adminError) throw adminError

  const {
    data: { user: owner },
    error: ownerError,
  } = await adminClient.auth.admin.createUser({
    user_metadata: { legal_consent: signupLegalConsent },
    email: ownerEmail,
    password,
    email_confirm: true,
  })
  if (ownerError) throw ownerError

  const {
    data: { user: staff },
    error: staffError,
  } = await adminClient.auth.admin.createUser({
    user_metadata: { legal_consent: signupLegalConsent },
    email: staffEmail,
    password,
    email_confirm: true,
  })
  if (staffError) throw staffError

  const {
    data: { user: board },
    error: boardError,
  } = await adminClient.auth.admin.createUser({
    user_metadata: { legal_consent: signupLegalConsent },
    email: boardEmail,
    password,
    email_confirm: true,
  })
  if (boardError) throw boardError

  const {
    data: { user: orgAdmin },
    error: orgAdminError,
  } = await adminClient.auth.admin.createUser({
    user_metadata: { legal_consent: signupLegalConsent },
    email: orgAdminEmail,
    password,
    email_confirm: true,
  })
  if (orgAdminError) throw orgAdminError

  const {
    data: { user: coach },
    error: coachError,
  } = await adminClient.auth.admin.createUser({
    user_metadata: { legal_consent: signupLegalConsent },
    email: coachEmail,
    password,
    email_confirm: true,
  })
  if (coachError) throw coachError

  const {
    data: { user: secondCoach },
    error: secondCoachError,
  } = await adminClient.auth.admin.createUser({
    user_metadata: { legal_consent: signupLegalConsent },
    email: secondCoachEmail,
    password,
    email_confirm: true,
  })
  if (secondCoachError) throw secondCoachError

  await ensureProfile(member.id, "member", "Test Member")
  await ensureProfile(admin.id, "admin", "Test Admin")
  await ensureProfile(owner.id, "member", "Test Owner")
  await ensureProfile(staff.id, "member", "Test Staff")
  await ensureProfile(board.id, "member", "Test Board")
  await ensureProfile(orgAdmin.id, "member", "Test Org Admin")
  await ensureProfile(coach.id, "member", "Test Coach")
  await ensureProfile(secondCoach.id, "member", "Test Coach Two")

  if (await tableExists("platform_staff_members")) {
    const { error: platformStaffError } = await adminClient
      .from("platform_staff_members")
      .upsert(
        [
          { user_id: admin.id, access_level: "developer" },
          { user_id: coach.id, access_level: "coach" },
          { user_id: secondCoach.id, access_level: "coach" },
        ],
        { onConflict: "user_id" }
      )
    if (platformStaffError) throw platformStaffError
  }

  return { member, admin, owner, staff, board, orgAdmin, coach, secondCoach }
}

async function createDemoContent(memberId) {
  const publishedClassId = randomUUID()
  const unpublishedClassId = randomUUID()
  const moduleId = randomUUID()
  const hiddenModuleId = randomUUID()

  const { error: classErr } = await adminClient.from("classes").insert([
    {
      id: publishedClassId,
      title: "Published Class",
      slug: `published-${suffix}`,
      description: "Visible to members",
      is_published: true,
    },
    {
      id: unpublishedClassId,
      title: "Draft Class",
      slug: `draft-${suffix}`,
      description: "Hidden from members",
      is_published: false,
    },
  ])
  if (classErr) throw classErr

  const { error: moduleErr } = await adminClient.from("modules").insert([
    {
      id: moduleId,
      class_id: publishedClassId,
      idx: 1,
      slug: `module-${suffix}`,
      title: "Kick-off",
      content_md: "# Kick-off",
    },
    {
      id: hiddenModuleId,
      class_id: unpublishedClassId,
      idx: 1,
      slug: `draft-module-${suffix}`,
      title: "Draft",
      content_md: "Hidden",
    },
  ])
  if (moduleErr) throw moduleErr

  const { error: enrollmentErr } = await adminClient
    .from("enrollments")
    .insert({
      user_id: memberId,
      class_id: publishedClassId,
    })
  if (enrollmentErr) throw enrollmentErr

  return { publishedClassId, unpublishedClassId, moduleId, hiddenModuleId }
}

async function run() {
  const { member, admin, owner, staff, board, orgAdmin, coach, secondCoach } =
    await createUsers()
  const assets = await createDemoContent(member.id)

  const memberClient = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const anonClient = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const adminSessionClient = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const ownerClient = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const staffClient = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const boardClient = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const orgAdminClient = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const coachClient = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const secondCoachClient = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  await memberClient.auth.signInWithPassword({ email: memberEmail, password })
  await adminSessionClient.auth.signInWithPassword({
    email: adminEmail,
    password,
  })
  await ownerClient.auth.signInWithPassword({ email: ownerEmail, password })
  await staffClient.auth.signInWithPassword({ email: staffEmail, password })
  await boardClient.auth.signInWithPassword({ email: boardEmail, password })
  await orgAdminClient.auth.signInWithPassword({
    email: orgAdminEmail,
    password,
  })
  await coachClient.auth.signInWithPassword({ email: coachEmail, password })
  await secondCoachClient.auth.signInWithPassword({
    email: secondCoachEmail,
    password,
  })

  const results = []

  if (await tableExists("platform_legal_acceptances")) {
    const { data: ownAcceptance, error: ownAcceptanceError } =
      await memberClient
        .from("platform_legal_acceptances")
        .select(
          "id,user_id,document_version,terms_sha256,privacy_sha256,accepted_at,source"
        )
        .eq("user_id", member.id)
        .eq("document_version", signupLegalConsent.version)
        .maybeSingle()
    results.push({
      name: "signup trigger records the current immutable legal acceptance",
      passed:
        !ownAcceptanceError &&
        ownAcceptance?.user_id === member.id &&
        ownAcceptance?.document_version === signupLegalConsent.version &&
        ownAcceptance?.terms_sha256 === signupLegalConsent.termsSha256 &&
        ownAcceptance?.privacy_sha256 === signupLegalConsent.privacySha256 &&
        ownAcceptance?.source === "signup" &&
        typeof ownAcceptance?.accepted_at === "string" &&
        new Date(ownAcceptance?.accepted_at).toISOString() ===
          new Date(member.created_at).toISOString(),
    })

    const { data: otherAcceptance, error: otherAcceptanceError } =
      await adminSessionClient
        .from("platform_legal_acceptances")
        .select("id")
        .eq("user_id", member.id)
        .maybeSingle()
    results.push({
      name: "authenticated users cannot read another legal acceptance",
      passed: !otherAcceptanceError && !otherAcceptance,
    })

    const { data: anonAcceptance, error: anonAcceptanceError } =
      await anonClient
        .from("platform_legal_acceptances")
        .select("id")
        .eq("user_id", member.id)
    results.push({
      name: "anonymous users cannot read legal acceptances",
      passed:
        !!anonAcceptanceError ||
        (Array.isArray(anonAcceptance) && anonAcceptance.length === 0),
    })

    const acceptanceId = ownAcceptance?.id ?? -1
    const { error: acceptanceInsertError } = await memberClient
      .from("platform_legal_acceptances")
      .insert({
        user_id: member.id,
        document_version: "rls-write-probe",
        terms_sha256: "a".repeat(64),
        privacy_sha256: "b".repeat(64),
        accepted_at: new Date().toISOString(),
        source: "signup",
      })
    const { error: acceptanceUpdateError } = await memberClient
      .from("platform_legal_acceptances")
      .update({ accepted_at: new Date().toISOString() })
      .eq("id", acceptanceId)
    const { error: acceptanceDeleteError } = await memberClient
      .from("platform_legal_acceptances")
      .delete()
      .eq("id", acceptanceId)
    results.push({
      name: "authenticated users cannot mutate immutable legal acceptances",
      passed:
        !!acceptanceInsertError &&
        !!acceptanceUpdateError &&
        !!acceptanceDeleteError,
    })
  }

  if (await tableExists("platform_staff_members")) {
    const [
      { data: coachIsAdmin },
      { data: coachIsStaff },
      { data: ownStaffRow },
    ] = await Promise.all([
      coachClient.rpc("is_admin"),
      coachClient.rpc("is_platform_staff"),
      coachClient
        .from("platform_staff_members")
        .select("access_level")
        .eq("user_id", coach.id)
        .maybeSingle(),
    ])
    results.push({
      name: "coach is platform staff without broad admin access",
      passed:
        coachIsAdmin === false &&
        coachIsStaff === true &&
        ownStaffRow?.access_level === "coach",
    })
  }

  // Profile visibility
  {
    const { data, error } = await memberClient
      .from("profiles")
      .select("id")
      .eq("id", member.id)
      .maybeSingle()
    results.push({ name: "member reads own profile", passed: !!data && !error })

    const { data: otherProfile } = await memberClient
      .from("profiles")
      .select("id")
      .eq("id", admin.id)
      .maybeSingle()
    results.push({
      name: "member cannot read other profile",
      passed: !otherProfile,
    })

    const avatarUrl = `https://example.com/avatar-${suffix}.png`
    const { data: updatedProfile, error: updateError } = await memberClient
      .from("profiles")
      .update({ avatar_url: avatarUrl })
      .eq("id", member.id)
      .select("avatar_url")
      .maybeSingle()
    results.push({
      name: "member can update own profile avatar",
      passed:
        !updateError &&
        !!updatedProfile &&
        updatedProfile.avatar_url === avatarUrl,
    })

    const avatarBytes = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
    const ownAvatarObject = `${member.id}/rls-avatar-${suffix}.png`
    const otherAvatarObject = `${admin.id}/rls-avatar-${suffix}.png`
    const { error: ownAvatarUploadError } = await memberClient.storage
      .from("avatars")
      .upload(ownAvatarObject, avatarBytes, {
        contentType: "image/png",
        upsert: true,
      })
    results.push({
      name: "member can upload avatar to own folder",
      passed: !ownAvatarUploadError,
    })

    const { error: otherAvatarUploadError } = await memberClient.storage
      .from("avatars")
      .upload(otherAvatarObject, avatarBytes, {
        contentType: "image/png",
        upsert: true,
      })
    const avatarFolderDenied =
      !!otherAvatarUploadError &&
      (otherAvatarUploadError.statusCode === "403" ||
        otherAvatarUploadError.statusCode === "401" ||
        /row-level security|permission denied|not allowed/i.test(
          otherAvatarUploadError.message ?? ""
        ))
    results.push({
      name: "member cannot upload avatar to another user's folder",
      passed: avatarFolderDenied,
    })
  }

  // Class visibility
  {
    const { data, error } = await memberClient
      .from("classes")
      .select("id, is_published")
      .order("is_published", { ascending: false })
    const publishedVisible =
      Array.isArray(data) &&
      data.some((row) => row.id === assets.publishedClassId)
    const draftHidden =
      Array.isArray(data) &&
      !data.some((row) => row.id === assets.unpublishedClassId)
    results.push({
      name: "member sees published class",
      passed: publishedVisible && !error,
    })
    results.push({
      name: "member does not see draft class",
      passed: draftHidden,
    })
  }

  // Class insertion RLS
  {
    const { error } = await memberClient.from("classes").insert({
      title: "Forbidden",
      slug: `forbidden-${suffix}`,
      is_published: true,
    })
    results.push({ name: "member cannot insert classes", passed: !!error })
  }

  // Admin update allowed
  {
    const { error } = await adminSessionClient
      .from("classes")
      .update({ title: "Published Class Updated" })
      .eq("id", assets.publishedClassId)
    results.push({ name: "admin can update classes", passed: !error })
  }

  // Module access + progress updates
  {
    const { data, error } = await memberClient
      .from("modules")
      .select("id, class_id")
    const moduleVisible =
      Array.isArray(data) && data.some((row) => row.id === assets.moduleId)
    const draftHidden =
      Array.isArray(data) &&
      !data.some((row) => row.id === assets.hiddenModuleId)
    results.push({
      name: "member sees module for published class",
      passed: moduleVisible && !error,
    })
    results.push({
      name: "member does not see draft module",
      passed: draftHidden,
    })

    const { error: progressErr } = await memberClient
      .from("module_progress")
      .upsert({
        user_id: member.id,
        module_id: assets.moduleId,
        status: "in_progress",
      })
    results.push({
      name: "member can upsert own module progress",
      passed: !progressErr,
    })
  }

  // Assignment submissions + organizations rollup + module assignments visibility
  {
    // Admin defines an assignment schema for the module
    const { error: assignErr } = await adminClient
      .from("module_assignments")
      .upsert({
        module_id: assets.moduleId,
        schema: { fields: [{ name: "org_name", type: "text" }] },
        complete_on_submit: true,
      })
    if (assignErr) throw assignErr

    // Member submits answers
    const { error: submitErr } = await memberClient
      .from("assignment_submissions")
      .upsert({
        module_id: assets.moduleId,
        user_id: member.id,
        answers: { org_name: "Test Org" },
        status: "submitted",
      })
    results.push({
      name: "member can upsert own submission",
      passed: !submitErr,
    })

    // Member can read their submission but not others
    const { data: ownSub } = await memberClient
      .from("assignment_submissions")
      .select("id")
      .eq("user_id", member.id)
      .maybeSingle()
    results.push({ name: "member can read own submission", passed: !!ownSub })

    const { data: otherSub } = await memberClient
      .from("assignment_submissions")
      .select("id")
      .eq("user_id", admin.id)
      .maybeSingle()
    results.push({
      name: "member cannot read others' submissions",
      passed: !otherSub,
    })

    // Organizations rollup visible to member
    const { data: orgRow } = await memberClient
      .from("organizations")
      .select("user_id")
      .eq("user_id", member.id)
      .maybeSingle()
    results.push({
      name: "member can read own organization rollup",
      passed: !!orgRow,
    })

    // Member can read module assignments for enrolled class
    const { data: assignRead, error: assignReadErr } = await memberClient
      .from("module_assignments")
      .select("module_id")
      .eq("module_id", assets.moduleId)
      .maybeSingle()
    results.push({
      name: "member can read module assignment (enrolled)",
      passed: !!assignRead && !assignReadErr,
    })
  }

  let initialCoachScopeEnabled = false
  if (await tableExists("organization_coach_scope_settings")) {
    const { data: initialCoachScope } = await adminClient
      .from("organization_coach_scope_settings")
      .select("assigned_only_enabled")
      .eq("id", true)
      .maybeSingle()
    initialCoachScopeEnabled = initialCoachScope?.assigned_only_enabled === true
  }

  if (await tableExists("organization_coach_assignments")) {
    const { error: developerAssignmentError } = await adminSessionClient.rpc(
      "set_organization_coach_assignments",
      {
        p_organization_id: member.id,
        p_coach_user_ids: [coach.id, secondCoach.id],
      }
    )
    const { data: developerAssignments } = await adminClient
      .from("organization_coach_assignments")
      .select("organization_id, coach_user_id")
      .eq("organization_id", member.id)
    results.push({
      name: "developer can assign multiple coaches to an organization",
      passed:
        !developerAssignmentError &&
        developerAssignments?.length === 2 &&
        developerAssignments.some((row) => row.coach_user_id === coach.id) &&
        developerAssignments.some(
          (row) => row.coach_user_id === secondCoach.id
        ),
    })

    const { data: coachAssignments, error: coachAssignmentError } =
      await coachClient
        .from("organization_coach_assignments")
        .select("organization_id, coach_user_id")
        .eq("organization_id", member.id)
    results.push({
      name: "coach can read organization coach assignments",
      passed:
        !coachAssignmentError &&
        coachAssignments?.length === 2 &&
        coachAssignments.some((row) => row.coach_user_id === coach.id),
    })

    const { data: secondCoachAssignments, error: secondCoachReadError } =
      await secondCoachClient
        .from("organization_coach_assignments")
        .select("organization_id, coach_user_id")
        .eq("organization_id", member.id)
    results.push({
      name: "each assigned coach can read the shared assignment set",
      passed:
        !secondCoachReadError &&
        secondCoachAssignments?.length === 2 &&
        secondCoachAssignments.some(
          (row) => row.coach_user_id === secondCoach.id
        ),
    })

    const { data: memberAssignment, error: memberAssignmentError } =
      await memberClient
        .from("organization_coach_assignments")
        .select("organization_id")
        .eq("organization_id", member.id)
        .maybeSingle()
    results.push({
      name: "regular member cannot read organization coach assignments",
      passed: !memberAssignment && !memberAssignmentError,
    })

    const { error: coachWriteError } = await coachClient
      .from("organization_coach_assignments")
      .update({ assigned_by: coach.id })
      .eq("organization_id", member.id)
      .eq("coach_user_id", coach.id)
    const { data: assignmentAfterCoachWrite } = await adminClient
      .from("organization_coach_assignments")
      .select("assigned_by")
      .eq("organization_id", member.id)
      .eq("coach_user_id", coach.id)
      .maybeSingle()
    results.push({
      name: "coach cannot change organization coach assignments",
      passed:
        !!coachWriteError ||
        assignmentAfterCoachWrite?.assigned_by === admin.id,
    })

    const { error: assignedCoachLevelChangeError } = await adminSessionClient
      .from("platform_staff_members")
      .update({ access_level: "developer" })
      .eq("user_id", coach.id)
    results.push({
      name: "assigned coach cannot be changed to developer before unassignment",
      passed: !!assignedCoachLevelChangeError,
    })
  }

  if (await tableExists("organization_coach_scope_settings")) {
    const { data: coachScopeSetting, error: coachScopeReadError } =
      await coachClient
        .from("organization_coach_scope_settings")
        .select("assigned_only_enabled")
        .eq("id", true)
        .maybeSingle()
    results.push({
      name: "coach can read assigned-only visibility state",
      passed:
        !coachScopeReadError &&
        coachScopeSetting?.assigned_only_enabled === initialCoachScopeEnabled,
    })

    const { data: memberScopeSetting, error: memberScopeReadError } =
      await memberClient
        .from("organization_coach_scope_settings")
        .select("assigned_only_enabled")
        .eq("id", true)
        .maybeSingle()
    results.push({
      name: "regular member cannot read coach visibility state",
      passed: !memberScopeSetting && !memberScopeReadError,
    })

    const { error: coachScopeWriteError } = await coachClient.rpc(
      "set_organization_coach_scope_enabled",
      { p_enabled: false }
    )
    results.push({
      name: "coach cannot change assigned-only visibility",
      passed: !!coachScopeWriteError,
    })

    const { error: directScopeWriteError } = await adminSessionClient
      .from("organization_coach_scope_settings")
      .update({ assigned_only_enabled: !initialCoachScopeEnabled })
      .eq("id", true)
    const { data: scopeAfterDirectWrite, error: scopeAfterDirectWriteError } =
      await adminClient
        .from("organization_coach_scope_settings")
        .select("assigned_only_enabled")
        .eq("id", true)
        .maybeSingle()
    results.push({
      name: "developer cannot bypass the coach visibility RPC",
      passed:
        !!directScopeWriteError ||
        (!scopeAfterDirectWriteError &&
          scopeAfterDirectWrite?.assigned_only_enabled ===
            initialCoachScopeEnabled),
    })

    if (initialCoachScopeEnabled) {
      results.push({
        name: "active production coach visibility stays unchanged during RLS verification",
        passed: scopeAfterDirectWrite?.assigned_only_enabled === true,
      })
    } else {
      const { data: disabledScopeResult, error: disableScopeError } =
        await adminSessionClient.rpc("set_organization_coach_scope_enabled", {
          p_enabled: false,
        })
      const { data: scopeEvent, error: scopeEventError } =
        await adminSessionClient
          .from("organization_coach_scope_events")
          .select("assigned_only_enabled, changed_by")
          .eq("changed_by", admin.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle()
      results.push({
        name: "developer rollback is audited",
        passed:
          !disableScopeError &&
          disabledScopeResult?.assignedOnlyEnabled === false &&
          !scopeEventError &&
          scopeEvent?.assigned_only_enabled === false &&
          scopeEvent?.changed_by === admin.id,
      })
    }
  }

  if (await tableExists("organization_staff_kanban_preferences")) {
    const { error: coachPreferenceError } = await coachClient
      .from("organization_staff_kanban_preferences")
      .insert({
        staff_user_id: coach.id,
        organization_id: member.id,
      })
    results.push({
      name: "coach can hide an organization from their own Kanban",
      passed: !coachPreferenceError,
    })

    const { error: developerPreferenceError } = await adminSessionClient
      .from("organization_staff_kanban_preferences")
      .insert({
        staff_user_id: admin.id,
        organization_id: member.id,
      })
    results.push({
      name: "developer can hide an organization from their own Kanban",
      passed: !developerPreferenceError,
    })

    const { data: coachPreferences, error: coachPreferenceReadError } =
      await coachClient
        .from("organization_staff_kanban_preferences")
        .select("staff_user_id, organization_id")
    results.push({
      name: "platform staff can read only their own Kanban preferences",
      passed:
        !coachPreferenceReadError &&
        coachPreferences?.length === 1 &&
        coachPreferences[0]?.staff_user_id === coach.id,
    })

    const { error: memberPreferenceError } = await memberClient
      .from("organization_staff_kanban_preferences")
      .insert({
        staff_user_id: member.id,
        organization_id: member.id,
      })
    results.push({
      name: "regular member cannot create Kanban preferences",
      passed: !!memberPreferenceError,
    })

    const { error: crossStaffDeleteError } = await adminSessionClient
      .from("organization_staff_kanban_preferences")
      .delete()
      .eq("staff_user_id", coach.id)
      .eq("organization_id", member.id)
    const { data: coachPreferenceAfterDelete } = await adminClient
      .from("organization_staff_kanban_preferences")
      .select("staff_user_id")
      .eq("staff_user_id", coach.id)
      .eq("organization_id", member.id)
      .maybeSingle()
    results.push({
      name: "developer cannot change another staff member's Kanban preferences",
      passed: !!crossStaffDeleteError || !!coachPreferenceAfterDelete,
    })
  }

  let orgAccessReady = false
  let workspaceTablesAvailable = false
  let organizationPeopleSegmentsAvailable = false
  let organizationPeopleTagsAvailable = false
  let workspaceCommunicationsTableAvailable = false
  let workspaceCommunicationChannelsTableAvailable = false
  let workspaceCommunicationDeliveriesTableAvailable = false

  // Organization membership access (multi-account org access)
  {
    const { error: membershipError } = await adminClient
      .from("organization_memberships")
      .insert([
        {
          org_id: member.id,
          member_id: owner.id,
          role: "owner",
          member_email: ownerEmail,
        },
        {
          org_id: member.id,
          member_id: staff.id,
          role: "staff",
          member_email: staffEmail,
        },
        {
          org_id: member.id,
          member_id: board.id,
          role: "board",
          member_email: boardEmail,
        },
        {
          org_id: member.id,
          member_id: orgAdmin.id,
          role: "admin",
          member_email: orgAdminEmail,
        },
      ])
    orgAccessReady = !membershipError
    results.push({
      name: "org access memberships created",
      passed: orgAccessReady,
    })

    if (orgAccessReady) {
      const { data: staffOrg, error: staffOrgError } = await staffClient
        .from("organizations")
        .select("user_id")
        .eq("user_id", member.id)
        .maybeSingle()
      results.push({
        name: "staff can read org via membership",
        passed: !!staffOrg && !staffOrgError,
      })

      const { data: boardOrg, error: boardOrgError } = await boardClient
        .from("organizations")
        .select("user_id")
        .eq("user_id", member.id)
        .maybeSingle()
      results.push({
        name: "board can read org via membership",
        passed: !!boardOrg && !boardOrgError,
      })

      await staffClient
        .from("organizations")
        .update({ profile: { name: "Updated by staff" } })
        .eq("user_id", member.id)

      const { data: staffUpdatedOrg } = await adminClient
        .from("organizations")
        .select("profile")
        .eq("user_id", member.id)
        .maybeSingle()
      results.push({
        name: "staff can update org profile",
        passed: staffUpdatedOrg?.profile?.name === "Updated by staff",
      })

      await boardClient
        .from("organizations")
        .update({ profile: { name: "Updated by board" } })
        .eq("user_id", member.id)

      const { data: boardUpdatedOrg } = await adminClient
        .from("organizations")
        .select("profile")
        .eq("user_id", member.id)
        .maybeSingle()
      results.push({
        name: "board cannot update org profile",
        passed: boardUpdatedOrg?.profile?.name === "Updated by staff",
      })
    }
  }

  // Programs write access for members
  if (
    orgAccessReady &&
    (await tableExists("google_drive_connections")) &&
    (await tableExists("organization_external_documents"))
  ) {
    const documentId = randomUUID()
    const { error: seedError } = await adminClient
      .from("organization_external_documents")
      .insert({
        id: documentId,
        org_id: member.id,
        provider_file_id: `drive-file-${suffix}`,
        name: "Drive document",
        mime_type: "application/vnd.google-apps.document",
        web_view_link: "https://docs.google.com/document/d/test",
        status: "available",
        attached_by: member.id,
      })
    results.push({
      name: "service role can create Google Drive document metadata",
      passed: !seedError,
    })

    for (const [label, client] of [
      ["owner", memberClient],
      ["staff", staffClient],
      ["board", boardClient],
    ]) {
      const { data, error } = await client
        .from("organization_external_documents")
        .select("id")
        .eq("id", documentId)
        .maybeSingle()
      results.push({
        name: `${label} can read organization Google Drive metadata`,
        passed: !!data && !error,
      })
    }

    const { data: unrelatedRead, error: unrelatedReadError } =
      await adminSessionClient
        .from("organization_external_documents")
        .select("id")
        .eq("id", documentId)
    results.push({
      name: "unrelated authenticated user cannot read Google Drive metadata",
      passed:
        !!unrelatedReadError ||
        (Array.isArray(unrelatedRead) && unrelatedRead.length === 0),
    })

    const { error: ownerWriteError } = await memberClient
      .from("organization_external_documents")
      .update({ name: "Forbidden rename" })
      .eq("id", documentId)
    results.push({
      name: "authenticated users cannot write Google Drive metadata directly",
      passed: !!ownerWriteError,
    })

    const { error: credentialReadError } = await memberClient
      .from("google_drive_connections")
      .select("id")
    results.push({
      name: "authenticated users cannot read Google Drive credentials",
      passed: !!credentialReadError,
    })

    await adminClient
      .from("organization_external_documents")
      .delete()
      .eq("id", documentId)
  }

  if (orgAccessReady) {
    const { data: createdProgram, error: staffProgramError } = await staffClient
      .from("programs")
      .insert({ user_id: member.id, title: `Staff Program ${suffix}` })
      .select("id")
      .maybeSingle()
    results.push({
      name: "staff can insert programs for org",
      passed: !!createdProgram && !staffProgramError,
    })

    const { data: deniedProgram, error: boardProgramError } = await boardClient
      .from("programs")
      .insert({ user_id: member.id, title: `Board Program ${suffix}` })
      .select("id")
    results.push({
      name: "board cannot insert programs for org",
      passed:
        !!boardProgramError ||
        (Array.isArray(deniedProgram) && deniedProgram.length === 0),
    })

    const { data: boardPrograms } = await boardClient
      .from("programs")
      .select("id")
      .eq("user_id", member.id)
    results.push({
      name: "board can read org programs",
      passed: Array.isArray(boardPrograms) && boardPrograms.length >= 1,
    })
  }

  let memberWorkspaceProjectsTableAvailable = false
  let memberWorkspaceProjectNotesTableAvailable = false
  let memberWorkspaceProjectOverviewDocumentsTableAvailable = false
  let memberWorkspaceProjectQuickLinksTableAvailable = false
  let memberWorkspaceProjectAssetsTableAvailable = false
  let fiscalSponsorshipApplicationsTableAvailable = false
  let fiscalSponsorshipRequiredDocumentsTableAvailable = false
  let fiscalSponsorshipNativeSigningTablesAvailable = false
  let memberWorkspaceStarterStateTableAvailable = false
  let memberWorkspaceTasksTableAvailable = false
  let memberWorkspaceTaskAssigneesTableAvailable = false
  let platformAdminWorkstreamTablesAvailable = false
  let organizationProjectActivityTableAvailable = false
  let memberWorkspaceProjectId = null
  let memberWorkspaceSubscriptionId = null

  if (orgAccessReady) {
    memberWorkspaceSubscriptionId = randomUUID()
    const { error: paidAccessError } = await adminClient
      .from("subscriptions")
      .insert({
        id: memberWorkspaceSubscriptionId,
        user_id: member.id,
        stripe_subscription_id: `sub_member_workspace_${suffix}`,
        status: "active",
        metadata: { planName: "Organization" },
      })
    results.push({
      name: "member workspace paid access fixture created",
      passed: !paidAccessError,
    })

    const { error: projectProbeError } = await memberClient
      .from("organization_projects")
      .select("id")
      .limit(1)

    memberWorkspaceProjectsTableAvailable = !projectProbeError
    results.push({
      name: "member workspace project tables available",
      passed: memberWorkspaceProjectsTableAvailable,
    })

    if (memberWorkspaceProjectsTableAvailable) {
      const { error: starterStateProbeError } = await memberClient
        .from("organization_workspace_starter_state")
        .select("org_id")
        .limit(1)
      memberWorkspaceStarterStateTableAvailable = !starterStateProbeError
      results.push({
        name: "member workspace starter state table available",
        passed: memberWorkspaceStarterStateTableAvailable,
      })

      platformAdminWorkstreamTablesAvailable =
        (await tableExists("platform_admin_workstream_categories")) &&
        (await tableExists("platform_admin_project_workstream_states"))
      results.push({
        name: "platform admin workstream tables available",
        passed: platformAdminWorkstreamTablesAvailable,
      })

      organizationProjectActivityTableAvailable = await tableExists(
        "organization_project_activity_events"
      )
      results.push({
        name: "organization project activity table available",
        passed: organizationProjectActivityTableAvailable,
      })
    }
  }

  if (orgAccessReady && memberWorkspaceProjectsTableAvailable) {
    const projectId = randomUUID()

    const { data: staffProject, error: staffProjectError } = await staffClient
      .from("organization_projects")
      .insert({
        id: projectId,
        org_id: member.id,
        name: "Staff seeded project",
        status: "active",
        priority: "high",
        progress: 25,
        start_date: "2026-01-10",
        end_date: "2026-01-24",
        task_count: 3,
        created_source: "user",
        created_by: staff.id,
        updated_by: staff.id,
      })
      .select("id")
      .maybeSingle()
    results.push({
      name: "staff can insert organization projects",
      passed: !!staffProject && !staffProjectError,
    })

    if (staffProject?.id) {
      memberWorkspaceProjectId = staffProject.id
    }

    const { data: boardReadsProject, error: boardReadsProjectError } =
      await boardClient
        .from("organization_projects")
        .select("id")
        .eq("id", projectId)
        .maybeSingle()
    results.push({
      name: "board can read organization projects",
      passed: !!boardReadsProject && !boardReadsProjectError,
    })

    const { data: deniedBoardInsert, error: deniedBoardInsertError } =
      await boardClient
        .from("organization_projects")
        .insert({
          org_id: member.id,
          name: "Board denied project",
          status: "planned",
          priority: "medium",
          progress: 0,
          start_date: "2026-02-01",
          end_date: "2026-02-15",
          task_count: 1,
          created_source: "user",
          created_by: board.id,
          updated_by: board.id,
        })
        .select("id")
    results.push({
      name: "board cannot insert organization projects",
      passed:
        !!deniedBoardInsertError ||
        (Array.isArray(deniedBoardInsert) && deniedBoardInsert.length === 0),
    })

    const { data: deniedBoardUpdate, error: deniedBoardUpdateError } =
      await boardClient
        .from("organization_projects")
        .update({ progress: 80 })
        .eq("id", projectId)
        .select("id")
    results.push({
      name: "board cannot update organization projects",
      passed:
        !!deniedBoardUpdateError ||
        (Array.isArray(deniedBoardUpdate) && deniedBoardUpdate.length === 0),
    })

    const { data: orgAdminUpdate, error: orgAdminUpdateError } =
      await orgAdminClient
        .from("organization_projects")
        .update({ progress: 80, updated_by: orgAdmin.id })
        .eq("id", projectId)
        .select("id")
    results.push({
      name: "org admin can update organization projects",
      passed:
        !orgAdminUpdateError &&
        Array.isArray(orgAdminUpdate) &&
        orgAdminUpdate.length === 1,
    })

    const { data: adminReadsProject, error: adminReadsProjectError } =
      await adminSessionClient
        .from("organization_projects")
        .select("id")
        .eq("id", projectId)
        .maybeSingle()
    results.push({
      name: "platform admin can read organization projects",
      passed: !!adminReadsProject && !adminReadsProjectError,
    })
  }

  if (
    orgAccessReady &&
    platformAdminWorkstreamTablesAvailable &&
    memberWorkspaceProjectId
  ) {
    const categoryId = randomUUID()
    const { data: adminCategory, error: adminCategoryError } =
      await adminSessionClient
        .from("platform_admin_workstream_categories")
        .insert({
          id: categoryId,
          owner_id: admin.id,
          name: `Needs review ${suffix}`,
          color: "violet",
          position: 7,
        })
        .select("id")
        .maybeSingle()
    results.push({
      name: "platform admin can create a personal workstream category",
      passed: !!adminCategory && !adminCategoryError,
    })

    const { data: deniedAnonCategory, error: deniedAnonCategoryError } =
      await anonClient
        .from("platform_admin_workstream_categories")
        .select("id")
        .eq("id", categoryId)
    results.push({
      name: "anonymous users have no workstream category table privileges",
      passed:
        deniedAnonCategoryError?.code === "42501" ||
        /permission denied/i.test(deniedAnonCategoryError?.message ?? "") ||
        (Array.isArray(deniedAnonCategory) && deniedAnonCategory.length === 0),
    })

    const { data: deniedMemberCategory, error: deniedMemberCategoryError } =
      await memberClient
        .from("platform_admin_workstream_categories")
        .insert({
          owner_id: member.id,
          name: `Member category ${suffix}`,
          color: "slate",
          position: 0,
        })
        .select("id")
    results.push({
      name: "non-admin cannot create workstream categories",
      passed:
        !!deniedMemberCategoryError ||
        (Array.isArray(deniedMemberCategory) &&
          deniedMemberCategory.length === 0),
    })

    const { data: memberReadsAdminCategory, error: memberCategoryReadError } =
      await memberClient
        .from("platform_admin_workstream_categories")
        .select("id")
        .eq("id", categoryId)
        .maybeSingle()
    results.push({
      name: "coach workstream categories stay private to their owner",
      passed: !memberReadsAdminCategory && !memberCategoryReadError,
    })

    const { data: adminWorkstreamState, error: adminWorkstreamStateError } =
      await adminSessionClient
        .from("platform_admin_project_workstream_states")
        .insert({
          owner_id: admin.id,
          project_id: memberWorkspaceProjectId,
          category_id: categoryId,
        })
        .select("project_id")
        .maybeSingle()
    results.push({
      name: "platform admin can place an organization in a personal workstream",
      passed: !!adminWorkstreamState && !adminWorkstreamStateError,
    })
  }

  if (orgAccessReady && memberWorkspaceProjectsTableAvailable) {
    const { error: projectNotesProbeError } = await memberClient
      .from("organization_project_notes")
      .select("id")
      .limit(1)
    memberWorkspaceProjectNotesTableAvailable = !projectNotesProbeError
    results.push({
      name: "member workspace project note tables available",
      passed: memberWorkspaceProjectNotesTableAvailable,
    })

    const { error: projectOverviewDocumentsProbeError } = await memberClient
      .from("organization_project_overview_documents")
      .select("id")
      .limit(1)
    memberWorkspaceProjectOverviewDocumentsTableAvailable =
      !projectOverviewDocumentsProbeError
    results.push({
      name: "member workspace project overview document table available",
      passed: memberWorkspaceProjectOverviewDocumentsTableAvailable,
    })

    const { error: projectQuickLinksProbeError } = await memberClient
      .from("organization_project_quick_links")
      .select("id")
      .limit(1)
    memberWorkspaceProjectQuickLinksTableAvailable =
      !projectQuickLinksProbeError
    results.push({
      name: "member workspace project quick link tables available",
      passed: memberWorkspaceProjectQuickLinksTableAvailable,
    })

    const { error: projectAssetsProbeError } = await memberClient
      .from("organization_project_assets")
      .select("id")
      .limit(1)
    memberWorkspaceProjectAssetsTableAvailable = !projectAssetsProbeError
    results.push({
      name: "member workspace project asset tables available",
      passed: memberWorkspaceProjectAssetsTableAvailable,
    })

    const { error: fiscalApplicationsProbeError } = await memberClient
      .from("fiscal_sponsorship_applications")
      .select("id")
      .limit(1)
    fiscalSponsorshipApplicationsTableAvailable = !fiscalApplicationsProbeError
    results.push({
      name: "fiscal sponsorship application table available",
      passed: fiscalSponsorshipApplicationsTableAvailable,
    })

    const { error: fiscalRequiredDocumentsProbeError } = await memberClient
      .from("fiscal_sponsorship_documents")
      .select(
        "id, document_key, review_status, uploaded_by, uploaded_at, reviewed_by, reviewed_at"
      )
      .limit(1)
    fiscalSponsorshipRequiredDocumentsTableAvailable =
      !fiscalRequiredDocumentsProbeError
    results.push({
      name: "fiscal sponsorship required document metadata available",
      passed: fiscalSponsorshipRequiredDocumentsTableAvailable,
    })

    const { error: fiscalNativeSigningProbeError } = await memberClient
      .from("fiscal_sponsorship_signing_drafts")
      .select("id, revision")
      .limit(1)
    fiscalSponsorshipNativeSigningTablesAvailable =
      !fiscalNativeSigningProbeError
    results.push({
      name: "native fiscal sponsorship signing tables available",
      passed: fiscalSponsorshipNativeSigningTablesAvailable,
    })
  }

  if (orgAccessReady && memberWorkspaceProjectsTableAvailable) {
    const { error: tasksProbeError } = await memberClient
      .from("organization_tasks")
      .select("id")
      .limit(1)
    memberWorkspaceTasksTableAvailable = !tasksProbeError
    results.push({
      name: "member workspace task tables available",
      passed: memberWorkspaceTasksTableAvailable,
    })

    if (memberWorkspaceTasksTableAvailable) {
      const { error: assigneesProbeError } = await memberClient
        .from("organization_task_assignees")
        .select("id")
        .limit(1)
      memberWorkspaceTaskAssigneesTableAvailable = !assigneesProbeError
      results.push({
        name: "member workspace task assignee tables available",
        passed: memberWorkspaceTaskAssigneesTableAvailable,
      })
    }
  }

  if (
    orgAccessReady &&
    memberWorkspaceTasksTableAvailable &&
    memberWorkspaceTaskAssigneesTableAvailable &&
    memberWorkspaceProjectId
  ) {
    const { data: deniedStaffTask, error: deniedStaffTaskError } =
      await staffClient
        .from("organization_tasks")
        .insert({
          org_id: member.id,
          project_id: memberWorkspaceProjectId,
          title: "Direct staff task",
          task_type: "task",
          status: "todo",
          start_date: "2026-01-10",
          end_date: "2026-01-12",
          created_source: "user",
          created_by: staff.id,
          updated_by: staff.id,
        })
        .select("id")
    results.push({
      name: "staff cannot bypass atomic organization task creation",
      passed:
        !!deniedStaffTaskError ||
        (Array.isArray(deniedStaffTask) && deniedStaffTask.length === 0),
    })

    const { data: staffTaskTransition, error: staffTaskTransitionError } =
      await adminClient.rpc("create_organization_task_transition", {
        p_actor_id: staff.id,
        p_assignee_id: board.id,
        p_description: null,
        p_end_date: "2026-01-12",
        p_priority: "high",
        p_project_id: memberWorkspaceProjectId,
        p_start_date: "2026-01-10",
        p_status: "todo",
        p_tag_label: null,
        p_task_type: "task",
        p_title: "Staff task",
        p_workstream_name: null,
      })
    const taskId = staffTaskTransition?.taskId ?? randomUUID()
    results.push({
      name: "service role creates organization tasks atomically",
      passed:
        !staffTaskTransitionError &&
        staffTaskTransition?.ok === true &&
        typeof staffTaskTransition.taskId === "string",
    })

    const { data: deniedStaffAssignment, error: deniedStaffAssignmentError } =
      await staffClient
        .from("organization_task_assignees")
        .insert({
          org_id: member.id,
          task_id: taskId,
          user_id: owner.id,
          created_by: staff.id,
        })
        .select("id")
    results.push({
      name: "staff cannot bypass atomic task assignment creation",
      passed:
        !!deniedStaffAssignmentError ||
        (Array.isArray(deniedStaffAssignment) &&
          deniedStaffAssignment.length === 0),
    })

    const { data: boardReadsTask, error: boardReadsTaskError } =
      await boardClient
        .from("organization_tasks")
        .select("id")
        .eq("id", taskId)
        .maybeSingle()
    results.push({
      name: "board can read organization tasks",
      passed: !!boardReadsTask && !boardReadsTaskError,
    })

    const { data: boardReadsAssignment, error: boardReadsAssignmentError } =
      await boardClient
        .from("organization_task_assignees")
        .select("task_id")
        .eq("task_id", taskId)
        .eq("user_id", board.id)
        .maybeSingle()
    results.push({
      name: "board can read own organization task assignment",
      passed: !!boardReadsAssignment && !boardReadsAssignmentError,
    })

    const { data: deniedBoardTaskInsert, error: deniedBoardTaskInsertError } =
      await boardClient
        .from("organization_tasks")
        .insert({
          org_id: member.id,
          project_id: memberWorkspaceProjectId,
          title: "Board denied task",
          task_type: "task",
          status: "todo",
          start_date: "2026-01-12",
          end_date: "2026-01-13",
          created_source: "user",
          created_by: board.id,
          updated_by: board.id,
        })
        .select("id")
    results.push({
      name: "board cannot insert organization tasks",
      passed:
        !!deniedBoardTaskInsertError ||
        (Array.isArray(deniedBoardTaskInsert) &&
          deniedBoardTaskInsert.length === 0),
    })

    const { data: deniedBoardTaskUpdate, error: deniedBoardTaskUpdateError } =
      await boardClient
        .from("organization_tasks")
        .update({ status: "done" })
        .eq("id", taskId)
        .select("id")
    results.push({
      name: "board cannot update organization tasks directly",
      passed:
        !!deniedBoardTaskUpdateError ||
        (Array.isArray(deniedBoardTaskUpdate) &&
          deniedBoardTaskUpdate.length === 0),
    })

    const { data: adminReadsTask, error: adminReadsTaskError } =
      await adminSessionClient
        .from("organization_tasks")
        .select("id")
        .eq("id", taskId)
        .maybeSingle()
    results.push({
      name: "platform admin can read organization tasks",
      passed: !!adminReadsTask && !adminReadsTaskError,
    })

    const { data: deniedAdminTask, error: deniedAdminTaskError } =
      await adminSessionClient
        .from("organization_tasks")
        .insert({
          org_id: member.id,
          project_id: memberWorkspaceProjectId,
          title: "Direct admin task",
          task_type: "task",
          status: "todo",
          start_date: "2026-01-14",
          end_date: "2026-01-16",
          created_source: "user",
          created_by: admin.id,
          updated_by: admin.id,
        })
        .select("id")
    results.push({
      name: "platform admin cannot bypass atomic organization task creation",
      passed:
        !!deniedAdminTaskError ||
        (Array.isArray(deniedAdminTask) && deniedAdminTask.length === 0),
    })

    const { data: adminTaskTransition, error: adminTaskTransitionError } =
      await adminClient.rpc("create_organization_task_transition", {
        p_actor_id: admin.id,
        p_assignee_id: null,
        p_description: null,
        p_end_date: "2026-01-16",
        p_priority: "high",
        p_project_id: memberWorkspaceProjectId,
        p_start_date: "2026-01-14",
        p_status: "todo",
        p_tag_label: null,
        p_task_type: "task",
        p_title: "Coach follow-up",
        p_workstream_name: null,
      })
    const adminTaskId = adminTaskTransition?.taskId ?? randomUUID()
    results.push({
      name: "service role creates platform-admin tasks atomically",
      passed:
        !adminTaskTransitionError &&
        adminTaskTransition?.ok === true &&
        typeof adminTaskTransition.taskId === "string",
    })

    const { data: deniedAdminTaskUpdate, error: deniedAdminTaskUpdateError } =
      await adminSessionClient
        .from("organization_tasks")
        .update({ status: "done", updated_by: admin.id })
        .eq("id", adminTaskId)
        .select("id")
    results.push({
      name: "platform admin cannot bypass atomic organization task updates",
      passed:
        !!deniedAdminTaskUpdateError ||
        (Array.isArray(deniedAdminTaskUpdate) &&
          deniedAdminTaskUpdate.length === 0),
    })

    const { data: adminTaskUpdate, error: adminTaskUpdateError } =
      await adminClient.rpc("update_organization_task_transition", {
        p_actor_id: admin.id,
        p_assignee_id: null,
        p_description: null,
        p_end_date: "2026-01-16",
        p_expected_org_id: member.id,
        p_expected_project_id: memberWorkspaceProjectId,
        p_priority: "high",
        p_project_id: memberWorkspaceProjectId,
        p_start_date: "2026-01-14",
        p_status: "done",
        p_tag_label: null,
        p_task_id: adminTaskId,
        p_task_type: "task",
        p_title: "Coach follow-up",
        p_workstream_name: null,
      })
    results.push({
      name: "service role completes organization tasks atomically",
      passed: !adminTaskUpdateError && adminTaskUpdate?.ok === true,
    })

    if (organizationProjectActivityTableAvailable) {
      const { data: taskActivity, error: taskActivityError } =
        await adminSessionClient
          .from("organization_project_activity_events")
          .select("id")
          .eq("entity_type", "task")
          .eq("entity_id", adminTaskId)
          .eq("event_type", "completed")
          .maybeSingle()
      results.push({
        name: "task completion appears in the organization activity timeline",
        passed: !!taskActivity && !taskActivityError,
      })

      const { data: deniedActivityInsert, error: deniedActivityInsertError } =
        await adminSessionClient
          .from("organization_project_activity_events")
          .insert({
            org_id: member.id,
            project_id: memberWorkspaceProjectId,
            entity_type: "task",
            entity_id: adminTaskId,
            event_type: "updated",
            title: "Forged activity",
            actor_id: admin.id,
          })
          .select("id")
      results.push({
        name: "platform admins cannot forge organization activity events",
        passed:
          deniedActivityInsertError?.code === "42501" ||
          /permission denied/i.test(deniedActivityInsertError?.message ?? "") ||
          (Array.isArray(deniedActivityInsert) &&
            deniedActivityInsert.length === 0),
      })

      const { data: deniedAnonActivity, error: deniedAnonActivityReadError } =
        await anonClient
          .from("organization_project_activity_events")
          .select("id")
          .limit(1)
      results.push({
        name: "anonymous users have no organization activity table privileges",
        passed:
          deniedAnonActivityReadError?.code === "42501" ||
          /permission denied/i.test(
            deniedAnonActivityReadError?.message ?? ""
          ) ||
          (Array.isArray(deniedAnonActivity) &&
            deniedAnonActivity.length === 0),
      })
    }
  }

  if (
    orgAccessReady &&
    memberWorkspaceProjectsTableAvailable &&
    memberWorkspaceProjectNotesTableAvailable &&
    memberWorkspaceProjectId
  ) {
    const noteId = randomUUID()

    const { data: staffNote, error: staffNoteError } = await staffClient
      .from("organization_project_notes")
      .insert({
        id: noteId,
        org_id: member.id,
        project_id: memberWorkspaceProjectId,
        title: "Staff note",
        content: "Real organization note",
        note_type: "general",
        status: "completed",
        created_by: staff.id,
        updated_by: staff.id,
      })
      .select("id")
      .maybeSingle()
    results.push({
      name: "staff can insert organization project notes",
      passed: !!staffNote && !staffNoteError,
    })

    const { data: boardReadsNote, error: boardReadsNoteError } =
      await boardClient
        .from("organization_project_notes")
        .select("id")
        .eq("id", noteId)
        .maybeSingle()
    results.push({
      name: "board can read organization project notes",
      passed: !!boardReadsNote && !boardReadsNoteError,
    })

    const { data: deniedBoardNoteInsert, error: deniedBoardNoteInsertError } =
      await boardClient
        .from("organization_project_notes")
        .insert({
          org_id: member.id,
          project_id: memberWorkspaceProjectId,
          title: "Board denied note",
          content: "Should not save",
          note_type: "general",
          status: "completed",
          created_by: board.id,
          updated_by: board.id,
        })
        .select("id")
    results.push({
      name: "board cannot insert organization project notes",
      passed:
        !!deniedBoardNoteInsertError ||
        (Array.isArray(deniedBoardNoteInsert) &&
          deniedBoardNoteInsert.length === 0),
    })

    const { data: adminReadsNote, error: adminReadsNoteError } =
      await adminSessionClient
        .from("organization_project_notes")
        .select("id")
        .eq("id", noteId)
        .maybeSingle()
    results.push({
      name: "platform admin can read organization project notes",
      passed: !!adminReadsNote && !adminReadsNoteError,
    })

    const { data: adminNote, error: adminNoteError } = await adminSessionClient
      .from("organization_project_notes")
      .insert({
        org_id: member.id,
        project_id: memberWorkspaceProjectId,
        title: "Coach note",
        content: "Follow up with the organization next week.",
        note_type: "general",
        status: "completed",
        created_by: admin.id,
        updated_by: admin.id,
      })
      .select("id")
      .maybeSingle()
    results.push({
      name: "platform admin can create organization project notes",
      passed: !!adminNote && !adminNoteError,
    })
  }

  if (
    orgAccessReady &&
    memberWorkspaceProjectsTableAvailable &&
    memberWorkspaceProjectOverviewDocumentsTableAvailable &&
    memberWorkspaceProjectId
  ) {
    const overviewDocumentId = randomUUID()

    const { data: staffOverviewDocument, error: staffOverviewDocumentError } =
      await staffClient
        .from("organization_project_overview_documents")
        .insert({
          id: overviewDocumentId,
          org_id: member.id,
          project_id: memberWorkspaceProjectId,
          document_html: "<h2>Staff overview</h2><p>Rich overview content.</p>",
          document_text: "Staff overview\n\nRich overview content.",
          created_by: staff.id,
          updated_by: staff.id,
        })
        .select("id")
        .maybeSingle()
    results.push({
      name: "staff can insert organization project overview documents",
      passed: !!staffOverviewDocument && !staffOverviewDocumentError,
    })

    const { data: boardReadsOverviewDocument, error: boardReadsOverviewError } =
      await boardClient
        .from("organization_project_overview_documents")
        .select("id")
        .eq("id", overviewDocumentId)
        .maybeSingle()
    results.push({
      name: "board can read organization project overview documents",
      passed: !!boardReadsOverviewDocument && !boardReadsOverviewError,
    })

    const { data: orgAdminUpdatesOverview, error: orgAdminOverviewError } =
      await orgAdminClient
        .from("organization_project_overview_documents")
        .update({
          document_text: "Updated by org admin.",
          updated_by: orgAdmin.id,
        })
        .eq("id", overviewDocumentId)
        .select("id")
    results.push({
      name: "org admin can update organization project overview documents",
      passed:
        !orgAdminOverviewError &&
        Array.isArray(orgAdminUpdatesOverview) &&
        orgAdminUpdatesOverview.length === 1,
    })

    const deniedOverviewProjectId = randomUUID()
    await adminClient.from("organization_projects").insert({
      id: deniedOverviewProjectId,
      org_id: member.id,
      name: "Board denied overview project",
      status: "planned",
      priority: "medium",
      progress: 0,
      start_date: "2026-02-01",
      end_date: "2026-02-15",
      task_count: 1,
      created_source: "user",
      created_by: staff.id,
      updated_by: staff.id,
    })

    const {
      data: deniedBoardOverviewInsert,
      error: deniedBoardOverviewInsertError,
    } = await boardClient
      .from("organization_project_overview_documents")
      .insert({
        org_id: member.id,
        project_id: deniedOverviewProjectId,
        document_html: "<p>Board denied overview</p>",
        document_text: "Board denied overview",
        created_by: board.id,
        updated_by: board.id,
      })
      .select("id")
    results.push({
      name: "board cannot insert organization project overview documents",
      passed:
        !!deniedBoardOverviewInsertError ||
        (Array.isArray(deniedBoardOverviewInsert) &&
          deniedBoardOverviewInsert.length === 0),
    })

    const { data: adminReadsOverview, error: adminReadsOverviewError } =
      await adminSessionClient
        .from("organization_project_overview_documents")
        .select("id")
        .eq("id", overviewDocumentId)
        .maybeSingle()
    results.push({
      name: "platform admin can read organization project overview documents",
      passed: !!adminReadsOverview && !adminReadsOverviewError,
    })
  }

  if (
    orgAccessReady &&
    memberWorkspaceProjectsTableAvailable &&
    memberWorkspaceProjectQuickLinksTableAvailable &&
    memberWorkspaceProjectId
  ) {
    const linkId = randomUUID()

    const { data: staffLink, error: staffLinkError } = await staffClient
      .from("organization_project_quick_links")
      .insert({
        id: linkId,
        org_id: member.id,
        project_id: memberWorkspaceProjectId,
        name: "Program brief",
        url: "https://example.com/program-brief.pdf",
        link_type: "pdf",
        size_mb: 2.4,
        created_by: staff.id,
        updated_by: staff.id,
      })
      .select("id")
      .maybeSingle()
    results.push({
      name: "staff can insert organization project quick links",
      passed: !!staffLink && !staffLinkError,
    })

    const { data: boardReadsLink, error: boardReadsLinkError } =
      await boardClient
        .from("organization_project_quick_links")
        .select("id")
        .eq("id", linkId)
        .maybeSingle()
    results.push({
      name: "board can read organization project quick links",
      passed: !!boardReadsLink && !boardReadsLinkError,
    })

    const { data: deniedBoardLinkInsert, error: deniedBoardLinkInsertError } =
      await boardClient
        .from("organization_project_quick_links")
        .insert({
          org_id: member.id,
          project_id: memberWorkspaceProjectId,
          name: "Board denied link",
          url: "https://example.com/denied.pdf",
          link_type: "pdf",
          size_mb: 1.0,
          created_by: board.id,
          updated_by: board.id,
        })
        .select("id")
    results.push({
      name: "board cannot insert organization project quick links",
      passed:
        !!deniedBoardLinkInsertError ||
        (Array.isArray(deniedBoardLinkInsert) &&
          deniedBoardLinkInsert.length === 0),
    })

    const { data: adminReadsLink, error: adminReadsLinkError } =
      await adminSessionClient
        .from("organization_project_quick_links")
        .select("id")
        .eq("id", linkId)
        .maybeSingle()
    results.push({
      name: "platform admin can read organization project quick links",
      passed: !!adminReadsLink && !adminReadsLinkError,
    })
  }

  if (
    orgAccessReady &&
    memberWorkspaceProjectsTableAvailable &&
    memberWorkspaceProjectAssetsTableAvailable &&
    memberWorkspaceProjectId
  ) {
    const assetId = randomUUID()

    const { data: staffAsset, error: staffAssetError } = await staffClient
      .from("organization_project_assets")
      .insert({
        id: assetId,
        org_id: member.id,
        project_id: memberWorkspaceProjectId,
        name: "Org intake packet.pdf",
        description: "Seeded project asset",
        asset_type: "pdf",
        external_url: "https://example.com/intake-packet.pdf",
        created_by: staff.id,
        updated_by: staff.id,
      })
      .select("id")
      .maybeSingle()
    results.push({
      name: "staff can insert organization project assets",
      passed: !!staffAsset && !staffAssetError,
    })

    const { data: boardReadsAsset, error: boardReadsAssetError } =
      await boardClient
        .from("organization_project_assets")
        .select("id")
        .eq("id", assetId)
        .maybeSingle()
    results.push({
      name: "board can read organization project assets",
      passed: !!boardReadsAsset && !boardReadsAssetError,
    })

    const { data: deniedBoardAssetInsert, error: deniedBoardAssetInsertError } =
      await boardClient
        .from("organization_project_assets")
        .insert({
          org_id: member.id,
          project_id: memberWorkspaceProjectId,
          name: "Board denied asset",
          description: "Should not save",
          asset_type: "pdf",
          external_url: "https://example.com/denied-asset.pdf",
          created_by: board.id,
          updated_by: board.id,
        })
        .select("id")
    results.push({
      name: "board cannot insert organization project assets",
      passed:
        !!deniedBoardAssetInsertError ||
        (Array.isArray(deniedBoardAssetInsert) &&
          deniedBoardAssetInsert.length === 0),
    })

    const { data: adminReadsAsset, error: adminReadsAssetError } =
      await adminSessionClient
        .from("organization_project_assets")
        .select("id")
        .eq("id", assetId)
        .maybeSingle()
    results.push({
      name: "platform admin can read organization project assets",
      passed: !!adminReadsAsset && !adminReadsAssetError,
    })

    const { data: adminAsset, error: adminAssetError } =
      await adminSessionClient
        .from("organization_project_assets")
        .insert({
          org_id: member.id,
          project_id: memberWorkspaceProjectId,
          name: "Coach review notes.pdf",
          description: "Uploaded by a platform admin",
          asset_type: "pdf",
          external_url: "https://example.com/coach-review-notes.pdf",
          created_by: admin.id,
          updated_by: admin.id,
        })
        .select("id")
        .maybeSingle()
    results.push({
      name: "platform admin can add organization project assets",
      passed: !!adminAsset && !adminAssetError,
    })

    if (
      fiscalSponsorshipApplicationsTableAvailable &&
      fiscalSponsorshipRequiredDocumentsTableAvailable &&
      staffAsset?.id
    ) {
      const fiscalApplicationId = randomUUID()
      const { error: fiscalApplicationSeedError } = await adminClient
        .from("fiscal_sponsorship_applications")
        .insert({
          id: fiscalApplicationId,
          org_id: member.id,
          project_id: memberWorkspaceProjectId,
          status: "submitted",
          applicant_full_name: "RLS Applicant",
          project_name: "RLS Fiscal Project",
          primary_email: memberEmail,
          created_by: member.id,
          updated_by: member.id,
        })
      results.push({
        name: "fiscal sponsorship application fixture created",
        passed: !fiscalApplicationSeedError,
      })

      const connectedAt = new Date().toISOString()
      const buildRequiredFiscalDocument = ({
        actorId,
        documentKey,
        version,
      }) => ({
        application_id: fiscalApplicationId,
        asset_id: assetId,
        document_key: documentKey,
        kind: "application",
        metadata: { source: "rls-test" },
        org_id: member.id,
        project_id: memberWorkspaceProjectId,
        review_status: "pending",
        source_snapshot: { source: "rls-test" },
        status: "draft",
        title: `RLS ${documentKey}`,
        uploaded_at: connectedAt,
        uploaded_by: actorId,
        version,
      })

      const { data: fiscalDocuments, error: fiscalDocumentsError } =
        await adminClient
          .from("fiscal_sponsorship_documents")
          .insert([
            buildRequiredFiscalDocument({
              actorId: owner.id,
              documentKey: "tax_id_confirmation",
              version: 1,
            }),
            buildRequiredFiscalDocument({
              actorId: staff.id,
              documentKey: "governing_documents",
              version: 2,
            }),
          ])
          .select("id, document_key")
      const taxDocument = fiscalDocuments?.find(
        (document) => document.document_key === "tax_id_confirmation"
      )
      results.push({
        name: "service role creates authoritative fiscal documents",
        passed:
          !fiscalDocumentsError &&
          Array.isArray(fiscalDocuments) &&
          fiscalDocuments.length === 2 &&
          !!taxDocument,
      })

      const { data: deniedOwnerFiscalDocument, error: deniedOwnerFiscalError } =
        await ownerClient
          .from("fiscal_sponsorship_documents")
          .insert(
            buildRequiredFiscalDocument({
              actorId: owner.id,
              documentKey: "budget_support",
              version: 91,
            })
          )
          .select("id")
      results.push({
        name: "owner cannot bypass authoritative fiscal document transition",
        passed:
          deniedOwnerFiscalError?.code === "42501" &&
          (!Array.isArray(deniedOwnerFiscalDocument) ||
            deniedOwnerFiscalDocument.length === 0),
      })

      const { data: deniedStaffFiscalDocument, error: deniedStaffFiscalError } =
        await staffClient
          .from("fiscal_sponsorship_documents")
          .insert(
            buildRequiredFiscalDocument({
              actorId: staff.id,
              documentKey: "fundraising_materials",
              version: 92,
            })
          )
          .select("id")
      results.push({
        name: "staff cannot bypass authoritative fiscal document transition",
        passed:
          deniedStaffFiscalError?.code === "42501" &&
          (!Array.isArray(deniedStaffFiscalDocument) ||
            deniedStaffFiscalDocument.length === 0),
      })

      const {
        data: deniedBoardFiscalDocument,
        error: deniedBoardFiscalDocumentError,
      } = await boardClient
        .from("fiscal_sponsorship_documents")
        .insert(
          buildRequiredFiscalDocument({
            actorId: board.id,
            documentKey: "budget_support",
            version: 3,
          })
        )
        .select("id")
      results.push({
        name: "board cannot bypass authoritative fiscal document transition",
        passed:
          deniedBoardFiscalDocumentError?.code === "42501" &&
          (!Array.isArray(deniedBoardFiscalDocument) ||
            deniedBoardFiscalDocument.length === 0),
      })

      const { data: deniedAdminFiscalDocument, error: deniedAdminFiscalError } =
        await adminSessionClient
          .from("fiscal_sponsorship_documents")
          .insert(
            buildRequiredFiscalDocument({
              actorId: admin.id,
              documentKey: "fundraising_materials",
              version: 4,
            })
          )
          .select("id")
          .maybeSingle()
      results.push({
        name: "platform admin cannot bypass authoritative fiscal document transition",
        passed:
          deniedAdminFiscalError?.code === "42501" &&
          (!Array.isArray(deniedAdminFiscalDocument) ||
            deniedAdminFiscalDocument.length === 0),
      })

      const { error: fiscalCoachResetError } = await adminSessionClient.rpc(
        "set_organization_coach_assignments",
        {
          p_organization_id: member.id,
          p_coach_user_ids: [secondCoach.id],
        }
      )
      results.push({
        name: "fiscal coach visibility starts from an unassigned fixture",
        passed: !fiscalCoachResetError,
      })

      const fiscalReadMatrix = [
        ["owner", ownerClient, 2],
        ["staff", staffClient, 2],
        ["board", boardClient, 1],
        ["platform admin", adminSessionClient, 2],
        ["unassigned coach", coachClient, 0],
      ]

      for (const [label, client, expectedCount] of fiscalReadMatrix) {
        const { data, error } = await client
          .from("fiscal_sponsorship_documents")
          .select("id, document_key")
          .eq("application_id", fiscalApplicationId)
        results.push({
          name: `${label} has scoped fiscal document visibility`,
          passed:
            !error && Array.isArray(data) && data.length === expectedCount,
        })
      }

      if (await tableExists("organization_coach_assignments")) {
        const { error: coachAssignmentError } = await adminClient
          .from("organization_coach_assignments")
          .insert({
            assigned_by: admin.id,
            coach_user_id: coach.id,
            organization_id: member.id,
          })
        const { data: assignedCoachDocuments, error: assignedCoachError } =
          await coachClient
            .from("fiscal_sponsorship_documents")
            .select("id")
            .eq("application_id", fiscalApplicationId)
        results.push({
          name: "assigned coach has scoped fiscal document visibility",
          passed:
            !coachAssignmentError &&
            !assignedCoachError &&
            assignedCoachDocuments?.length === 2,
        })
        await adminClient
          .from("organization_coach_assignments")
          .delete()
          .eq("organization_id", member.id)
          .eq("coach_user_id", coach.id)
      }

      if (fiscalSponsorshipNativeSigningTablesAvailable && taxDocument?.id) {
        const packetId = randomUUID()
        const { error: packetSeedError } = await adminClient
          .from("fiscal_sponsorship_signature_packets")
          .insert({
            id: packetId,
            applicant_signer_email: memberEmail,
            applicant_signer_id: member.id,
            applicant_signer_name: "Test Member",
            application_id: fiscalApplicationId,
            document_id: taxDocument.id,
            org_id: member.id,
            project_id: memberWorkspaceProjectId,
            provider: "native",
            status: "sent",
          })
        results.push({
          name: "native fiscal signature packet fixture created",
          passed: !packetSeedError,
        })

        const { error: draftSeedError } = await adminClient
          .from("fiscal_sponsorship_signing_drafts")
          .insert({
            application_id: fiscalApplicationId,
            field_values: { projectId: `CH-${suffix}` },
            org_id: member.id,
            packet_id: packetId,
            project_id: memberWorkspaceProjectId,
            signer_id: member.id,
            signer_role: "applicant",
          })
        results.push({
          name: "native fiscal signing draft fixture created",
          passed: !draftSeedError,
        })

        const { data: applicantDraft, error: applicantDraftError } =
          await memberClient
            .from("fiscal_sponsorship_signing_drafts")
            .select("id")
            .eq("packet_id", packetId)
            .maybeSingle()
        results.push({
          name: "assigned applicant can read native fiscal signing draft",
          passed: !!applicantDraft && !applicantDraftError,
        })

        const { data: deniedStaffDraft, error: deniedStaffDraftError } =
          await staffClient
            .from("fiscal_sponsorship_signing_drafts")
            .select("id")
            .eq("packet_id", packetId)
            .maybeSingle()
        results.push({
          name: "unassigned staff cannot read native fiscal signing draft",
          passed: !deniedStaffDraft && !deniedStaffDraftError,
        })

        const { data: deniedCoachDraft, error: deniedCoachDraftError } =
          await staffClient
            .from("fiscal_sponsorship_signing_drafts")
            .insert({
              application_id: fiscalApplicationId,
              org_id: member.id,
              packet_id: packetId,
              project_id: memberWorkspaceProjectId,
              signer_id: staff.id,
              signer_role: "coach_house",
            })
            .select("id")
        results.push({
          name: "non-admin cannot create a native countersign draft",
          passed:
            !!deniedCoachDraftError ||
            (Array.isArray(deniedCoachDraft) && deniedCoachDraft.length === 0),
        })

        const { data: deniedSignature, error: deniedSignatureError } =
          await memberClient
            .from("fiscal_sponsorship_signatures")
            .insert({
              application_id: fiscalApplicationId,
              consent_sha256: "a".repeat(64),
              consent_text: "RLS test",
              consent_version: "test",
              org_id: member.id,
              packet_id: packetId,
              project_id: memberWorkspaceProjectId,
              signature_method: "typed",
              signature_sha256: "b".repeat(64),
              signature_value: "Test Member",
              signed_at: new Date().toISOString(),
              signed_document_sha256: "c".repeat(64),
              signer_id: member.id,
              signer_name: "Test Member",
              signer_role: "applicant",
              signer_title: "Authorized Representative",
            })
            .select("id")
        results.push({
          name: "applicant cannot directly insert native signature evidence",
          passed:
            !!deniedSignatureError ||
            (Array.isArray(deniedSignature) && deniedSignature.length === 0),
        })

        const { data: adminDraft, error: adminDraftError } =
          await adminSessionClient
            .from("fiscal_sponsorship_signing_drafts")
            .select("id")
            .eq("packet_id", packetId)
            .maybeSingle()
        results.push({
          name: "platform admin can read native fiscal signing draft",
          passed: !!adminDraft && !adminDraftError,
        })

        await adminClient
          .from("fiscal_sponsorship_signing_drafts")
          .delete()
          .eq("packet_id", packetId)
        await adminClient
          .from("fiscal_sponsorship_signature_packets")
          .delete()
          .eq("id", packetId)
      }
    }
  }

  if (orgAccessReady && memberWorkspaceStarterStateTableAvailable) {
    const seededAt = new Date().toISOString()

    const { data: starterState, error: starterStateError } = await staffClient
      .from("organization_workspace_starter_state")
      .upsert(
        {
          org_id: member.id,
          seed_version: 1,
          seeded_at: seededAt,
          updated_by: staff.id,
        },
        { onConflict: "org_id" }
      )
      .select("org_id")
      .maybeSingle()
    results.push({
      name: "staff can upsert organization starter state",
      passed: !!starterState && !starterStateError,
    })

    const { data: boardReadsStarterState, error: boardReadsStarterStateError } =
      await boardClient
        .from("organization_workspace_starter_state")
        .select("org_id")
        .eq("org_id", member.id)
        .maybeSingle()
    results.push({
      name: "board can read organization starter state",
      passed: !!boardReadsStarterState && !boardReadsStarterStateError,
    })

    const {
      data: deniedStarterStateUpdate,
      error: deniedStarterStateUpdateError,
    } = await boardClient
      .from("organization_workspace_starter_state")
      .update({ seed_version: 2 })
      .eq("org_id", member.id)
      .select("org_id")
    results.push({
      name: "board cannot update organization starter state",
      passed:
        !!deniedStarterStateUpdateError ||
        (Array.isArray(deniedStarterStateUpdate) &&
          deniedStarterStateUpdate.length === 0),
    })
  }

  // Org-admin invite gating (admins_can_invite toggle)
  if (orgAccessReady) {
    const expiresAt = new Date(Date.now() + 3600_000).toISOString()

    const { error: deniedInviteError } = await orgAdminClient
      .from("organization_invites")
      .insert({
        org_id: member.id,
        email: `invitee-denied-${suffix}@example.com`,
        role: "board",
        token: `tok_denied_${suffix}`,
        expires_at: expiresAt,
      })
    results.push({
      name: "org admin cannot invite by default",
      passed: !!deniedInviteError,
    })

    const { error: ownerEnableError } = await memberClient
      .from("organization_access_settings")
      .upsert(
        { org_id: member.id, admins_can_invite: true },
        { onConflict: "org_id" }
      )
    results.push({
      name: "owner can enable org-admin invites",
      passed: !ownerEnableError,
    })

    const { data: allowedInvite, error: allowedInviteError } =
      await orgAdminClient
        .from("organization_invites")
        .insert({
          org_id: member.id,
          email: `invitee-allowed-${suffix}@example.com`,
          role: "board",
          token: `tok_allowed_${suffix}`,
          expires_at: expiresAt,
        })
        .select("id")
        .maybeSingle()
    results.push({
      name: "org admin can invite when enabled",
      passed: !!allowedInvite && !allowedInviteError,
    })

    const { error: staffInviteError } = await staffClient
      .from("organization_invites")
      .insert({
        org_id: member.id,
        email: `invitee-staff-${suffix}@example.com`,
        role: "board",
        token: `tok_staff_${suffix}`,
        expires_at: expiresAt,
      })
    results.push({
      name: "staff cannot invite even when enabled",
      passed: !!staffInviteError,
    })

    await orgAdminClient
      .from("organization_access_settings")
      .update({ admins_can_invite: false })
      .eq("org_id", member.id)

    const { data: settingsRow } = await memberClient
      .from("organization_access_settings")
      .select("admins_can_invite")
      .eq("org_id", member.id)
      .maybeSingle()
    results.push({
      name: "org admin cannot change invite setting",
      passed: settingsRow?.admins_can_invite === true,
    })
  }

  if (orgAccessReady) {
    const expiresAt = new Date(Date.now() + 3600_000).toISOString()
    const requestId = randomUUID()

    await memberClient
      .from("organization_access_settings")
      .upsert(
        { org_id: member.id, admins_can_invite: true },
        { onConflict: "org_id" }
      )

    const { data: createdRequest, error: createdRequestError } =
      await orgAdminClient
        .from("organization_access_requests")
        .insert({
          id: requestId,
          org_id: member.id,
          invitee_user_id: board.id,
          invitee_email: boardEmail,
          role: "board",
          invited_by_user_id: orgAdmin.id,
          expires_at: expiresAt,
        })
        .select("id")
        .maybeSingle()
    results.push({
      name: "org admin can insert access requests when invite setting enabled",
      passed: !!createdRequest && !createdRequestError,
    })

    const { error: deniedRequestError } = await staffClient
      .from("organization_access_requests")
      .insert({
        org_id: member.id,
        invitee_user_id: staff.id,
        invitee_email: staffEmail,
        role: "staff",
        invited_by_user_id: staff.id,
        expires_at: expiresAt,
      })
    results.push({
      name: "staff cannot insert access requests",
      passed: !!deniedRequestError,
    })

    const { data: boardOwnRequest, error: boardOwnRequestError } =
      await boardClient
        .from("organization_access_requests")
        .select("id")
        .eq("id", requestId)
        .maybeSingle()
    results.push({
      name: "invitee can read own access request",
      passed: !!boardOwnRequest && !boardOwnRequestError,
    })

    const { data: staffReadsRequest } = await staffClient
      .from("organization_access_requests")
      .select("id")
      .eq("id", requestId)
    results.push({
      name: "staff cannot read another member access request",
      passed:
        Array.isArray(staffReadsRequest) && staffReadsRequest.length === 0,
    })

    const { data: boardUpdateRequest, error: boardUpdateRequestError } =
      await boardClient
        .from("organization_access_requests")
        .update({ status: "declined" })
        .eq("id", requestId)
        .select("id")
    results.push({
      name: "invitee cannot update access request directly through RLS",
      passed:
        !!boardUpdateRequestError ||
        (Array.isArray(boardUpdateRequest) && boardUpdateRequest.length === 0),
    })

    const { data: adminReadsRequest, error: adminReadsRequestError } =
      await adminSessionClient
        .from("organization_access_requests")
        .select("id")
        .eq("id", requestId)
        .maybeSingle()
    results.push({
      name: "platform admin can read access requests",
      passed: !!adminReadsRequest && !adminReadsRequestError,
    })
  }

  // Workspace board + collaboration invite RLS.
  if (orgAccessReady) {
    const { error: workspaceProbeError } = await memberClient
      .from("organization_workspace_boards")
      .select("org_id")
      .limit(1)

    workspaceTablesAvailable = !workspaceProbeError

    results.push({
      name: "workspace tables available",
      passed: workspaceTablesAvailable,
    })

    const { error: peopleSegmentsProbeError } = await memberClient
      .from("organization_people_segments")
      .select("id")
      .limit(1)
    const { error: peopleSegmentMembersProbeError } = await memberClient
      .from("organization_people_segment_members")
      .select("segment_id")
      .limit(1)
    organizationPeopleSegmentsAvailable =
      !peopleSegmentsProbeError && !peopleSegmentMembersProbeError
    results.push({
      name: "organization people segment tables available",
      passed: organizationPeopleSegmentsAvailable,
    })

    const { error: peopleTagsProbeError } = await memberClient
      .from("organization_people_tags")
      .select("id")
      .limit(1)
    const { error: peopleTagMembersProbeError } = await memberClient
      .from("organization_people_tag_members")
      .select("tag_id")
      .limit(1)
    organizationPeopleTagsAvailable =
      !peopleTagsProbeError && !peopleTagMembersProbeError
    results.push({
      name: "organization people tag tables available",
      passed: organizationPeopleTagsAvailable,
    })

    if (workspaceTablesAvailable) {
      const { error: workspaceCommunicationsProbeError } = await memberClient
        .from("organization_workspace_communications")
        .select("org_id")
        .limit(1)
      workspaceCommunicationsTableAvailable = !workspaceCommunicationsProbeError

      if (workspaceCommunicationsTableAvailable) {
        const { error: workspaceCommunicationChannelsProbeError } =
          await memberClient
            .from("organization_workspace_communication_channels")
            .select("org_id")
            .limit(1)
        workspaceCommunicationChannelsTableAvailable =
          !workspaceCommunicationChannelsProbeError

        const { error: workspaceDeliveryProbeError } = await memberClient
          .from("organization_workspace_communication_deliveries")
          .select("org_id")
          .limit(1)
        workspaceCommunicationDeliveriesTableAvailable =
          !workspaceDeliveryProbeError
      }
    }
  }

  if (orgAccessReady && organizationPeopleSegmentsAvailable) {
    const { data: staffSegment, error: staffSegmentError } = await staffClient
      .from("organization_people_segments")
      .insert({
        org_id: member.id,
        label: `Donors ${suffix}`,
        created_by: staff.id,
      })
      .select("id")
      .maybeSingle()
    results.push({
      name: "staff can create organization people segments",
      passed: !!staffSegment && !staffSegmentError,
    })

    if (staffSegment) {
      const { data: boardReadsSegment, error: boardReadsSegmentError } =
        await boardClient
          .from("organization_people_segments")
          .select("id")
          .eq("id", staffSegment.id)
          .maybeSingle()
      results.push({
        name: "board can read organization people segments",
        passed: !!boardReadsSegment && !boardReadsSegmentError,
      })

      const { data: boardCreatesSegment, error: boardCreatesSegmentError } =
        await boardClient
          .from("organization_people_segments")
          .insert({ org_id: member.id, label: `Denied ${suffix}` })
          .select("id")
      results.push({
        name: "board cannot create organization people segments",
        passed:
          !!boardCreatesSegmentError ||
          (Array.isArray(boardCreatesSegment) &&
            boardCreatesSegment.length === 0),
      })

      const { data: staffMember, error: staffMemberError } = await staffClient
        .from("organization_people_segment_members")
        .insert({
          segment_id: staffSegment.id,
          person_id: member.id,
          added_by: staff.id,
        })
        .select("person_id")
        .maybeSingle()
      results.push({
        name: "staff can add organization people segment members",
        passed: !!staffMember && !staffMemberError,
      })

      const { data: boardAddsMember, error: boardAddsMemberError } =
        await boardClient
          .from("organization_people_segment_members")
          .insert({
            segment_id: staffSegment.id,
            person_id: board.id,
            added_by: board.id,
          })
          .select("person_id")
      results.push({
        name: "board cannot add organization people segment members",
        passed:
          !!boardAddsMemberError ||
          (Array.isArray(boardAddsMember) && boardAddsMember.length === 0),
      })
    }
  }

  if (orgAccessReady && organizationPeopleTagsAvailable) {
    const { data: staffTag, error: staffTagError } = await staffClient
      .from("organization_people_tags")
      .insert({
        org_id: member.id,
        label: `Priority ${suffix}`,
        color: "violet",
        created_by: staff.id,
      })
      .select("id,color")
      .maybeSingle()
    results.push({
      name: "staff can create colored organization people tags",
      passed: !!staffTag && staffTag.color === "violet" && !staffTagError,
    })

    if (staffTag) {
      const { data: boardReadsTag, error: boardReadsTagError } =
        await boardClient
          .from("organization_people_tags")
          .select("id")
          .eq("id", staffTag.id)
          .maybeSingle()
      results.push({
        name: "board can read organization people tags",
        passed: !!boardReadsTag && !boardReadsTagError,
      })

      const { data: boardUpdatesTag, error: boardUpdatesTagError } =
        await boardClient
          .from("organization_people_tags")
          .update({ color: "red" })
          .eq("id", staffTag.id)
          .select("id")
      results.push({
        name: "board cannot update organization people tags",
        passed:
          !!boardUpdatesTagError ||
          (Array.isArray(boardUpdatesTag) && boardUpdatesTag.length === 0),
      })

      const { data: staffTagMember, error: staffTagMemberError } =
        await staffClient
          .from("organization_people_tag_members")
          .insert({
            tag_id: staffTag.id,
            person_id: member.id,
            added_by: staff.id,
          })
          .select("person_id")
          .maybeSingle()
      results.push({
        name: "staff can add organization people tag members",
        passed: !!staffTagMember && !staffTagMemberError,
      })

      const { data: boardAddsTagMember, error: boardAddsTagMemberError } =
        await boardClient
          .from("organization_people_tag_members")
          .insert({
            tag_id: staffTag.id,
            person_id: board.id,
            added_by: board.id,
          })
          .select("person_id")
      results.push({
        name: "board cannot add organization people tag members",
        passed:
          !!boardAddsTagMemberError ||
          (Array.isArray(boardAddsTagMember) &&
            boardAddsTagMember.length === 0),
      })
    }
  }

  if (orgAccessReady && workspaceTablesAvailable) {
    const nowIso = new Date().toISOString()
    const inviteId = `workspace-invite-${suffix}`

    const { data: staffBoard, error: staffBoardError } = await staffClient
      .from("organization_workspace_boards")
      .upsert(
        {
          org_id: member.id,
          state: {
            version: 1,
            preset: "balanced",
            nodes: [],
            updatedAt: nowIso,
          },
          updated_by: staff.id,
        },
        { onConflict: "org_id" }
      )
      .select("org_id")
      .maybeSingle()
    results.push({
      name: "staff can upsert workspace board",
      passed: !!staffBoard && !staffBoardError,
    })

    const { data: boardReadsBoard, error: boardReadsBoardError } =
      await boardClient
        .from("organization_workspace_boards")
        .select("org_id")
        .eq("org_id", member.id)
        .maybeSingle()
    results.push({
      name: "board can read workspace board",
      passed: !!boardReadsBoard && !boardReadsBoardError,
    })

    const { data: boardUpdatesBoard, error: boardUpdatesBoardError } =
      await boardClient
        .from("organization_workspace_boards")
        .update({
          state: {
            version: 1,
            preset: "calendar-focused",
            nodes: [],
            updatedAt: nowIso,
          },
        })
        .eq("org_id", member.id)
        .select("org_id")
    results.push({
      name: "board cannot update workspace board",
      passed:
        !!boardUpdatesBoardError ||
        (Array.isArray(boardUpdatesBoard) && boardUpdatesBoard.length === 0),
    })

    const { data: boardCreatedInvite, error: boardCreatedInviteError } =
      await boardClient
        .from("organization_workspace_invites")
        .insert({
          id: inviteId,
          org_id: member.id,
          user_id: staff.id,
          user_name: "Test Staff",
          user_email: staffEmail,
          created_by: board.id,
          expires_at: new Date(Date.now() + 3600_000).toISOString(),
          duration_value: 1,
          duration_unit: "hours",
        })
        .select("id")
        .maybeSingle()
    results.push({
      name: "board can create workspace invite",
      passed: !!boardCreatedInvite && !boardCreatedInviteError,
    })

    const { data: staffReadsInvite, error: staffReadsInviteError } =
      await staffClient
        .from("organization_workspace_invites")
        .select("id")
        .eq("id", inviteId)
        .eq("org_id", member.id)
        .maybeSingle()
    results.push({
      name: "staff can read workspace invite",
      passed: !!staffReadsInvite && !staffReadsInviteError,
    })

    const { data: orgAdminRevokesInvite, error: orgAdminRevokesInviteError } =
      await orgAdminClient
        .from("organization_workspace_invites")
        .update({ revoked_at: new Date().toISOString() })
        .eq("id", inviteId)
        .eq("org_id", member.id)
        .select("id")
    results.push({
      name: "org admin can revoke workspace invite",
      passed:
        !orgAdminRevokesInviteError &&
        Array.isArray(orgAdminRevokesInvite) &&
        orgAdminRevokesInvite.length === 1,
    })

    if (workspaceCommunicationsTableAvailable) {
      const communicationId = randomUUID()

      const { data: staffCommunication, error: staffCommunicationError } =
        await staffClient
          .from("organization_workspace_communications")
          .insert({
            id: communicationId,
            org_id: member.id,
            channel: "social",
            media_mode: "text",
            content: "Board update scheduled from workspace tests.",
            status: "scheduled",
            scheduled_for: new Date(Date.now() + 7200_000).toISOString(),
            created_by: staff.id,
          })
          .select("id")
          .maybeSingle()
      results.push({
        name: "staff can create workspace communication post",
        passed: !!staffCommunication && !staffCommunicationError,
      })

      const {
        data: boardReadsCommunication,
        error: boardReadsCommunicationError,
      } = await boardClient
        .from("organization_workspace_communications")
        .select("id")
        .eq("id", communicationId)
        .eq("org_id", member.id)
        .maybeSingle()
      results.push({
        name: "board can read workspace communication post",
        passed: !!boardReadsCommunication && !boardReadsCommunicationError,
      })

      const { error: boardCreatesCommunicationError } = await boardClient
        .from("organization_workspace_communications")
        .insert({
          org_id: member.id,
          channel: "email",
          media_mode: "text",
          content: "Unauthorized board post",
          status: "scheduled",
          scheduled_for: new Date(Date.now() + 3600_000).toISOString(),
          created_by: board.id,
        })
      results.push({
        name: "board cannot create workspace communication post",
        passed: !!boardCreatesCommunicationError,
      })

      if (workspaceCommunicationChannelsTableAvailable) {
        const {
          data: staffConnectedChannel,
          error: staffConnectedChannelError,
        } = await staffClient
          .from("organization_workspace_communication_channels")
          .upsert(
            {
              org_id: member.id,
              channel: "social",
              is_connected: true,
              provider: "mock-social",
              connected_by: staff.id,
              connected_at: new Date().toISOString(),
              metadata: { source: "rls-test" },
            },
            { onConflict: "org_id,channel" }
          )
          .select("channel")
          .maybeSingle()
        results.push({
          name: "staff can upsert workspace communication channel",
          passed: !!staffConnectedChannel && !staffConnectedChannelError,
        })

        const {
          data: boardReadsConnectedChannel,
          error: boardReadsConnectedChannelError,
        } = await boardClient
          .from("organization_workspace_communication_channels")
          .select("channel")
          .eq("org_id", member.id)
          .eq("channel", "social")
          .maybeSingle()
        results.push({
          name: "board can read workspace communication channel",
          passed:
            !!boardReadsConnectedChannel && !boardReadsConnectedChannelError,
        })

        const { error: boardUpsertsConnectedChannelError } = await boardClient
          .from("organization_workspace_communication_channels")
          .upsert(
            {
              org_id: member.id,
              channel: "email",
              is_connected: true,
              provider: "mock-email",
              connected_by: board.id,
              connected_at: new Date().toISOString(),
              metadata: { source: "rls-test" },
            },
            { onConflict: "org_id,channel" }
          )
        results.push({
          name: "board cannot upsert workspace communication channel",
          passed: !!boardUpsertsConnectedChannelError,
        })
      }

      if (workspaceCommunicationDeliveriesTableAvailable) {
        const deliveryId = randomUUID()

        const { data: staffDelivery, error: staffDeliveryError } =
          await staffClient
            .from("organization_workspace_communication_deliveries")
            .insert({
              id: deliveryId,
              org_id: member.id,
              communication_id: communicationId,
              channel: "social",
              status: "queued",
              provider: "mock",
              attempt_count: 0,
              payload: {},
              created_by: staff.id,
            })
            .select("id")
            .maybeSingle()
        results.push({
          name: "staff can enqueue workspace communication delivery",
          passed: !!staffDelivery && !staffDeliveryError,
        })

        const { data: boardReadsDelivery, error: boardReadsDeliveryError } =
          await boardClient
            .from("organization_workspace_communication_deliveries")
            .select("id")
            .eq("id", deliveryId)
            .eq("org_id", member.id)
            .maybeSingle()
        results.push({
          name: "board can read workspace communication delivery",
          passed: !!boardReadsDelivery && !boardReadsDeliveryError,
        })

        const { error: boardCreatesDeliveryError } = await boardClient
          .from("organization_workspace_communication_deliveries")
          .insert({
            org_id: member.id,
            communication_id: communicationId,
            channel: "email",
            status: "queued",
            provider: "mock",
            attempt_count: 0,
            payload: {},
            created_by: board.id,
          })
        results.push({
          name: "board cannot enqueue workspace communication delivery",
          passed: !!boardCreatesDeliveryError,
        })
      }
    }
  }

  // Attachments visibility and invites admin-only
  {
    // Admin attaches a resource to the module
    const { data: attachment, error: attachErr } = await adminClient
      .from("attachments")
      .insert({
        scope_type: "module",
        scope_id: assets.moduleId,
        kind: "resource",
        storage_path: `resources/${assets.moduleId}/sample.pdf`,
        mime: "application/pdf",
      })
      .select("id")
      .single()
    if (attachErr) throw attachErr

    const { data: attachRead } = await memberClient
      .from("attachments")
      .select("id")
      .eq("id", attachment.id)
      .maybeSingle()
    results.push({
      name: "member can read module attachment (enrolled/published)",
      passed: !!attachRead,
    })

    // Member should not be able to create invites
    const { error: inviteErr } = await memberClient
      .from("enrollment_invites")
      .insert({
        class_id: assets.publishedClassId,
        email: `invitee-${suffix}@example.com`,
        token: `tok_${suffix}`,
        expires_at: new Date(Date.now() + 3600_000).toISOString(),
      })
    results.push({
      name: "member cannot create enrollment invites",
      passed: !!inviteErr,
    })
  }

  // Subscription visibility
  {
    const subId = memberWorkspaceSubscriptionId ?? randomUUID()
    if (!memberWorkspaceSubscriptionId) {
      const { error } = await adminClient.from("subscriptions").insert({
        id: subId,
        user_id: member.id,
        stripe_subscription_id: `sub_${suffix}`,
        status: "active",
        metadata: { planName: "Organization" },
      })
      if (error) throw error
    }

    const { data, error: subscriptionError } = await memberClient
      .from("subscriptions")
      .select("id")
      .eq("id", subId)
      .maybeSingle()
    results.push({
      name: "member can read own subscription",
      passed: !!data && !subscriptionError,
    })

    const { data: staffSub } = await staffClient
      .from("subscriptions")
      .select("id")
      .eq("id", subId)
      .maybeSingle()
    results.push({
      name: "staff can read org subscription",
      passed: !!staffSub,
    })

    const { data: boardSub } = await boardClient
      .from("subscriptions")
      .select("id")
      .eq("id", subId)
      .maybeSingle()
    results.push({
      name: "board cannot read org subscription",
      passed: !boardSub,
    })

    const { error: updateError } = await memberClient
      .from("subscriptions")
      .update({ metadata: { source: "rls-test" } })
      .eq("id", subId)
    results.push({
      name: "member cannot update own subscription metadata",
      passed: !!updateError,
    })
  }

  // Notifications visibility
  {
    const memberNotificationId = randomUUID()
    const adminNotificationId = randomUUID()
    const now = new Date().toISOString()

    const { error: insertError } = await adminClient
      .from("notifications")
      .insert([
        {
          id: memberNotificationId,
          user_id: member.id,
          title: "Member notification",
          description: "Visible to the member user only.",
          tone: "info",
        },
        {
          id: adminNotificationId,
          user_id: admin.id,
          title: "Admin notification",
          description: "Visible to the admin user only.",
          tone: "warning",
        },
      ])
    if (insertError) throw insertError

    const { data: memberNotifications, error: memberNotifError } =
      await memberClient
        .from("notifications")
        .select("id")
        .eq("user_id", member.id)
    const memberSeesOwn =
      Array.isArray(memberNotifications) &&
      memberNotifications.some((row) => row.id === memberNotificationId)
    results.push({
      name: "member can read own notifications",
      passed: memberSeesOwn && !memberNotifError,
    })

    const { data: otherNotifications } = await memberClient
      .from("notifications")
      .select("id")
      .eq("user_id", admin.id)
    results.push({
      name: "member cannot read other notifications",
      passed:
        Array.isArray(otherNotifications) && otherNotifications.length === 0,
    })

    const { data: deniedUpdate, error: deniedError } = await memberClient
      .from("notifications")
      .update({ read_at: now })
      .eq("id", adminNotificationId)
      .select("id")
    results.push({
      name: "member cannot update other notifications",
      passed:
        !deniedError &&
        Array.isArray(deniedUpdate) &&
        deniedUpdate.length === 0,
    })

    const { data: allowedUpdate, error: allowedError } = await memberClient
      .from("notifications")
      .update({ read_at: now })
      .eq("id", memberNotificationId)
      .select("id")
    results.push({
      name: "member can update own notifications",
      passed:
        !allowedError &&
        Array.isArray(allowedUpdate) &&
        allowedUpdate.length === 1,
    })

    const { data: adminReadsMember, error: adminReadError } =
      await adminSessionClient
        .from("notifications")
        .select("id")
        .eq("id", memberNotificationId)
        .maybeSingle()
    results.push({
      name: "admin can read member notifications",
      passed: !!adminReadsMember && !adminReadError,
    })

    const { data: adminUpdateMember, error: adminUpdateError } =
      await adminSessionClient
        .from("notifications")
        .update({ archived_at: now })
        .eq("id", memberNotificationId)
        .select("id")
    results.push({
      name: "admin can update member notifications",
      passed:
        !adminUpdateError &&
        Array.isArray(adminUpdateMember) &&
        adminUpdateMember.length === 1,
    })
  }

  // Search index view should not be directly selectable (use RPC instead).
  {
    const { error: viewError } = await memberClient
      .from("search_index")
      .select("id")
      .limit(1)
    const denied =
      viewError?.code === "42501" ||
      /permission denied/i.test(viewError?.message ?? "")
    results.push({
      name: "member cannot select search_index directly",
      passed: denied,
    })
  }

  if (await tableExists("app_page_health_events")) {
    const { error: directInsertError } = await adminClient
      .from("app_page_health_events")
      .insert({
        event_type: "route_error",
        route_path: "/workspace",
        severity: "critical",
        source: "client",
        user_id: member.id,
      })
    results.push({
      name: "service role cannot bypass bounded page health recorder",
      passed:
        directInsertError?.code === "42501" ||
        /permission denied/i.test(directInsertError?.message ?? ""),
    })

    const { data: recordResult, error: recordError } = await adminClient.rpc(
      "record_page_health_event",
      {
        p_event: {
          eventType: "route_error",
          routePath: "/workspace",
          severity: "critical",
          source: "client",
        },
        p_org_id: null,
        p_user_id: member.id,
      }
    )
    const pageHealthEventId =
      recordResult &&
      typeof recordResult === "object" &&
      !Array.isArray(recordResult) &&
      typeof recordResult.id === "string"
        ? recordResult.id
        : null
    results.push({
      name: "service role can record a bounded page health event",
      passed:
        !recordError &&
        recordResult?.status === "recorded" &&
        !!pageHealthEventId,
    })

    if (pageHealthEventId) {
      const { data: memberRows, error: memberReadError } = await memberClient
        .from("app_page_health_events")
        .select("id")
        .eq("id", pageHealthEventId)
      results.push({
        name: "authenticated non-admin cannot read page health events",
        passed:
          !memberReadError &&
          Array.isArray(memberRows) &&
          memberRows.length === 0,
      })

      const { data: anonRows, error: anonReadError } = await anonClient
        .from("app_page_health_events")
        .select("id")
        .eq("id", pageHealthEventId)
      results.push({
        name: "anon cannot read page health events",
        passed:
          !!anonReadError || (Array.isArray(anonRows) && anonRows.length === 0),
      })

      const { data: adminRows, error: adminReadError } =
        await adminSessionClient
          .from("app_page_health_events")
          .select("id")
          .eq("id", pageHealthEventId)
      results.push({
        name: "admin can read page health events",
        passed:
          !adminReadError && Array.isArray(adminRows) && adminRows.length === 1,
      })
    }

    const { error: memberInsertError } = await memberClient
      .from("app_page_health_events")
      .insert({
        event_type: "route_error",
        route_path: "/workspace",
        severity: "warning",
        source: "client",
      })
    results.push({
      name: "authenticated non-admin cannot write page health events",
      passed: !!memberInsertError,
    })

    if (pageHealthEventId) {
      await adminClient
        .from("app_page_health_events")
        .delete()
        .eq("id", pageHealthEventId)
    }
  }

  await runResourceMapRlsTests({
    admin,
    adminClient,
    adminSessionClient,
    anonClient,
    member,
    memberClient,
    results,
    suffix,
    tableExists,
  })

  const failed = results.filter((result) => !result.passed)
  results.forEach((result) => {
    console.log(`${result.passed ? "✓" : "✗"} ${result.name}`)
  })

  await adminClient.from("module_progress").delete().eq("user_id", member.id)
  await adminClient
    .from("assignment_submissions")
    .delete()
    .eq("user_id", member.id)
  await adminClient
    .from("module_assignments")
    .delete()
    .eq("module_id", assets.moduleId)
  await adminClient.from("attachments").delete().eq("scope_id", assets.moduleId)
  await adminClient.from("programs").delete().eq("user_id", member.id)
  await adminClient
    .from("organization_workspace_starter_state")
    .delete()
    .eq("org_id", member.id)
  await adminClient
    .from("organization_projects")
    .delete()
    .eq("org_id", member.id)
  await adminClient.from("organizations").delete().eq("user_id", member.id)
  await adminClient.from("enrollments").delete().eq("user_id", member.id)
  await adminClient
    .from("modules")
    .delete()
    .in("id", [assets.moduleId, assets.hiddenModuleId])
  await adminClient
    .from("classes")
    .delete()
    .in("id", [assets.publishedClassId, assets.unpublishedClassId])
  await adminClient.from("subscriptions").delete().eq("user_id", member.id)
  await adminClient
    .from("notifications")
    .delete()
    .in("user_id", [member.id, admin.id])
  if (await tableExists("organization_coach_scope_events")) {
    await adminClient
      .from("organization_coach_scope_events")
      .delete()
      .eq("changed_by", admin.id)
  }
  await adminClient.storage
    .from("avatars")
    .remove([`${member.id}/rls-avatar-${suffix}.png`])
  for (const user of [
    member,
    admin,
    owner,
    staff,
    board,
    orgAdmin,
    coach,
    secondCoach,
  ]) {
    const { error: deleteUserError } = await adminClient.auth.admin.deleteUser(
      user.id
    )
    if (deleteUserError) throw deleteUserError
  }

  if (failed.length > 0) {
    console.error(`RLS tests failed (${failed.length}).`)
    process.exit(1)
  }

  console.log("RLS tests passed.")
}

run().catch((error) => {
  console.error("RLS test runner error:", error)
  process.exit(1)
})
