"use client"

import { Separator } from "@/components/ui/separator"

import { BRAND_IDENTITY_SECTIONS } from "../../lib/brand-identity"
import type { BrandIdentityDraft, StoredBrandAsset } from "../../types"
import { DocumentationDesktopContents } from "../documentation-contents"
import { brandIdentityOwner } from "./brand-identity-owner"
import { ExportsSection } from "./exports-section"

// Exports live in this sticky sidebar, outside the scrolling article sections.
const ARTICLE_CONTENTS = BRAND_IDENTITY_SECTIONS.filter(
  ({ id }) => id !== "exports"
).map(({ id, label }) => [id, label] as const)

export function BrandIdentitySidebar({
  draft,
  assets,
  ready,
}: {
  draft: BrandIdentityDraft
  assets: StoredBrandAsset[]
  ready: boolean
}) {
  return (
    <aside
      aria-label="Brand guide navigation and exports"
      className="min-w-0 pb-8 xl:sticky xl:top-6 xl:self-start xl:pb-0 print:hidden"
      {...brandIdentityOwner(
        "brand-identity-sidebar",
        "BrandIdentitySidebar",
        "guide",
        "sidebar"
      )}
    >
      <div className="flex flex-col gap-6 xl:max-h-[calc(100svh-8rem)] xl:overflow-y-auto">
        <DocumentationDesktopContents items={ARTICLE_CONTENTS} />
        <Separator className="hidden xl:block" />
        <ExportsSection draft={draft} assets={assets} ready={ready} />
        <p className="text-muted-foreground text-xs leading-5">
          Autosaves on this device. Files never leave this browser.
        </p>
      </div>
    </aside>
  )
}
