"use client"

import { getReactGrabOwnerProps } from "@/components/dev/react-grab-surface"
import { PROVIDER_ICON } from "@/components/shared/provider-icons"
import { Button } from "@/components/ui/button"
import { normalizeExternalUrl } from "@/lib/organization/urls"
import { cn } from "@/lib/utils"

import type { OrgProfile } from "./types"
import { OrganizationSocialBrandIcon } from "./social-brand-icon"

const linkFields = [
  { key: "publicUrl", label: "Website", icon: PROVIDER_ICON.generic, text: true },
  { key: "newsletter", label: "Newsletter", icon: PROVIDER_ICON.email, text: true },
  { key: "twitter", label: "X", icon: null, text: false },
  { key: "facebook", label: "Facebook", icon: null, text: false },
  { key: "linkedin", label: "LinkedIn", icon: null, text: false },
  { key: "instagram", label: "Instagram", icon: null, text: false },
  { key: "youtube", label: "YouTube", icon: null, text: false },
  { key: "tiktok", label: "TikTok", icon: null, text: false },
  { key: "github", label: "GitHub", icon: null, text: false },
] as const

export function OrgProfileHeaderLinks({ company, centered = false }: { company: OrgProfile; centered?: boolean }) {
  const links = linkFields.flatMap((field) => {
    const normalized = normalizeExternalUrl(company[field.key])
    if (!normalized) return []
    try {
      const url = new URL(normalized)
      if (url.protocol !== "https:" && url.protocol !== "http:") return []
      return [{
        ...field,
        href: url.href,
        textLabel: field.key === "publicUrl"
          ? url.hostname.replace(/^www\./, "")
          : field.label,
      }]
    } catch {
      return []
    }
  })

  if (links.length === 0) return null

  return (
    <nav
      aria-label="Organization links"
      className={cn("mt-1 flex max-w-full flex-col", centered ? "items-center" : "-ml-1 items-start")}
      {...getReactGrabOwnerProps({
        ownerId: "organization-profile-links",
        component: "OrgProfileHeaderLinks",
        source: "src/components/organization/org-profile-card/header-links.tsx",
        slot: "organization-profile-links",
      })}
    >
      {[true, false].map((textRow) => {
        const rowLinks = links.filter((link) => link.text === textRow)
        if (rowLinks.length === 0) return null
        return (
          <div key={String(textRow)} className={cn("flex max-w-full flex-wrap items-center gap-x-0.5", centered && "justify-center")}>
            {rowLinks.map(({ key, label, icon: Icon, text, textLabel, href }) => (
              <Button
                key={key}
                asChild
                variant="ghost"
                size={text ? "sm" : "icon"}
                className={cn(
                  "text-muted-foreground max-w-full rounded-md font-normal",
                  text
                    ? "h-8 px-1 py-0 [@media(pointer:coarse)]:h-11"
                    : "size-8 p-0 [@media(pointer:coarse)]:size-11"
                )}
              >
                <a href={href} target="_blank" rel="noopener noreferrer" aria-label={label} title={label}>
                  <span className="inline-flex max-w-full items-center justify-center gap-1.5">
                    <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-[4px] bg-white text-neutral-700 dark:bg-muted dark:text-foreground">
                      {text ? (
                        <Icon className="size-4" aria-hidden="true" />
                      ) : <OrganizationSocialBrandIcon platform={key} />}
                    </span>
                    {text ? <span className="truncate">{textLabel}</span> : null}
                  </span>
                </a>
              </Button>
            ))}
          </div>
        )
      })}
    </nav>
  )
}
