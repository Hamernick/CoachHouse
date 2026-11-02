import { isActiveContact } from "@/lib/people/contact-schema"
import type { SupabaseClient } from "@supabase/supabase-js"

import type { OrgPerson } from "@/actions/people"
import { normalizePersonCategory } from "@/lib/people/categories"
import type { OrganizationPeopleSegment } from "@/lib/people/segments"
import type { Database } from "@/lib/supabase"
import { supabaseErrorToError } from "@/lib/supabase/errors"
import {
  normalizePersonTags,
  type OrganizationPeopleTag,
} from "@/lib/people/tags"

import { loadOrganizationPeopleTags } from "./workspace-people-tags"

export async function loadOrganizationPeopleTaxonomy({
  orgId,
  supabase,
}: {
  orgId: string
  supabase: SupabaseClient<Database, "public">
}) {
  const [segments, tags] = await Promise.all([
    loadOrganizationPeopleSegments({ orgId, supabase }),
    loadOrganizationPeopleTags({ orgId, supabase }),
  ])
  return { segments, tags }
}

export async function loadOrganizationPeopleSegments({
  orgId,
  supabase,
}: {
  orgId: string
  supabase: SupabaseClient<Database, "public">
}): Promise<OrganizationPeopleSegment[]> {
  const segmentsResult = await supabase
    .from("organization_people_segments")
    .select("id,label")
    .eq("org_id", orgId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true })
    .returns<Array<{ id: string; label: string }>>()

  if (segmentsResult.error) {
    throw supabaseErrorToError(
      segmentsResult.error,
      "Unable to load people segments."
    )
  }
  if (segmentsResult.data.length === 0) return []

  const segmentIds = segmentsResult.data.map((segment) => segment.id)
  const membersResult = await supabase
    .from("organization_people_segment_members")
    .select("segment_id,person_id")
    .in("segment_id", segmentIds)
    .returns<Array<{ segment_id: string; person_id: string }>>()
  if (membersResult.error) {
    throw supabaseErrorToError(
      membersResult.error,
      "Unable to load people segment members."
    )
  }

  const memberIdsBySegment = new Map<string, string[]>()
  for (const member of membersResult.data) {
    const current = memberIdsBySegment.get(member.segment_id) ?? []
    current.push(member.person_id)
    memberIdsBySegment.set(member.segment_id, current)
  }

  return segmentsResult.data.map((segment) => ({
    id: segment.id,
    label: segment.label,
    memberIds: memberIdsBySegment.get(segment.id) ?? [],
  }))
}

export function buildWorkspacePeopleData({
  profile,
  segments,
  tags,
}: {
  profile: Record<string, unknown>
  segments: OrganizationPeopleSegment[]
  tags: OrganizationPeopleTag[]
}) {
  const people = (
    Array.isArray(profile.org_people) ? profile.org_people.filter(isActiveContact) : []
  ) as OrgPerson[]
  const tagLabelsByPerson = new Map<string, string[]>()
  for (const tag of tags) {
    for (const personId of tag.memberIds) {
      const current = tagLabelsByPerson.get(personId) ?? []
      current.push(tag.label)
      tagLabelsByPerson.set(personId, current)
    }
  }
  const peopleNormalized = people.map((person) => ({
    ...person,
    category: normalizePersonCategory(person.category),
    tags: normalizePersonTags(tagLabelsByPerson.get(person.id) ?? person.tags),
  }))
  const personIds = new Set(peopleNormalized.map((person) => person.id))

  return {
    peopleNormalized,
    peopleSegments: segments.map((segment) => ({
      ...segment,
      memberIds: segment.memberIds.filter((personId) =>
        personIds.has(personId)
      ),
    })),
    peopleTags: tags.map((tag) => ({
      ...tag,
      memberIds: tag.memberIds.filter((personId) => personIds.has(personId)),
    })),
  }
}
