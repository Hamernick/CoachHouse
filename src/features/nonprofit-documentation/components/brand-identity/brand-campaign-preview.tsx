"use client"

import Image from "next/image"
import { cn } from "@/lib/utils"
import { foregroundFor, normalizeHex } from "../../lib/brand-identity"
import { brandFontStack } from "../../lib/brand-fonts"
import type { BrandIdentityDraft } from "../../types"
import { BrandAssetExample } from "./brand-asset-example"
import { brandIdentityOwner } from "./brand-identity-owner"

export function BrandCampaignPreview({
  draft,
  previewUrl,
  portrait = false,
}: {
  draft: BrandIdentityDraft
  previewUrl?: string
  portrait?: boolean
}) {
  const id = portrait ? "application-vertical-image" : "application-image"
  const brand = normalizeHex(draft.colors[1]?.value ?? "#214E3B")
  const canvas = normalizeHex(draft.colors[0]?.value ?? "#F3F0E8")

  return (
    <div
      role="group"
      aria-label={portrait ? "Vertical post composition" : "Social composition"}
      className="overflow-hidden rounded-xl border"
      {...brandIdentityOwner(
        "brand-campaign-preview",
        "BrandCampaignPreview",
        id,
        "composition"
      )}
    >
      <div
        className={cn(
          "grid",
          portrait
            ? "aspect-[4/5] grid-rows-[auto_minmax(0,1fr)]"
            : "min-h-80 md:grid-cols-2"
        )}
      >
        <div
          className={cn(
            "flex min-w-0 flex-col justify-between",
            portrait ? "gap-4 p-5" : "p-7 sm:p-10"
          )}
          style={{ backgroundColor: brand, color: foregroundFor(brand) }}
        >
          <p
            className={cn(
              "font-semibold",
              portrait ? "truncate text-xs" : "text-sm"
            )}
          >
            {draft.organizationName}
          </p>
          <div>
            <p
              className={cn(
                "leading-tight font-semibold tracking-[-0.04em]",
                portrait ? "line-clamp-2 text-2xl" : "text-3xl sm:text-4xl"
              )}
              style={{ fontFamily: brandFontStack(draft.headingFont) }}
            >
              {draft.campaignHeadline}
            </p>
            <p
              className={cn(
                "opacity-80",
                portrait
                  ? "mt-2 line-clamp-3 text-xs leading-5"
                  : "mt-4 max-w-sm text-sm leading-6"
              )}
            >
              {draft.campaignBody}
            </p>
          </div>
        </div>
        <div
          className={cn("relative min-w-0", portrait ? "min-h-0" : "min-h-72")}
          style={{ backgroundColor: canvas }}
        >
          {previewUrl ? (
            <Image
              src={previewUrl}
              alt={
                portrait
                  ? "Vertical campaign composition preview"
                  : "Campaign composition preview"
              }
              fill
              sizes="(min-width: 768px) 360px, 100vw"
              className="object-cover"
              unoptimized
            />
          ) : (
            <BrandAssetExample id={id} />
          )}
        </div>
      </div>
    </div>
  )
}
