"use server"

import { randomUUID } from "node:crypto"

import { revalidatePath } from "next/cache"

import { requireServerSession } from "@/lib/auth"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import {
  normalizePersonCategory,
  type PersonCategory,
} from "@/lib/people/categories"
import {
  findPersonSocialLinkError,
  normalizePersonSocialLinks,
  type PersonSocialPlatform,
} from "@/lib/people/social-links"
import { mutateOrganizationPeopleProfile } from "@/lib/people/profile-write"
import { fetchLinkedInProfileImage } from "@/lib/people/linkedin-image-refresh"
import { readPeopleRoles, resolvePersonRole } from "@/lib/people/roles"
import { normalizePersonTags } from "@/lib/people/tags"
import {
  canEditOrganization,
  resolveActiveOrganization,
} from "@/lib/organization/active-org"

export type OrgPerson = {
  id: string
  name: string
  title?: string | null
  email?: string | null
  category: PersonCategory
  customRole?: string | null
  image?: string | null
  reportsToId?: string | null
  pos?: { x: number; y: number } | null
  tags?: string[]
} & Partial<Record<PersonSocialPlatform, string | null>>

function resolvePeopleAvatarCleanupPath(
  previous: string | null | undefined,
  next: string | null | undefined,
  userId: string
) {
  if (!previous) return null
  if (previous === next) return null
  if (/^https?:/i.test(previous)) return null
  if (!previous.startsWith(`users/${userId}/`)) return null
  return previous
}

function normalizeCategory(input: string): OrgPerson["category"] {
  return normalizePersonCategory(input)
}

function canAssignManager(_category: OrgPerson["category"]) {
  return true
}

async function resolvePeopleManagementAccess(
  supabase: Awaited<ReturnType<typeof requireServerSession>>["supabase"],
  userId: string
) {
  const { orgId, role } = await resolveActiveOrganization(supabase, userId)
  if (canEditOrganization(role)) {
    return { orgId, canManagePeople: true }
  }

  const { data: profileRow } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle<{ role: string | null }>()

  return {
    orgId,
    canManagePeople: profileRow?.role === "admin",
  }
}

export async function upsertPersonAction(
  person: Omit<OrgPerson, "id"> & { id?: string }
) {
  const socialLinkError = findPersonSocialLinkError(person)
  if (socialLinkError) return { error: socialLinkError }

  const { supabase, session } = await requireServerSession("/people")
  const userId = session.user.id
  const { orgId, canManagePeople } = await resolvePeopleManagementAccess(
    supabase,
    userId
  )
  if (!canManagePeople) return { error: "Forbidden" }

  const id =
    person.id && person.id.length > 0
      ? person.id
      : globalThis.crypto?.randomUUID?.() || `${Date.now()}`
  let image = person.image?.trim() || null

  // If we have an external image URL, mirror it into storage for reliability
  if (image && /^https?:/i.test(image)) {
    try {
      const admin = createSupabaseAdminClient()
      const bucket = "avatars"
      // Ensure bucket exists (private)
      const { data: existing } = await admin.storage.getBucket(bucket)
      if (!existing) {
        await admin.storage.createBucket(bucket, { public: false })
      }
      const res = await fetch(image, { cache: "no-store" })
      if (res.ok) {
        const arrayBuf = await res.arrayBuffer()
        const contentType = res.headers.get("content-type") || "image/jpeg"
        const ext = contentType.includes("png")
          ? "png"
          : contentType.includes("webp")
            ? "webp"
            : "jpg"
        const objectPath = `users/${orgId}/${id}.${ext}`
        await admin.storage.from(bucket).upload(objectPath, arrayBuf, {
          contentType,
          upsert: true,
        })
        // Store storage path relative to bucket
        image = objectPath
      }
    } catch {}
  }

  const normalizedCategory = normalizeCategory(person.category)
  const writeResult = await mutateOrganizationPeopleProfile<
    OrgPerson,
    { id: string; previousImage: string | null; nextImage: string | null }
  >({
    supabase,
    orgId,
    mutate: (people, profile) => {
      const existingIndex = people.findIndex((item) => item.id === id)
      if (person.id && existingIndex < 0) {
        return { error: "Person not found." }
      }

      const existingPerson = existingIndex >= 0 ? people[existingIndex] : null
      const roles = readPeopleRoles(profile)
      const role = resolvePersonRole({ category: normalizedCategory, customRole:
        person.customRole === undefined ? existingPerson?.customRole : person.customRole }, roles)
      if ("error" in role) return role
      const socialLinks = normalizePersonSocialLinks(person, existingPerson)
      const nextItem: OrgPerson = {
        id,
        name: person.name?.trim() || "Untitled",
        title: person.title?.trim() || null,
        email: person.email?.trim() || null,
        ...socialLinks,
        ...role,
        image,
        reportsToId:
          canAssignManager(normalizedCategory) &&
          person.reportsToId &&
          person.reportsToId !== id
            ? person.reportsToId
            : null,
        pos: existingPerson?.pos ?? null,
        tags:
          person.tags === undefined
            ? normalizePersonTags(existingPerson?.tags)
            : normalizePersonTags(person.tags),
      }
      const nextPeople = [...people]
      if (existingIndex >= 0) nextPeople[existingIndex] = nextItem
      else nextPeople.push(nextItem)

      return {
        ok: true,
        changed: true,
        people: nextPeople,
        peopleRoles: role.customRole ? [...new Set([...roles, role.customRole])] : roles,
        value: {
          id,
          previousImage:
            typeof existingPerson?.image === "string"
              ? existingPerson.image
              : null,
          nextImage: nextItem.image ?? null,
        },
      }
    },
  })
  if ("error" in writeResult) return writeResult

  const cleanupPath = resolvePeopleAvatarCleanupPath(
    writeResult.value.previousImage,
    writeResult.value.nextImage,
    orgId
  )
  if (cleanupPath) {
    try {
      const admin = createSupabaseAdminClient()
      await admin.storage.from("avatars").remove([cleanupPath])
    } catch {}
  }

  revalidatePath("/my-organization")
  revalidatePath("/workspace")
  revalidatePath("/people")
  return { ok: true, id: writeResult.value.id }
}

