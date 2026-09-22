"use client"

import { useState } from "react"
import GlobeIcon from "lucide-react/dist/esm/icons/globe"

import {
  getReactGrabLinkedSurfaceProps,
  getReactGrabOwnerProps,
} from "@/components/dev/react-grab-surface"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

import { isExternalHttpHref } from "./resource-detail-helpers"
import { resolvePublicMapResourceLinkBranding } from "./resource-link-branding"
import {
  PUBLIC_MAP_DETAIL_ICON_BUTTON_CLASSNAME,
  PUBLIC_MAP_SIDEBAR_ACTION_SURFACE_CLASSNAME,
} from "./sidebar-theme"

const SOURCE = "src/components/public/public-map-index/resource-link-button.tsx"

function ResourceLinkLogo({ iconUrls }: { iconUrls: string[] }) {
  const [iconIndex, setIconIndex] = useState(0)
  return (
    <Avatar className="size-5 rounded-none" aria-hidden>
      {iconUrls[iconIndex] ? (
        <AvatarImage
          src={iconUrls[iconIndex]}
          alt=""
          referrerPolicy="no-referrer"
          className="object-contain"
          onLoadingStatusChange={(status) => {
            if (status === "error") setIconIndex((index) => index + 1)
          }}
        />
      ) : null}
      <AvatarFallback className="rounded-none bg-transparent">
        <GlobeIcon className="size-4" aria-hidden />
      </AvatarFallback>
    </Avatar>
  )
}

export function PublicMapResourceLinkButton({
  href,
  label,
  ownerId,
  websiteHref,
  faviconUrl,
}: {
  href: string
  label: string
  ownerId: string
  websiteHref?: string | null
  faviconUrl?: string | null
}) {
  const { domain, iconUrls } = resolvePublicMapResourceLinkBranding({
    href, websiteHref, faviconUrl,
  })
  const accessibleLabel = domain ? `${label} — ${domain}` : label
  const external = isExternalHttpHref(href)

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          asChild
          variant="ghost"
          size="icon"
          className={cn(
            PUBLIC_MAP_DETAIL_ICON_BUTTON_CLASSNAME,
            PUBLIC_MAP_SIDEBAR_ACTION_SURFACE_CLASSNAME
          )}
        >
          <a
            {...getReactGrabOwnerProps({
              ownerId,
              component: "PublicMapResourceLinkButton",
              source: SOURCE,
              tokenSource: "src/components/public/public-map-index/sidebar-theme.ts",
              slot: "link",
            })}
            href={href}
            aria-label={accessibleLabel}
            target={external ? "_blank" : undefined}
            rel={external ? "noopener noreferrer" : undefined}
          >
            <ResourceLinkLogo key={iconUrls.join("|")} iconUrls={iconUrls} />
          </a>
        </Button>
      </TooltipTrigger>
      <TooltipContent
        {...getReactGrabLinkedSurfaceProps({
          ownerId,
          component: "PublicMapResourceLinkButton",
          source: SOURCE,
          surfaceKind: "content",
          slot: "label",
          tokenSource: "src/components/ui/tooltip.tsx",
        })}
        sideOffset={6}
      >
        {accessibleLabel}
      </TooltipContent>
    </Tooltip>
  )
}
