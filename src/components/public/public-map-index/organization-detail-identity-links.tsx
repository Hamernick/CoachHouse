"use client"

import LinkIcon from "lucide-react/dist/esm/icons/link"

import { Button } from "@/components/ui/button"
import type { PublicMapOrganization } from "@/lib/queries/public-map-index"

import {
  buildSocialLinks,
  normalizeHref,
} from "./organization-detail-helpers"
import { OrganizationDetailSocialButton } from "./organization-detail-social-button"

export function OrganizationDetailIdentityLinks({
  organization,
}: {
  organization: PublicMapOrganization
}) {
  const website = normalizeHref(organization.website)
  const socials = buildSocialLinks(organization)

  if (!website && socials.length === 0) return null

  return (
    <div className="mt-2 flex min-w-0 flex-col items-center">
      {website ? (
        <Button
          asChild
          variant="link"
          className="text-muted-foreground hover:text-foreground relative h-8 min-w-0 max-w-full shrink px-0 py-0 text-xs sm:max-w-72 after:absolute after:inset-x-0 after:top-1/2 after:h-11 after:-translate-y-1/2"
        >
          <a href={website} target="_blank" rel="noreferrer" title={website}>
            <LinkIcon className="size-3.5 shrink-0" aria-hidden />
            <span className="min-w-0 truncate">
              {website.replace(/^https?:\/\//i, "").replace(/\/$/, "")}
            </span>
          </a>
        </Button>
      ) : null}
      {socials.length > 0 ? (
        <div className="flex flex-wrap items-center justify-center gap-4 py-2">
          {socials.map((social) => (
            <OrganizationDetailSocialButton key={social.key} social={social} />
          ))}
        </div>
      ) : null}
    </div>
  )
}