export async function updatePersonCategoryAction(
  id: string,
  category: PersonCategory,
  customRole: string | null = null
): Promise<{ ok: true } | { error: string }> {
  const personId = id.trim()
  if (!personId) return { error: "Person not found." }
  if (normalizeCategory(category) !== category) {
    return { error: "Choose a valid relationship." }
  }

  const { supabase, session } = await requireServerSession("/my-organization")
  const { orgId, canManagePeople } = await resolvePeopleManagementAccess(
    supabase,
    session.user.id
  )
  if (!canManagePeople) return { error: "Forbidden" }

  const writeResult = await mutateOrganizationPeopleProfile<OrgPerson, null>({
    supabase,
    orgId,
    mutate: (people, profile) => {
      const person = people.find((item) => item.id === personId)
      if (!person) return { error: "Person not found." }
      const roles = readPeopleRoles(profile)
      const role = resolvePersonRole({ category, customRole }, roles)
      if ("error" in role) return role
      if (person.category === role.category && (person.customRole ?? null) === role.customRole) {
        return { ok: true, changed: false, value: null }
      }
      return {
        ok: true,
        changed: true,
        people: people.map((item) =>
          item.id === personId ? { ...item, ...role } : item
        ),
        peopleRoles: role.customRole ? [...new Set([...roles, role.customRole])] : roles,
        value: null,
      }
    },
  })
  if ("error" in writeResult) return writeResult

  revalidatePath("/my-organization")
  revalidatePath("/workspace")
  revalidatePath("/people")
  return { ok: true }
}

export async function updatePersonTagsAction(
  id: string,
  tags: string[]
): Promise<{ ok: true; tags: string[] } | { error: string }> {
  const personId = id.trim()
  if (!personId) return { error: "Person not found." }
  const normalizedTags = normalizePersonTags(tags)

  const { supabase, session } = await requireServerSession("/my-organization")
  const { orgId, canManagePeople } = await resolvePeopleManagementAccess(
    supabase,
    session.user.id
  )
  if (!canManagePeople) return { error: "Forbidden" }

  const writeResult = await mutateOrganizationPeopleProfile<OrgPerson, null>({
    supabase,
    orgId,
    mutate: (people) => {
      if (!people.some((item) => item.id === personId)) {
        return { error: "Person not found." }
      }
      return {
        ok: true,
        changed: true,
        people: people.map((item) =>
          item.id === personId ? { ...item, tags: normalizedTags } : item
        ),
        value: null,
      }
    },
  })
  if ("error" in writeResult) return writeResult

  revalidatePath("/my-organization")
  revalidatePath("/workspace")
  revalidatePath("/people")
  return { ok: true, tags: normalizedTags }
}

