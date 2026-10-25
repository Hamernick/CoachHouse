"use client"

import { useEffect, useId, useMemo, useRef, useState } from "react"
import CheckIcon from "lucide-react/dist/esm/icons/check"
import XIcon from "lucide-react/dist/esm/icons/x"
import { Input } from "@/components/ui/input"
import { ProfileField } from "@/components/organization/org-profile-card/shared"
import { getOrganizationFocusTargetProps } from "../../../organization-deep-link-focus"
import { slugifyLocal } from "../../../utils"
import type { CompanyEditProps } from "../types"
import { RESERVED_SLUGS } from "../constants"
import { cn } from "@/lib/utils"

export function PublicUrlField({
  company, errors, onUpdate, onDirty, slugStatus, setSlugStatus,
}: Pick<CompanyEditProps, "company" | "errors" | "onUpdate" | "onDirty" | "slugStatus" | "setSlugStatus">) {
  const helpId = useId()
  const [isChecking, setIsChecking] = useState(false)
  const lastCheckRef = useRef(0)
  const explicitSlug =
    typeof company.publicSlug === "string" &&
    company.publicSlug.trim().length > 0
      ? company.publicSlug
      : ""
  const shouldCheckSlug = Boolean(explicitSlug || company.isPublic)
  const slugCandidate = useMemo(() => {
    const raw = explicitSlug || (company.isPublic ? company.name || "" : "")
    return slugifyLocal(raw)
  }, [company.isPublic, company.name, explicitSlug])

  useEffect(() => {
    if (!shouldCheckSlug) {
      setIsChecking(false)
      setSlugStatus(null)
      return
    }
    if (!slugCandidate) {
      setIsChecking(false)
      setSlugStatus({
        available: false,
        message: "Enter a public URL",
        slug: "",
      })
      return
    }
    if (RESERVED_SLUGS.has(slugCandidate)) {
      setIsChecking(false)
      setSlugStatus({
        available: false,
        message: "Reserved URL",
        slug: slugCandidate,
      })
      return
    }

    const currentCheck = lastCheckRef.current + 1
    lastCheckRef.current = currentCheck
    const controller = new AbortController()
    const timeout = window.setTimeout(async () => {
      setIsChecking(true)
      try {
        const res = await fetch(
          `/api/public/organizations/slug-available?slug=${encodeURIComponent(slugCandidate)}`,
          {
            signal: controller.signal,
          }
        )
        const data = await res.json().catch(() => ({}))
        if (lastCheckRef.current !== currentCheck) return
        if (typeof data.available === "boolean") {
          setSlugStatus({
            available: data.available,
            message: data.available ? "Available" : data.error || "Taken",
            slug: slugCandidate,
          })
        } else {
          setSlugStatus({
            available: false,
            message: data.error || "Not available",
            slug: slugCandidate,
          })
        }
      } catch (error) {
        if ((error as Error).name === "AbortError") return
        setSlugStatus({
          available: false,
          message: "Unable to check",
          slug: slugCandidate,
        })
      } finally {
        if (lastCheckRef.current === currentCheck) {
          setIsChecking(false)
        }
      }
    }, 450)

    return () => {
      window.clearTimeout(timeout)
      controller.abort()
    }
  }, [shouldCheckSlug, slugCandidate, setSlugStatus])

  const statusMessage = useMemo(() => {
    if (errors.publicSlug) return { tone: "error", message: errors.publicSlug }
    if (isChecking) return { tone: "muted", message: "Checking..." }
    if (!slugStatus?.message) return null
    return {
      tone: slugStatus.available ? "success" : "error",
      message: slugStatus.message,
    }
  }, [errors.publicSlug, isChecking, slugStatus])

  return (
    <ProfileField label="Organization URL" focusKey="publicSlug" hideLabel>
      <div
        {...getOrganizationFocusTargetProps("public-page")}
        className={cn(
          "border-border/70 bg-background focus-within:border-ring focus-within:ring-ring/50 flex min-w-0 items-center gap-1 rounded-lg border p-1 focus-within:ring-[3px]",
          statusMessage?.tone === "error" && "border-destructive/70"
        )}
      >
        <span className="text-muted-foreground shrink-0 px-1 text-sm">coachhouse.app/</span>
        <Input
          id="publicSlug"
          name="publicSlug"
          autoCapitalize="none"
          autoComplete="off"
          spellCheck={false}
          value={company.publicSlug ?? ""}
          onChange={(event) => {
            onUpdate({ publicSlug: slugifyLocal(event.currentTarget.value) })
            setSlugStatus(null)
            onDirty()
          }}
          placeholder={slugifyLocal(company.name || "") || "your-organization"}
          aria-invalid={statusMessage?.tone === "error"}
          aria-describedby={helpId}
          className="h-9 min-w-0 flex-1 border-0 bg-transparent px-1 shadow-none focus-visible:ring-0"
        />
        {statusMessage?.tone === "success" ? (
          <span className="inline-flex size-5 shrink-0 items-center justify-center text-emerald-700 dark:text-emerald-300" role="status">
            <CheckIcon className="size-3" aria-hidden />
            <span className="sr-only">{statusMessage.message}</span>
          </span>
        ) : statusMessage?.tone === "error" ? (
          <XIcon className="text-destructive size-3 shrink-0" aria-hidden />
        ) : statusMessage?.tone === "muted" ? (
          <span className="text-muted-foreground shrink-0 text-[11px]" role="status">{statusMessage.message}</span>
        ) : null}
      </div>
      <p id={helpId} role={statusMessage?.tone === "error" ? "status" : undefined} className={cn("text-xs", statusMessage?.tone === "error" ? "text-destructive" : "text-muted-foreground")}>
        {statusMessage?.tone === "error" ? statusMessage.message : "Lowercase letters, numbers, and dashes only."}
      </p>
    </ProfileField>
  )
}
