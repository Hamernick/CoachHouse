"use client"

import MapPinIcon from "lucide-react/dist/esm/icons/map-pin"
import { FormRow } from "@/components/organization/org-profile-card/shared"
import type { CompanyEditProps } from "../types"

export function PublicPageSettings({ company }: CompanyEditProps) {
  const hasAddress = [
    company.addressStreet,
    company.addressCity,
    company.addressState,
    company.addressPostal,
    company.addressCountry,
    company.address,
  ].some((value) => typeof value === "string" && value.trim().length > 0)
  const isOnlineOnly = company.locationType === "online"

  if (!company.isPublic || isOnlineOnly) return null

  return (
    <FormRow layout="stacked" inset={false} title="Public Map Profile">
      <div className="grid gap-4">
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
                  Location section.
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
                  from the Location section and falls back to broader locality
                  matching if the exact street lookup misses.
                </p>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </FormRow>
  )
}