export async function deletePersonAction(id: string) {
  const { supabase, session } = await requireServerSession("/people")
  const userId = session.user.id
  const { orgId, canManagePeople } = await resolvePeopleManagementAccess(
    supabase,
    userId
  )
  if (!canManagePeople) return { error: "Forbidden" }
  if (id === userId)
    return { error: "You cannot remove your own profile from People." }
  const writeResult = await mutateOrganizationPeopleProfile<
    OrgPerson,
    { cleanupPath: string | null }
  >({
    supabase,
    orgId,
    mutate: (people) => {
      const target = people.find((person) => person.id === id)
      if (!target) return { error: "Person not found." }
      return {
        ok: true,
        changed: true,
        people: people
          .filter((person) => person.id !== id)
          .map((person) =>
            person.reportsToId === id
              ? { ...person, reportsToId: null }
              : person
          ),
        value: {
          cleanupPath: resolvePeopleAvatarCleanupPath(
            typeof target.image === "string" ? target.image : null,
            null,
            orgId
          ),
        },
      }
    },
  })
  if ("error" in writeResult) return writeResult

  if (writeResult.value.cleanupPath) {
    try {
      const admin = createSupabaseAdminClient()
      await admin.storage
        .from("avatars")
        .remove([writeResult.value.cleanupPath])
    } catch {}
  }
  revalidatePath("/people")
  return { ok: true }
}

export async function refreshPersonLinkedInImageAction(id: string) {
  const { supabase, session } = await requireServerSession("/people")
  const { orgId, canManagePeople } = await resolvePeopleManagementAccess(
    supabase,
    session.user.id
  )
  if (!canManagePeople) return { error: "Forbidden" }

  const { data: orgRow, error: orgError } = await supabase
    .from("organizations")
    .select("profile")
    .eq("user_id", orgId)
    .maybeSingle<{ profile: Record<string, unknown> | null }>()
  if (orgError) return { error: orgError.message }

  const people = Array.isArray(orgRow?.profile?.org_people)
    ? (orgRow.profile.org_people as OrgPerson[])
    : []
  const person = people.find((item) => item.id === id)
  if (!person) return { error: "Not found" }
  if (!person.linkedin) return { error: "LinkedIn not set" }

  let linkedInImage
  try {
    linkedInImage = await fetchLinkedInProfileImage(person.linkedin)
  } catch {
    return { error: "Could not fetch image" }
  }

  try {
    const admin = createSupabaseAdminClient()
    const bucket = "avatars"
    const { data: existing } = await admin.storage.getBucket(bucket)
    if (!existing) await admin.storage.createBucket(bucket, { public: false })
    const contentType = linkedInImage.contentType
    const extension =
      contentType === "image/png"
        ? "png"
        : contentType === "image/webp"
          ? "webp"
          : contentType === "image/gif"
            ? "gif"
            : contentType === "image/avif"
              ? "avif"
              : "jpg"
    const objectPath = `users/${orgId}/${id}-${randomUUID()}.${extension}`
    const { error: uploadError } = await admin.storage
      .from(bucket)
      .upload(objectPath, linkedInImage.bytes, {
        contentType,
        upsert: false,
      })
    if (uploadError) return { error: "Upload failed" }

    const writeResult = await mutateOrganizationPeopleProfile<
      OrgPerson,
      { previousImage: string | null }
    >({
      supabase,
      orgId,
      mutate: (currentPeople) => {
        const currentPerson = currentPeople.find((item) => item.id === id)
        if (!currentPerson) return { error: "Not found" }
        if (currentPerson.linkedin !== person.linkedin) {
          return { error: "LinkedIn changed. Reload before refreshing." }
        }
        return {
          ok: true,
          changed: true,
          people: currentPeople.map((item) =>
            item.id === id ? { ...item, image: objectPath } : item
          ),
          value: {
            previousImage:
              typeof currentPerson.image === "string"
                ? currentPerson.image
                : null,
          },
        }
      },
    })
    if ("error" in writeResult) {
      await admin.storage.from(bucket).remove([objectPath])
      return writeResult
    }

    const cleanupPath = resolvePeopleAvatarCleanupPath(
      writeResult.value.previousImage,
      objectPath,
      orgId
    )
    if (cleanupPath) {
      try {
        await admin.storage.from(bucket).remove([cleanupPath])
      } catch {}
    }

    revalidatePath("/my-organization")
    revalidatePath("/workspace")
    revalidatePath("/people")
    return { ok: true }
  } catch {
    return { error: "Upload failed" }
  }
}
