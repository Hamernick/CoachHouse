"use client"

import ExternalLinkIcon from "lucide-react/dist/esm/icons/external-link"

import type { PublicMapOrganization } from "@/lib/queries/public-map-index"
import { cn } from "@/lib/utils"

import { PublicMapMediaImage } from "./media-image"

import { PUBLIC_MAP_SIDEBAR_MEDIA_SURFACE_CLASSNAME } from "./sidebar-theme"

type OrganizationListActivityPreviewProps = {
  constrainedLayout: boolean
  previewPrograms: PublicMapOrganization["programs"]
  programPreview: PublicMapOrganization["programPreview"]
}

function resolveFeaturedActivityHref(
  activity: PublicMapOrganization["programPreview"]
) {
  return activity?.ctaUrl || activity?.locationUrl || null
}

export function OrganizationListActivityPreview({
  constrainedLayout,
  previewPrograms,
  programPreview,
}: OrganizationListActivityPreviewProps) {
  const featuredActivityHref = resolveFeaturedActivityHref(programPreview)

  return (
    <>
      {programPreview?.title ? (
        <div
          className="border-border/60 bg-background/80 relative z-10 min-w-0 rounded-xl border px-2.5 py-2 shadow-none backdrop-blur-sm"

        >
          <div className="flex min-w-0 items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="text-muted-foreground flex min-w-0 flex-wrap items-center gap-1.5 text-xs leading-none">
                <span className="font-medium">
                  {programPreview.activityKind}
                </span>
                {programPreview.durationLabel ? (
                  <>
                    <span aria-hidden>•</span>
                    <span className="truncate">
                      {programPreview.durationLabel}
                    </span>
                  </>
                ) : null}
              </div>
              <p className="text-foreground mt-1 line-clamp-1 text-sm font-medium">
                {programPreview.title}
              </p>
              {programPreview.description || programPreview.subtitle ? (
                <p className="text-muted-foreground mt-0.5 line-clamp-1 text-xs">
                  {programPreview.description || programPreview.subtitle}
                </p>
              ) : null}
            </div>
            {featuredActivityHref ? (
              <a
                href={featuredActivityHref}
                target="_blank"
                rel="noreferrer"
                aria-label={`Open ${programPreview.title}`}
                className={cn(
                  "text-muted-foreground hover:text-foreground focus-visible:ring-ring/45 inline-flex size-7 shrink-0 items-center justify-center rounded-full transition-colors",
                  "hover:bg-muted/70 focus-visible:bg-muted/70 focus-visible:ring-2 focus-visible:outline-none"
                )}
                onClick={(event) => event.stopPropagation()}
                onPointerDown={(event) => event.stopPropagation()}
              >
                <ExternalLinkIcon className="size-3.5" aria-hidden />
              </a>
            ) : null}
          </div>
          {programPreview.chips.length > 0 ? (
            <div className="mt-1.5 flex min-w-0 flex-wrap items-center gap-1">
              {programPreview.chips.slice(0, 3).map((chip) => (
                <span
                  key={chip}
                  className="bg-muted/75 text-muted-foreground inline-flex h-6 max-w-full items-center rounded-full px-2 text-xs leading-none"
                >
                  <span className="truncate">{chip}</span>
                </span>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {previewPrograms.length > 0 ? (
        <div
          className={cn(
            "relative z-10 grid gap-1.5",
            constrainedLayout ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-3"
          )}

        >
          {previewPrograms.map((program) => (
            <div
              key={program.id}
              className={cn(
                "overflow-hidden rounded-lg",
                PUBLIC_MAP_SIDEBAR_MEDIA_SURFACE_CLASSNAME
              )}

            >
              <PublicMapMediaImage
                src={program.imageUrl ?? ""}
                alt=""
                wrapperClassName={cn(
                  "bg-muted/30",
                  constrainedLayout ? "h-[4.5rem]" : "h-20"
                )}
              />
              <div className="px-2 py-1.5">
                <p className="text-foreground line-clamp-1 text-xs font-medium">
                  {program.title}
                </p>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </>
  )
}
