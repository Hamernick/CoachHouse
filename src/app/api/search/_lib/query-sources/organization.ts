import { readOrganizationProfileForProjection } from "@/lib/organization/profile-read"
import { resolveCoreDocumentSource } from "@/lib/roadmap/core-document-source"
import { projectReadableDocumentProfile } from "@/lib/organization/document-ai-copies"
import {
  resolveOrganizationNarrativePlainText,
} from "@/lib/roadmap"
import type { SearchResult } from "@/lib/search/types"
import { getWorkspaceEditorPath } from "@/lib/workspace/routes"

import {
  DOCUMENT_LABELS,
  extractProfileValue,
  isRecord,
  matchesQuery,
} from "../helpers"
import type { SupabaseClient } from "../types"

export async function attachOrganizationImages({
  supabase,
  orgId,
  results,
}: {
  supabase: SupabaseClient
  orgId: string
  results: SearchResult[]
}) {
  const slugs = new Set<string>()
  let needsSelf = false

  for (const result of results) {
    if (result.image) continue
    if (result.id === `org:${orgId}`) {
      needsSelf = true
      continue
    }

    if (result.group === "Community") {
      const match = result.href.match(/^\/([^/]+)$/)
      if (match?.[1]) slugs.add(match[1])
    }
  }

  const [selfLogoUrl, communityOrganizations] = await Promise.all([
    (async () => {
      if (!needsSelf) return undefined
      const { data: orgRow } = await supabase
        .from("organizations")
        .select("profile")
        .eq("user_id", orgId)
        .maybeSingle<{ profile: Record<string, unknown> | null }>()

      const profile = orgRow?.profile ?? {}
      return extractProfileValue(profile, "logoUrl") || undefined
    })(),
    (async () => {
      if (slugs.size === 0) return []
      const { data: orgRows } = await supabase
        .from("organizations")
        .select("public_slug, profile")
        .in("public_slug", Array.from(slugs))
        .returns<
          Array<{
            public_slug: string | null
            profile: Record<string, unknown> | null
          }>
        >()
      return orgRows ?? []
    })(),
  ])

  const logoBySlug = new Map<string, string>()
  for (const org of communityOrganizations) {
    if (!org.public_slug) continue
    const profile = org.profile ?? {}
    const logoUrl = extractProfileValue(profile, "logoUrl")
    if (logoUrl) {
      logoBySlug.set(org.public_slug, logoUrl)
    }
  }

  if (!selfLogoUrl && logoBySlug.size === 0) {
    return results
  }

  return results.map((result) => {
    if (result.image) return result
    if (result.id === `org:${orgId}` && selfLogoUrl) {
      return { ...result, image: selfLogoUrl }
    }
    if (result.group === "Community") {
      const match = result.href.match(/^\/([^/]+)$/)
      const slug = match?.[1]
      const logoUrl = slug ? logoBySlug.get(slug) : undefined
      if (logoUrl) {
        return { ...result, image: logoUrl }
      }
    }
    return result
  })
}

export async function addActiveOrganizationResults({
  supabase,
  orgId,
  actorId,
  tokens,
  pushResult,
}: {
  supabase: SupabaseClient
  orgId: string
  actorId: string
  tokens: string[]
  pushResult: (result: SearchResult) => void
}) {
  const [{ data: programs }, { data: userOrg, error: organizationError }] = await Promise.all([
    supabase
      .from("programs")
      .select("id, title, subtitle, status_label")
      .eq("user_id", orgId)
      .returns<
        Array<{
          id: string
          title: string | null
          subtitle: string | null
          status_label: string | null
        }>
      >(),
    readOrganizationProfileForProjection(supabase, orgId, actorId),
  ])

  if (organizationError) throw new Error("Organization data is unavailable.")

  for (const program of programs ?? []) {
    if (
      matchesQuery(
        [
          program.title ?? null,
          program.subtitle ?? null,
          program.status_label ?? null,
        ],
        tokens
      )
    ) {
      pushResult({
        id: `program:${program.id}`,
        label: program.title ?? "Untitled program",
        subtitle: program.subtitle ?? program.status_label ?? undefined,
        href: getWorkspaceEditorPath({
          tab: "programs",
          programId: program.id,
        }),
        group: "Programs",
      })
    }
  }

  if (!userOrg?.profile) return

  const { profile, roadmapSections } = await projectReadableDocumentProfile(userOrg.profile, orgId, actorId)
  const name = extractProfileValue(profile, "name")
  const tagline = extractProfileValue(profile, "tagline")
  const missionSection = roadmapSections.find(section => section.id === "mission_vision_values")
  const mission = missionSection && resolveCoreDocumentSource(missionSection) !== "editor"
    ? "" : resolveOrganizationNarrativePlainText(profile, "mission")
  const description = extractProfileValue(profile, "description")

  if (matchesQuery([name, tagline, mission, description], tokens)) {
    pushResult({
      id: `org:${orgId}`,
      label: name || "My organization",
      subtitle: "Your organization",
      href: getWorkspaceEditorPath({ tab: "company" }),
      group: "My organization",
    })
  }

  for (const section of roadmapSections) {
    if (
      matchesQuery([section.title, section.subtitle, resolveCoreDocumentSource(section) === "editor" ? section.content : null], tokens)
    ) {
      const sectionKey = section.slug || section.id
      pushResult({
        id: `roadmap:${orgId}:${sectionKey}`,
        label: section.title,
        subtitle: section.subtitle,
        href: `/roadmap#${sectionKey}`,
        group: "Roadmap",
      })
    }
  }

  const documents = isRecord(profile.documents)
    ? (profile.documents as Record<string, unknown>)
    : {}
  for (const [key, value] of Object.entries(documents)) {
    if (!isRecord(value)) continue
    const label = DOCUMENT_LABELS[key] ?? key
    const name = typeof value.name === "string" ? value.name : ""
    if (matchesQuery([label, name, key], tokens)) {
      pushResult({
        id: `doc:${orgId}:${key}`,
        label: name || label,
        subtitle: label,
        href: "/organization/documents",
        group: "Documents",
        keywords: [key, label].filter(Boolean),
      })
    }
  }
}
