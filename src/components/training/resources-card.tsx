"use client"

import { Children, type ReactNode } from "react"
import { Button } from "@/components/ui/button"
import ExternalLink from "lucide-react/dist/esm/icons/external-link"
import type { ModuleResource } from "@/components/training/types"
import { PROVIDER_ICON } from "@/components/shared/provider-icons"

const PROVIDER_LABEL: Record<string, string> = {
  youtube: "YouTube",
  "google-drive": "Google Drive",
  dropbox: "Dropbox",
  loom: "Loom",
  vimeo: "Vimeo",
  notion: "Notion",
  figma: "Figma",
  generic: "Resource",
}

type ResourcesCardProps = {
  resources: ModuleResource[]
  variant?: "grid" | "stacked"
  children?: ReactNode
}

export function ResourcesCard({ resources, variant = "grid", children }: ResourcesCardProps) {
  const stacked = variant === "stacked"
  const extraItems = Children.toArray(children).filter(Boolean)
  const hasContent = resources.length > 0 || extraItems.length > 0
  const totalItems = resources.length + extraItems.length
  const singleGridItem = !stacked && totalItems === 1

  const gridClass = stacked
    ? "grid min-w-0 gap-3"
    : `grid gap-4 justify-items-center ${singleGridItem ? "sm:grid-cols-1" : "sm:grid-cols-2"}`

  return (
    <div className={gridClass}>
      {!hasContent ? (
        <div
          className={
            stacked
              ? "w-full min-h-[220px] rounded-2xl border border-dashed border-border/60 bg-muted/30 p-4 text-sm text-muted-foreground"
              : "aspect-square w-full max-w-[260px] rounded-2xl border border-dashed border-border/60 bg-muted/30 p-4 text-sm text-muted-foreground"
          }
        >
          No additional resources provided yet.
        </div>
      ) : (
        <>
          {extraItems}
          {resources.map(({ label, url, provider }, index) => {
            const Icon = PROVIDER_ICON[String(provider)] ?? PROVIDER_ICON.generic
            const trimmedUrl = typeof url === "string" ? url.trim() : ""
            const hasUrl = trimmedUrl.length > 0
            const providerLabel = PROVIDER_LABEL[String(provider)] ?? "Resource"
            const displayLabel = /^link to our substack/i.test(label) ? "Subscribe to our Substack" : label
            let hostLabel: string | null = null
            if (hasUrl && /^https?:\/\//i.test(trimmedUrl)) {
              try {
                hostLabel = new URL(trimmedUrl).host.replace(/^www\./, "")
              } catch {
                hostLabel = null
              }
            }
            const metaLabel = hostLabel ? `${providerLabel} | ${hostLabel}` : providerLabel
            return (
              <div
                key={`${trimmedUrl || label}-${index}`}
                className={
                  stacked
                    ? "group min-w-0 w-full min-h-[220px] rounded-2xl border border-border/60 bg-card/70 p-3 focus-within-visible:ring-2 focus-within-visible:ring-primary/40 focus-within-visible:ring-offset-2 focus-within-visible:ring-offset-background"
                    : "group aspect-square w-full max-w-[260px] rounded-2xl border border-border/60 bg-card/70 p-4 shadow-sm transition hover:shadow-md focus-within-visible:ring-2 focus-within-visible:ring-primary/40 focus-within-visible:ring-offset-2 focus-within-visible:ring-offset-background"
                }
              >
                <div className="flex h-full flex-col justify-between">
                  <div className="space-y-3">
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border/60 bg-muted/40 text-foreground">
                      <Icon className="h-5 w-5" />
                    </span>
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-foreground line-clamp-2 break-words">{displayLabel}</p>
                      <p className="text-xs text-muted-foreground line-clamp-2 break-words">{metaLabel}</p>
                    </div>
                  </div>
                  {hasUrl ? (
                    <Button asChild size="sm" variant="secondary" className="w-full">
                      <a
                        href={trimmedUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`Open resource: ${label}`}
                      >
                        Open resource <ExternalLink className="ml-2 h-4 w-4" />
                      </a>
                    </Button>
                  ) : (
                    <Button size="sm" variant="secondary" className="w-full" disabled>
                      Link coming soon
                    </Button>
                  )}
                </div>
              </div>
            )
          })}
        </>
      )}
    </div>
  )
}
