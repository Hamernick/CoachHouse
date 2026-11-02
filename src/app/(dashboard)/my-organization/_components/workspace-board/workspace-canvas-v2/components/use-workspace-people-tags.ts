"use client"

import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"

import {
  addOrganizationPeopleTagMembersAction,
  createOrganizationPeopleTagAction,
  deleteOrganizationPeopleTagAction,
  removeOrganizationPeopleTagMembersAction,
  updateOrganizationPeopleTagAction,
} from "@/actions/people-tags"
import type {
  OrganizationPeopleTag,
  OrganizationPeopleTagColor,
} from "@/lib/people/tags"

import { createWorkspacePeopleMutationCoordinator } from "./workspace-people-optimistic-mutations"

function copyPeopleTag(tag: OrganizationPeopleTag): OrganizationPeopleTag {
  return { ...tag, memberIds: [...tag.memberIds] }
}

function replacePeopleTag(
  tags: OrganizationPeopleTag[],
  replacement: OrganizationPeopleTag
) {
  return tags.map((tag) =>
    tag.id === replacement.id ? copyPeopleTag(replacement) : tag
  )
}

function withTagMemberIds(tag: OrganizationPeopleTag, memberIds: string[]) {
  return { ...tag, memberIds }
}

export function useWorkspacePeopleTags(initialTags: OrganizationPeopleTag[]) {
  const [tags, setTags] = useState(initialTags)
  const [confirmedTags] = useState(
    () => new Map(initialTags.map((tag) => [tag.id, copyPeopleTag(tag)]))
  )
  const [mutationCoordinator] = useState(
    createWorkspacePeopleMutationCoordinator
  )

  useEffect(() => {
    mutationCoordinator.reset()
    confirmedTags.clear()
    initialTags.forEach((tag) => {
      confirmedTags.set(tag.id, copyPeopleTag(tag))
    })
    setTags(initialTags)
  }, [confirmedTags, initialTags, mutationCoordinator])

  const createTag = useCallback(
    async ({
      color,
      label,
      personId,
    }: {
      color: OrganizationPeopleTagColor
      label: string
      personId?: string
    }) => {
      const result = await createOrganizationPeopleTagAction({
        color,
        label,
        personId,
      })
      if ("error" in result) {
        toast.error(result.error)
        return false
      }
      setTags((current) =>
        current.some((tag) => tag.id === result.tag.id)
          ? current
          : [...current, result.tag]
      )
      confirmedTags.set(result.tag.id, copyPeopleTag(result.tag))
      return true
    },
    [confirmedTags]
  )

  const updateTag = useCallback(
    async ({
      color,
      label,
      tagId,
    }: {
      color: OrganizationPeopleTagColor
      label: string
      tagId: string
    }) => {
      const previousTag = tags.find((tag) => tag.id === tagId)
      if (!previousTag) return false
      const mutationKey = `tag:${tagId}`
      const mutationToken = mutationCoordinator.begin(mutationKey)
      setTags((current) =>
        current.map((tag) =>
          tag.id === tagId ? { ...tag, color, label } : tag
        )
      )
      const result = await mutationCoordinator.run(mutationKey, () =>
        updateOrganizationPeopleTagAction({ color, label, tagId })
      )
      if ("error" in result) {
        if (mutationCoordinator.isLatest(mutationToken)) {
          const confirmedTag = confirmedTags.get(tagId)
          if (confirmedTag) {
            setTags((current) => replacePeopleTag(current, confirmedTag))
          }
        }
        toast.error(result.error)
        return false
      }
      if (mutationCoordinator.isCurrent(mutationToken)) {
        const confirmedTag = confirmedTags.get(tagId)
        if (confirmedTag) {
          confirmedTags.set(tagId, { ...confirmedTag, ...result.tag })
        }
      }
      if (mutationCoordinator.isLatest(mutationToken)) {
        const confirmedTag = confirmedTags.get(tagId)
        if (confirmedTag) {
          setTags((current) => replacePeopleTag(current, confirmedTag))
        }
      }
      return true
    },
    [confirmedTags, mutationCoordinator, tags]
  )

  const deleteTag = useCallback(
    async (tagId: string) => {
      const removedIndex = tags.findIndex((tag) => tag.id === tagId)
      const removedTag = tags[removedIndex]
      if (!removedTag) return false
      const mutationKey = `tag:${tagId}`
      const mutationToken = mutationCoordinator.begin(mutationKey)
      setTags((current) => current.filter((tag) => tag.id !== tagId))
      const result = await mutationCoordinator.run(mutationKey, () =>
        deleteOrganizationPeopleTagAction(tagId)
      )
      if ("error" in result) {
        if (mutationCoordinator.isLatest(mutationToken)) {
          const confirmedTag = confirmedTags.get(tagId) ?? removedTag
          setTags((current) => {
            if (current.some((tag) => tag.id === tagId)) return current
            const next = [...current]
            next.splice(removedIndex, 0, copyPeopleTag(confirmedTag))
            return next
          })
        }
        toast.error(result.error)
        return false
      }
      if (mutationCoordinator.isCurrent(mutationToken)) {
        confirmedTags.delete(tagId)
      }
      return true
    },
    [confirmedTags, mutationCoordinator, tags]
  )

  const addPersonToTag = useCallback(
    async (tagId: string, personId: string) => {
      const tag = tags.find((item) => item.id === tagId)
      if (!tag) return false
      const mutationKey = `tag:${tagId}`
      const mutationToken = mutationCoordinator.begin(mutationKey)
      setTags((current) =>
        current.map((item) =>
          item.id === tagId
            ? withTagMemberIds(item, Array.from(new Set([...item.memberIds, personId])))
            : item
        )
      )
      const result = await mutationCoordinator.run(mutationKey, () =>
        addOrganizationPeopleTagMembersAction(tagId, [personId])
      ).catch(() => ({ error: "Could not save the group. Please try again." }))
      if ("error" in result) {
        if (mutationCoordinator.isLatest(mutationToken)) {
          const confirmedTag = confirmedTags.get(tagId)
          if (confirmedTag) {
            setTags((current) => replacePeopleTag(current, confirmedTag))
          }
        }
        toast.error(result.error)
        return false
      }
      if (mutationCoordinator.isCurrent(mutationToken)) {
        const confirmedTag = confirmedTags.get(tagId)
        if (confirmedTag) {
          confirmedTags.set(
            tagId,
            withTagMemberIds(
              confirmedTag,
              Array.from(new Set([...confirmedTag.memberIds, personId]))
            )
          )
        }
      }
      if (mutationCoordinator.isLatest(mutationToken)) {
        const confirmedTag = confirmedTags.get(tagId)
        if (confirmedTag) {
          setTags((current) => replacePeopleTag(current, confirmedTag))
        }
      }
      return true
    },
    [confirmedTags, mutationCoordinator, tags]
  )

  const removePersonFromTag = useCallback(
    async (tagId: string, personId: string) => {
      const tag = tags.find((item) => item.id === tagId)
      if (!tag) return false
      const mutationKey = `tag:${tagId}`
      const mutationToken = mutationCoordinator.begin(mutationKey)
      setTags((current) =>
        current.map((item) =>
          item.id === tagId
            ? withTagMemberIds(
                item,
                item.memberIds.filter((id) => id !== personId)
              )
            : item
        )
      )
      const result = await mutationCoordinator.run(mutationKey, () =>
        removeOrganizationPeopleTagMembersAction(tagId, [personId])
      ).catch(() => ({ error: "Could not save the group. Please try again." }))
      if ("error" in result) {
        if (mutationCoordinator.isLatest(mutationToken)) {
          const confirmedTag = confirmedTags.get(tagId)
          if (confirmedTag) {
            setTags((current) => replacePeopleTag(current, confirmedTag))
          }
        }
        toast.error(result.error)
        return false
      }
      if (mutationCoordinator.isCurrent(mutationToken)) {
        const confirmedTag = confirmedTags.get(tagId)
        if (confirmedTag) {
          confirmedTags.set(
            tagId,
            withTagMemberIds(
              confirmedTag,
              confirmedTag.memberIds.filter((id) => id !== personId)
            )
          )
        }
      }
      if (mutationCoordinator.isLatest(mutationToken)) {
        const confirmedTag = confirmedTags.get(tagId)
        if (confirmedTag) {
          setTags((current) => replacePeopleTag(current, confirmedTag))
        }
      }
      return true
    },
    [confirmedTags, mutationCoordinator, tags]
  )

  return {
    addPersonToTag,
    createTag,
    deleteTag,
    removePersonFromTag,
    tags,
    updateTag,
  }
}
