"use client"

import Link from "next/link"
import { useEffect, useMemo, useRef, useState } from "react"
import CheckIcon from "lucide-react/dist/esm/icons/check"
import GlobeIcon from "lucide-react/dist/esm/icons/globe"
import MapPinIcon from "lucide-react/dist/esm/icons/map-pin"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

import styles from "../../../profile-edit-fields.module.css"
import {
  FormRow,
  ProfileField,
} from "@/components/organization/org-profile-card/shared"
import { slugifyLocal } from "../../../utils"
import type { CompanyEditProps } from "../types"
import { RESERVED_SLUGS } from "../constants"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"

export function PublicPageSettings({
  company,
  errors,
  onUpdate,
  onDirty,
  slugStatus,
  setSlugStatus,
}: CompanyEditProps) {
  const [isChecking, setIsChecking] = useState(false)
  const lastCheckRef = useRef(0)
  const explicitSlug =
    typeof company.publicSlug === "string" &&
    company.publicSlug.trim().length > 0
      ? company.publicSlug
      : ""
  const shouldCheckSlug = Boolean(explicitSlug || company.isPublic)
  const hasAddress = [
    company.addressStreet,
    company.addressCity,
    company.addressState,
    company.addressPostal,
    company.addressCountry,
    company.address,
  ].some((value) => typeof value === "string" && value.trim().length > 0)
  const isOnlineOnly = company.locationType === "online"
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
    <FormRow
      layout="stacked"
      inset={false}
      title="Public Map Profile"
      focusKey="public-page"
      description="Publish your organization on the Coach House map index."
    >
      <div className="grid gap-4">
        <div className={styles.setting}>
          <Switch
            id="publicPageEnabled"
            checked={Boolean(company.isPublic)}
            onCheckedChange={(value) => {
              onUpdate({ isPublic: Boolean(value) })
              onDirty()
            }}
            aria-label="Make organization visible on map"
          />
          <div className="space-y-1">
            <Label
              htmlFor="publicPageEnabled"
              className="text-muted-foreground text-xs"
            >
              Public
            </Label>
            <p className="text-muted-foreground text-xs">
              When enabled, your organization is discoverable on{" "}
              <Link
                href="/"
                target="_blank"
                rel="noreferrer"
                className="text-inherit underline underline-offset-2"
              >
                our map
              </Link>
              .
            </p>
          </div>
        </div>
        <div className={styles.group}>
          <ProfileField label="Access" focusKey="publicLocationType">
            <Select
              value={isOnlineOnly ? "online" : "in_person"}
              onValueChange={(value) => {
                if (value !== "online" && value !== "in_person") return
                onUpdate({ locationType: value })
                onDirty()
              }}
            >
              <SelectTrigger id="publicLocationType" className="bg-background">
                <SelectValue placeholder="Select access type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="in_person">Physical location</SelectItem>
                <SelectItem value="online">Online only</SelectItem>
              </SelectContent>
            </Select>
          </ProfileField>

          {isOnlineOnly ? (
            <ProfileField label="Web resource" focusKey="locationUrl">
              <Input
                id="locationUrl"
                name="locationUrl"
                value={company.locationUrl ?? ""}
                onChange={(event) => {
                  onUpdate({ locationUrl: event.currentTarget.value })
                  onDirty()
                }}
                placeholder="https://example.org/get-help"
                aria-invalid={Boolean(errors.locationUrl)}
              />
              {errors.locationUrl ? (
                <p className="text-destructive text-xs">{errors.locationUrl}</p>
              ) : null}
              <p className="text-muted-foreground text-xs">
                Add the link people should visit if this organization is a web
                resource.
              </p>
            </ProfileField>
          ) : null}
        </div>
        {company.isPublic && !hasAddress && !isOnlineOnly ? (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
            <div className="flex items-start gap-2">
              <MapPinIcon
                className="mt-0.5 h-4 w-4 shrink-0 text-amber-500"
                aria-hidden
              />
              <div className="space-y-1">
                <p className="text-foreground text-sm font-medium">
                  Add an address to appear on the map
                </p>
                <p className="text-muted-foreground text-xs">
                  This profile can still be published now, but it will not
                  render a map marker until you add a public address in the
                  Address section.
                </p>
              </div>
            </div>
          </div>
        ) : null}
        {company.isPublic && hasAddress && !isOnlineOnly ? (
          <div className="border-primary/20 bg-primary/5 rounded-xl border p-3">
            <div className="flex items-start gap-2">
              <MapPinIcon
                className="text-primary mt-0.5 h-4 w-4 shrink-0"
                aria-hidden
              />
              <div className="space-y-1">
                <p className="text-foreground text-sm font-medium">
                  Map marker coordinates are populated automatically
                </p>
                <p className="text-muted-foreground text-xs">
                  When you save this profile, Coach House geocodes the address
                  from the Address section and falls back to broader locality
                  matching if the exact street lookup misses.
                </p>
              </div>
            </div>
          </div>
        ) : null}
        {company.isPublic && isOnlineOnly ? (
          <div className="border-primary/30 bg-primary/5 rounded-xl border p-3">
            <div className="flex items-start gap-2">
              <GlobeIcon
                className="text-primary mt-0.5 h-4 w-4 shrink-0"
                aria-hidden
              />
              <div className="space-y-1">
                <p className="text-foreground text-sm font-medium">
                  This will appear as a web resource
                </p>
                <p className="text-muted-foreground text-xs">
                  Online-only organizations stay visible in Find with a web
                  resource badge instead of a map marker.
                </p>
              </div>
            </div>
          </div>
        ) : null}
        <div className="grid gap-3">
          <div className={cn(styles.group, styles.singleGroup)}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Label htmlFor="publicSlug">Public URL</Label>
            </div>
            <div
              className={cn(
                "flex min-w-0 items-center gap-2 rounded-lg",
                Boolean(errors.publicSlug) && "border-destructive/70"
              )}
            >
              <span className="text-muted-foreground shrink-0 text-sm">
                coachhouse.app/
              </span>
              <Input
                id="publicSlug"
                name="publicSlug"
                value={company.publicSlug ?? ""}
                onChange={(event) => {
                  const value = event.currentTarget.value
                  const normalized = slugifyLocal(value)
                  onUpdate({ publicSlug: normalized })
                  setSlugStatus(null)
                  onDirty()
                }}
                placeholder={slugifyLocal(company.name || "")}
                aria-invalid={Boolean(errors.publicSlug)}
                className="h-9 min-w-0 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
              />
              {statusMessage?.tone === "success" ? (
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
                  <CheckIcon className="h-3 w-3" aria-hidden />
                  {statusMessage.message}
                </span>
              ) : statusMessage?.tone === "muted" ? (
                <span className="bg-muted text-muted-foreground shrink-0 rounded-full px-2 py-1 text-[11px] font-medium">
                  {statusMessage.message}
                </span>
              ) : null}
            </div>
            {statusMessage?.tone === "error" ? (
              <p
                className="text-destructive text-xs"
                role="status"
                aria-live="polite"
              >
                {statusMessage.message}
              </p>
            ) : (
              <p className="text-muted-foreground text-xs">
                Lowercase letters, numbers, and dashes only. Avoid reserved
                words like /admin.
              </p>
            )}
          </div>
        </div>
      </div>
    </FormRow>
  )
}
