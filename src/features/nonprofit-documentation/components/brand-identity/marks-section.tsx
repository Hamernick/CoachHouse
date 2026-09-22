"use client"
import Image from "next/image"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import type {
  BrandAssetId,
  BrandIdentityDraft,
  StoredBrandAsset,
} from "../../types"
import { foregroundFor, normalizeHex } from "../../lib/brand-identity"
import { BrandAssetField } from "./brand-asset-field"
import { BrandExampleMark } from "./brand-asset-example"
import {
  BrandIdentitySection,
  BrandIdentitySubsection,
} from "./brand-identity-section"
import { brandIdentityOwner } from "./brand-identity-owner"
export function MarksSection({
  draft,
  assets,
  assetUrls,
  updateDraft,
  uploadAsset,
  deleteAsset,
  disabled = false,
}: {
  draft: BrandIdentityDraft
  assets: StoredBrandAsset[]
  assetUrls: Partial<Record<BrandAssetId, string>>
  updateDraft: (value: Partial<BrandIdentityDraft>) => void
  uploadAsset: (id: BrandAssetId, file: File) => Promise<boolean>
  deleteAsset: (id: BrandAssetId) => Promise<void>
  disabled?: boolean
}) {
  const logo = assets.find((asset) => asset.id === "primary-logo")
  const mark = assets.find((asset) => asset.id === "brand-mark")
  const src = assetUrls["primary-logo"]
  const canvas = normalizeHex(draft.colors[0]?.value ?? "#F3F0E8")
  const brand = normalizeHex(draft.colors[1]?.value ?? "#214E3B")
  return (
    <BrandIdentitySection
      id="marks"
      title="Primary lockup"
      description="Your full logo, with room to breathe. Replace the example with your own artwork."
    >
      <BrandAssetField
        id="primary-logo"
        label="Primary logo"
        guidance="PNG, JPG, WebP, or SVG. One image per tile, up to 12 MB."
        asset={logo}
        previewUrl={src}
        onUpload={uploadAsset}
        onDelete={deleteAsset}
        disabled={disabled}
      />
      <BrandIdentitySubsection
        title="Logo scale"
        description="Check readability at different sizes. Example artwork is shown until you upload a logo."
      >
        <div className="bg-muted/20 divide-y overflow-hidden rounded-lg border">
          {[100, 84, 68, 52, 36, 22].map((size) => (
            <div
              key={size}
              className="grid grid-cols-[3rem_minmax(0,1fr)] items-center gap-3 px-4 py-5"
            >
              <span className="text-muted-foreground text-[11px] tabular-nums">
                {size}px
              </span>
              <div
                className="relative flex max-w-full items-center"
                style={{ height: size, width: size * 3.5 }}
              >
                {src ? (
                  <Image
                    src={src}
                    alt={`Logo at ${size}px`}
                    fill
                    sizes={`${size * 4}px`}
                    className="object-contain object-left"
                    unoptimized
                  />
                ) : (
                  <span className="max-w-full" style={{ fontSize: size * 0.4 }}>
                    <BrandExampleMark />
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </BrandIdentitySubsection>
      <BrandIdentitySubsection
        title="Color versions"
        description="Check the original artwork on light and dark surfaces. Uploaded colors stay unchanged."
      >
        <div className="grid grid-cols-2 gap-3">
          {[canvas, brand].map((background, index) => (
            <figure key={index}>
              <div
                className="relative flex aspect-square items-center justify-center overflow-hidden rounded-lg border p-4"
                style={{
                  backgroundColor: background,
                  color: foregroundFor(background),
                }}
              >
                {src ? (
                  <Image
                    src={src}
                    alt={`Logo on ${index ? "primary" : "background"} color`}
                    fill
                    sizes="340px"
                    className="object-contain p-[15%]"
                    unoptimized
                  />
                ) : (
                  <span className="text-[clamp(1rem,2.5vw,2rem)]">
                    <BrandExampleMark />
                  </span>
                )}
              </div>
              <figcaption className="text-muted-foreground mt-2 text-xs">
                {index ? "Primary surface" : "Light surface"}
                {!src ? " · Example" : ""}
              </figcaption>
            </figure>
          ))}
        </div>
      </BrandIdentitySubsection>
      <BrandIdentitySubsection title="Compact mark">
        <div className="grid gap-6 sm:grid-cols-2">
          <BrandAssetField
            id="brand-mark"
            label="Brand mark"
            guidance="A compact symbol for small spaces."
            asset={mark}
            previewUrl={assetUrls["brand-mark"]}
            onUpload={uploadAsset}
            onDelete={deleteAsset}
            aspect="square"
            disabled={disabled}
          />
          <div
            {...brandIdentityOwner(
              "marks-section",
              "MarksSection",
              "logo-guidance",
              "field"
            )}
          >
            <Label
              htmlFor="logo-guidance"
              {...brandIdentityOwner(
                "marks-section",
                "MarksSection",
                "logo-guidance",
                "label"
              )}
            >
              Usage guidance
            </Label>
            <Textarea
              id="logo-guidance"
              rows={6}
              className="mt-3"
              value={draft.logoGuidance}
              onChange={(event) =>
                updateDraft({ logoGuidance: event.target.value })
              }
            />
          </div>
        </div>
      </BrandIdentitySubsection>
    </BrandIdentitySection>
  )
}
