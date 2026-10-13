"use client"

import { useMemo } from "react"

import type { OrgPersonWithImage } from "@/components/people/supporters-showcase"
import {
  PERSON_CATEGORY_OPTIONS,
  type PersonCategory,
} from "@/lib/people/categories"
import { personMatchesRole, type PersonRoleFilterValue } from "@/lib/people/roles"
import type { OrganizationPeopleTag } from "@/lib/people/tags"

import type {
  WorkspaceCategoryPeopleSegment,
  WorkspaceCustomPeopleSegment,
  WorkspacePeopleSegment,
} from "./workspace-canvas-people-segment-types"

export function buildPeopleSegments({
  people,
  customSegments,
}: {
  people: OrgPersonWithImage[]
  customSegments: WorkspaceCustomPeopleSegment[]
}): WorkspacePeopleSegment[] {
  const categoryCounts = new Map<PersonCategory, number>()
  for (const person of people) {
    categoryCounts.set(
      person.category,
      (categoryCounts.get(person.category) ?? 0) + 1
    )
  }

  return [
    { id: "all", kind: "all", label: "All", count: people.length },
    ...PERSON_CATEGORY_OPTIONS.flatMap<WorkspaceCategoryPeopleSegment>(
      (option) => {
        const count = categoryCounts.get(option.value) ?? 0
        if (count === 0) return []
        return [
          {
            id: `category-${option.value}`,
            kind: "category",
            label: option.label,
            category: option.value,
            count,
          },
        ]
      }
    ),
    ...customSegments.map((segment) => ({
      ...segment,
      count: segment.memberIds.length,
    })),
  ]
}

export function resolveSegmentPeople({
  people,
  segment,
}: {
  people: OrgPersonWithImage[]
  segment: WorkspacePeopleSegment
}) {
  if (segment.kind === "all") return people
  if (segment.kind === "category") {
    return people.filter((person) => person.category === segment.category)
  }
  const memberIds = new Set(segment.memberIds)
  return people.filter((person) => memberIds.has(person.id))
}

export function segmentShowsReportsTo(segment: WorkspacePeopleSegment) {
  return segment.kind === "category" && segment.category === "staff"
}

function personMatchesSearch(
  person: OrgPersonWithImage,
  query: string,
  currentTagLabels: string[]
) {
  if (!query) return true
  const categoryLabel =
    PERSON_CATEGORY_OPTIONS.find((option) => option.value === person.category)
      ?.label ?? person.category
  return [
    person.name,
    person.title,
    person.email,
    person.category,
    person.customRole,
    categoryLabel,
    ...(person.tags ?? []),
    ...currentTagLabels,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .includes(query)
}

function personMatchesCategory(
  person: OrgPersonWithImage,
  categoryFilter: PersonRoleFilterValue
) {
  return personMatchesRole(person, categoryFilter)
}

function buildPersonTagLabels(tags: OrganizationPeopleTag[]) {
  const labelsByPerson = new Map<string, string[]>()
  for (const tag of tags) {
    for (const personId of tag.memberIds) {
      const current = labelsByPerson.get(personId) ?? []
      current.push(tag.label)
      labelsByPerson.set(personId, current)
    }
  }
  return labelsByPerson
}

export function useFilteredWorkspacePeople({
  categoryFilter,
  people,
  query,
  tags,
}: {
  categoryFilter: PersonRoleFilterValue
  people: OrgPersonWithImage[]
  query: string
  tags: OrganizationPeopleTag[]
}) {
  const tagLabelsByPerson = useMemo(() => buildPersonTagLabels(tags), [tags])
  const categoryFilteredPeople = useMemo(
    () =>
      people.filter((person) => personMatchesCategory(person, categoryFilter)),
    [categoryFilter, people]
  )
  return useMemo(() => {
    if (!query) return categoryFilteredPeople
    return categoryFilteredPeople.filter((person) =>
      personMatchesSearch(person, query, tagLabelsByPerson.get(person.id) ?? [])
    )
  }, [categoryFilteredPeople, query, tagLabelsByPerson])
}
