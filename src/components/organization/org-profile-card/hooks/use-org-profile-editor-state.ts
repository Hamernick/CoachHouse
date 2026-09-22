"use client"

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type ChangeEvent,
} from "react"
import { useRouter } from "next/navigation"

import { updateOrganizationProfileAction } from "@/actions/organization"
import { toast } from "@/lib/toast"
import { normalizeCompanyProfile, ORG_PROFILE_TABS } from "../config"
import { useOrgProfileTabState } from "./use-org-profile-tab-state"
import { useOrgProfileUnsavedGuards } from "./use-org-profile-unsaved-guards"
import {
  applyOrgProfileUpdates,
  clearOrgProfileErrors,
  mapOrgProfileFieldErrors,
} from "./use-org-profile-editor-state-helpers"
import type {
  UseOrgProfileEditorStateArgs,
  UseOrgProfileEditorStateResult,
} from "./use-org-profile-editor-state-types"
import type {
  OrgProfile,
  OrgProfileErrors,
  OrgProgram,
  SlugStatus,
} from "../types"
import { organizationProfileSchema } from "../validation"
import { slugifyLocal } from "../utils"
import { RESERVED_SLUGS } from "../tabs/company-tab/constants"

export function useOrgProfileEditorState({
  initial,
  programs,
  canEdit,
  initialTab,
  initialProgramId,
  initialEditMode,
}: UseOrgProfileEditorStateArgs): UseOrgProfileEditorStateResult {
  const normalizedInitial = useMemo(
    () => normalizeCompanyProfile(initial),
    [initial]
  )
  const router = useRouter()
  const [editMode, setEditMode] = useState(canEdit && initialEditMode === true)
  const [isPending, startTransition] = useTransition()
  const [dirty, setDirty] = useState(false)
  const { tab, setTab, handleTabChange } = useOrgProfileTabState({ initialTab })
  const [company, setCompany] = useState<OrgProfile>(() => normalizedInitial)
  const [savedCompany, setSavedCompany] = useState<OrgProfile>(
    () => normalizedInitial
  )
  const savedCompanyRef = useRef(savedCompany)
  const pendingNavigationRef = useRef<string | null>(null)
  const [confirmDiscardOpen, setConfirmDiscardOpen] = useState(false)
  const [errors, setErrors] = useState<OrgProfileErrors>({})
  const [validationAttempt, setValidationAttempt] = useState(0)
  const [editProgram, setEditProgram] = useState<OrgProgram | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const hasUnsavedChanges = dirty
  const [slugStatus, setSlugStatus] = useState<SlugStatus>(null)
  const didOpenProgramRef = useRef(false)

  useEffect(() => {
    savedCompanyRef.current = savedCompany
  }, [savedCompany])

  useEffect(() => {
    if (!initialProgramId || !canEdit || didOpenProgramRef.current) return
    const match =
      programs.find((program) => program.id === initialProgramId) ?? null
    if (!match) return
    setTab("programs")
    setEditProgram(match)
    setEditOpen(true)
    didOpenProgramRef.current = true
  }, [canEdit, initialProgramId, programs, setTab])

  useOrgProfileUnsavedGuards({
    canEdit,
    hasUnsavedChanges,
    pendingNavigationRef,
    setConfirmDiscardOpen,
  })

  const handleInputChange = useCallback(
    (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      if (!canEdit) return
      const { name, value } = event.currentTarget
      setCompany((prev) => ({ ...prev, [name]: value }))
      setDirty(true)
      setErrors((prev) => ({ ...prev, [name]: "" }))
    },
    [canEdit]
  )

  const updateCompany = useCallback((updates: Partial<OrgProfile>) => {
    setCompany((prev) => ({ ...prev, ...updates }))
  }, [])

  const handleCompanyUpdate = useCallback(
    (updates: Partial<OrgProfile>) => {
      updateCompany(updates)
      setErrors((prev) => clearOrgProfileErrors(prev, updates))
    },
    [updateCompany]
  )

  const markDirty = useCallback(() => {
    if (!canEdit) return
    setDirty(true)
  }, [canEdit])

  const discardChanges = useCallback(() => {
    setCompany(savedCompanyRef.current)
    setErrors({})
    setDirty(false)
    setEditMode(false)
    setSlugStatus(null)
  }, [])

  const persistProfileUpdates = useCallback(
    async (updates: Partial<OrgProfile>) => {
      const keys = Object.keys(updates) as Array<keyof OrgProfile>
      if (keys.length === 0) return

      setCompany((prev) => applyOrgProfileUpdates(prev, updates))

      const res = await updateOrganizationProfileAction(updates)
      const error = (res as { error?: string })?.error
      if (error) {
        const previous = savedCompanyRef.current
        const rollbackUpdates: Partial<OrgProfile> = {}
        const mutableRollback = rollbackUpdates as Record<
          keyof OrgProfile,
          OrgProfile[keyof OrgProfile] | undefined
        >
        for (const key of keys) {
          mutableRollback[key] = previous[key]
        }
        setCompany((prev) => applyOrgProfileUpdates(prev, rollbackUpdates))
        throw new Error(error)
      }

      const narrativeRevisions = (
        res as { narrativeRevisions?: OrgProfile["narrativeRevisions"] }
      ).narrativeRevisions
      if (narrativeRevisions) {
        setCompany((prev) => ({ ...prev, narrativeRevisions }))
      }
      setSavedCompany((prev) => ({
        ...prev,
        ...updates,
        ...(narrativeRevisions ? { narrativeRevisions } : {}),
      }))
      setErrors((prev) => clearOrgProfileErrors(prev, updates))
    },
    []
  )

  const handleSave = useCallback(() => {
    if (!canEdit) return
    startTransition(async () => {
      const parsed = organizationProfileSchema.safeParse(company)
      if (!parsed.success) {
        const nextErrors = mapOrgProfileFieldErrors(
          parsed.error.flatten().fieldErrors
        )
        const firstError = Object.values(nextErrors).find(
          (value) => value.trim().length > 0
        )
        setErrors(nextErrors)
        setValidationAttempt((attempt) => attempt + 1)
        toast.error(firstError ?? "Please fix the highlighted fields.")
        return
      }

      const hasExplicitSlug =
        typeof company.publicSlug === "string" &&
        company.publicSlug.trim().length > 0
      const shouldCheckSlug = hasExplicitSlug || Boolean(company.isPublic)
      if (shouldCheckSlug) {
        const base = hasExplicitSlug
          ? (company.publicSlug ?? "")
          : (company.name ?? "")
        const candidate = slugifyLocal(String(base))
        if (!candidate) {
          setSlugStatus({
            available: false,
            message: "Enter a public URL",
            slug: "",
          })
          setErrors((prev) => ({ ...prev, publicSlug: "Enter a public URL" }))
          toast.error("Enter a public URL")
          return
        }
        if (RESERVED_SLUGS.has(candidate)) {
          setSlugStatus({
            available: false,
            message: "Reserved URL",
            slug: candidate,
          })
          setErrors((prev) => ({ ...prev, publicSlug: "This URL is reserved" }))
          toast.error("That public URL is reserved")
          return
        }
        if (slugStatus?.slug === candidate && slugStatus.available) {
          setErrors((prev) => ({ ...prev, publicSlug: "" }))
        }
        if (!(slugStatus?.slug === candidate && slugStatus.available)) {
          try {
            const res = await fetch(
              `/api/public/organizations/slug-available?slug=${encodeURIComponent(candidate)}`
            )
            const data = await res.json().catch(() => ({}))
            if (typeof data.available === "boolean") {
              const message = data.available
                ? "Available"
                : data.error || "Taken"
              setSlugStatus({
                available: data.available,
                message,
                slug: candidate,
              })
              if (!data.available) {
                setErrors((prev) => ({
                  ...prev,
                  publicSlug: data.error || "Public URL is taken",
                }))
                toast.error("Public URL is not available")
                return
              }
              setErrors((prev) => ({ ...prev, publicSlug: "" }))
            } else {
              setSlugStatus({
                available: false,
                message: data.error || "Not available",
                slug: candidate,
              })
              setErrors((prev) => ({
                ...prev,
                publicSlug: data.error || "Public URL is not available",
              }))
              toast.error("Public URL is not available")
              return
            }
          } catch {
            setSlugStatus({
              available: false,
              message: "Unable to check",
              slug: candidate,
            })
            setErrors((prev) => ({
              ...prev,
              publicSlug: "Unable to verify public URL",
            }))
            toast.error("Unable to verify public URL")
            return
          }
        }
      }

      let res: Awaited<ReturnType<typeof updateOrganizationProfileAction>>
      try {
        res = await updateOrganizationProfileAction(company)
      } catch {
        toast.error(
          "The organization could not save. Your edits are still available; retry or refresh."
        )
        return
      }
      if ((res as { error?: string })?.error) {
        toast.error((res as { error?: string }).error as string)
        return
      }
      toast.success("Organization updated")
      const narrativeRevisions = (
        res as { narrativeRevisions?: OrgProfile["narrativeRevisions"] }
      ).narrativeRevisions
      const savedCompany = narrativeRevisions
        ? { ...company, narrativeRevisions }
        : company
      setEditMode(false)
      setDirty(false)
      setCompany(savedCompany)
      setSavedCompany(savedCompany)
    })
  }, [company, canEdit, slugStatus])

  const handleProgramEdit = useCallback(
    (program: OrgProgram) => {
      if (!canEdit) return
      setEditProgram(program)
      setEditOpen(true)
    },
    [canEdit]
  )

  const handleCancelEdit = useCallback(() => {
    if (!hasUnsavedChanges) {
      discardChanges()
      return
    }
    pendingNavigationRef.current = null
    setConfirmDiscardOpen(true)
  }, [hasUnsavedChanges, discardChanges])

  const handleDiscardConfirm = useCallback(() => {
    const nextUrl = pendingNavigationRef.current
    pendingNavigationRef.current = null
    discardChanges()
    if (nextUrl && typeof window !== "undefined") {
      const targetUrl = new URL(nextUrl, window.location.href)
      if (targetUrl.origin === window.location.origin) {
        router.push(`${targetUrl.pathname}${targetUrl.search}${targetUrl.hash}`)
      } else {
        window.location.href = nextUrl
      }
    }
  }, [discardChanges, router])

  const currentTabLabel = useMemo(
    () =>
      ORG_PROFILE_TABS.find((entry) => entry.value === tab)?.label ?? "About",
    [tab]
  )
  const publicLink =
    canEdit && company.isPublic && company.publicSlug
      ? `/${encodeURIComponent(company.publicSlug)}`
      : null

  return {
    tab,
    handleTabChange,
    editMode,
    setEditMode,
    isPending,
    dirty,
    company,
    errors,
    validationAttempt,
    slugStatus,
    setSlugStatus,
    editProgram,
    editOpen,
    setEditOpen,
    confirmDiscardOpen,
    setConfirmDiscardOpen,
    currentTabLabel,
    publicLink,
    handleInputChange,
    handleCompanyUpdate,
    markDirty,
    persistProfileUpdates,
    handleSave,
    handleProgramEdit,
    handleCancelEdit,
    handleDiscardConfirm,
    pendingNavigationRef,
  }
}
