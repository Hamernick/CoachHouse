"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

import type {
  BrandAssetId,
  BrandIdentityDraft,
  StoredBrandAsset,
} from "../../types"
import { BrandCampaignPreview } from "./brand-campaign-preview"
import { BrandAssetField } from "./brand-asset-field"
import {
  BrandIdentitySection,
  BrandIdentitySubsection,
} from "./brand-identity-section"

const ILLUSTRATION_IDS = [1, 2, 3, 4, 5, 6].map(
  (index) => `illustration-${index}` as BrandAssetId
)

export function ApplicationsSection({
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
  const application = assets.find((asset) => asset.id === "application-image")

  return (
    <BrandIdentitySection
      id="applications"
      eyebrow="Put the system to work"
      title="Applications"
      description="Bring your palette, type, and imagery together."
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <Label htmlFor="campaign-headline">Campaign headline</Label>
          <Input
            id="campaign-headline"
            className="mt-2"
            value={draft.campaignHeadline}
            onChange={(event) =>
              updateDraft({ campaignHeadline: event.target.value })
            }
          />
        </div>
        <div>
          <Label htmlFor="campaign-body">Supporting message</Label>
          <Textarea
            id="campaign-body"
            className="mt-2"
            rows={3}
            value={draft.campaignBody}
            onChange={(event) =>
              updateDraft({ campaignBody: event.target.value })
            }
          />
        </div>
      </div>

      <BrandIdentitySubsection title="Campaign image">
        <BrandAssetField
          id="application-image"
          label="Application image"
          guidance="Choose an image with one clear subject and enough quiet space for text."
          asset={application}
          previewUrl={assetUrls["application-image"]}
          onUpload={uploadAsset}
          onDelete={deleteAsset}
          disabled={disabled}
        />
      </BrandIdentitySubsection>

      <BrandIdentitySubsection
        title="Social composition"
        description="Use this as a starting point, then adapt the crop and copy for each channel rather than stretching one file everywhere."
      >
        <BrandCampaignPreview
          draft={draft}
          previewUrl={assetUrls["application-image"]}
        />
      </BrandIdentitySubsection>

      <BrandIdentitySubsection
        title="Vertical posts"
        description="A separate 4:5 image and composition using your campaign copy."
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <BrandAssetField
            id="application-vertical-image"
            label="Vertical post image"
            guidance="Upload a portrait image. This image is saved separately from the landscape image."
            asset={assets.find(
              (asset) => asset.id === "application-vertical-image"
            )}
            previewUrl={assetUrls["application-vertical-image"]}
            onUpload={uploadAsset}
            onDelete={deleteAsset}
            disabled={disabled}
            aspect="portrait"
          />
          <figure className="min-w-0">
            <BrandCampaignPreview
              draft={draft}
              previewUrl={assetUrls["application-vertical-image"]}
              portrait
            />
            <figcaption className="mt-2 text-sm font-medium">
              Vertical composition
            </figcaption>
          </figure>
        </div>
      </BrandIdentitySubsection>

      <BrandIdentitySubsection
        title="Illustrations"
        description="Keep a small, coherent set. Use one drawing style, consistent line weight, and the same approved foreground/background pairings."
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {ILLUSTRATION_IDS.map((id, index) => (
            <BrandAssetField
              key={id}
              id={id}
              label={`Illustration ${String(index + 1).padStart(2, "0")}`}
              guidance="Optional supporting artwork"
              asset={assets.find((asset) => asset.id === id)}
              previewUrl={assetUrls[id]}
              onUpload={uploadAsset}
              onDelete={deleteAsset}
              disabled={disabled}
              aspect="square"
            />
          ))}
        </div>
      </BrandIdentitySubsection>
    </BrandIdentitySection>
  )
}
