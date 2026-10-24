"use client"

import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"

import type { BrandIdentityDraft } from "../../types"
import { BRAND_FONT_GROUPS, BRAND_FONT_OPTIONS, brandFontStack } from "../../lib/brand-fonts"
import { typeScale } from "../../lib/brand-identity"
import { BrandIdentitySection } from "./brand-identity-section"

const TYPE_EXAMPLES = [
  {
    id: "display",
    label: "Display",
    text: "Build trust through clear action.",
  },
  {
    id: "h1",
    label: "Heading 1",
    text: "A nonprofit identity people can recognize",
  },
  {
    id: "h2",
    label: "Heading 2",
    text: "Show what changes because of your work",
  },
  {
    id: "h3",
    label: "Heading 3",
    text: "Make every message easier to understand",
  },
  {
    id: "body",
    label: "Body",
    text: "Use plain, specific language that respects the people you serve and gives every reader a clear next step.",
  },
  {
    id: "caption",
    label: "Caption",
    text: "Community report · Updated September 2026",
  },
] as const

export function TypographySection({
  draft,
  updateDraft,
  disabled = false,
}: {
  disabled?: boolean
  draft: BrandIdentityDraft
  updateDraft: (value: Partial<BrandIdentityDraft>) => void
}) {
  const scale = typeScale(draft.baseSize, draft.typeRatio)

  return (
    <BrandIdentitySection
      id="typography"
      eyebrow="Readable by default"
      title="Typography"
      description="Choose widely available typefaces, then use one predictable scale so documents, campaigns, and digital products share the same hierarchy."
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <Label htmlFor="heading-font">Heading font</Label>
          <Select
            disabled={disabled}
            value={draft.headingFont}
            onValueChange={(headingFont) => updateDraft({ headingFont })}
          >
            <SelectTrigger id="heading-font" className="mt-2 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {!BRAND_FONT_OPTIONS.some(font => font.value === draft.headingFont) ? (
                <SelectItem value={draft.headingFont}>{draft.headingFont}</SelectItem>
              ) : null}
              {BRAND_FONT_GROUPS.map((group) => (
                <SelectGroup key={group.label}>
                  <SelectLabel>{group.label}</SelectLabel>
                  {group.options.map((font) => (
                    <SelectItem
                      key={font.value}
                      value={font.value}
                      style={{ fontFamily: font.stack }}
                    >
                      {font.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="body-font">Body font</Label>
          <Select
            disabled={disabled}
            value={draft.bodyFont}
            onValueChange={(bodyFont) => updateDraft({ bodyFont })}
          >
            <SelectTrigger id="body-font" className="mt-2 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {!BRAND_FONT_OPTIONS.some(font => font.value === draft.bodyFont) ? (
                <SelectItem value={draft.bodyFont}>{draft.bodyFont}</SelectItem>
              ) : null}
              {BRAND_FONT_GROUPS.map((group) => (
                <SelectGroup key={group.label}>
                  <SelectLabel>{group.label}</SelectLabel>
                  {group.options.map((font) => (
                    <SelectItem
                      key={font.value}
                      value={font.value}
                      style={{ fontFamily: font.stack }}
                    >
                      {font.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="mt-10 border-y py-10">
        <p className="text-sm font-semibold">Type system</p>
        <p
          className="mt-6 text-3xl leading-tight font-semibold tracking-[-0.04em] sm:text-5xl"
          style={{ fontFamily: brandFontStack(draft.headingFont) }}
        >
          {draft.organizationName}: {draft.tagline}
        </p>
        <p
          className="text-muted-foreground mt-5 max-w-2xl text-base leading-7"
          style={{ fontFamily: brandFontStack(draft.bodyFont) }}
        >
          {draft.introduction}
        </p>
      </div>

      <div className="mt-12">
        <h3 className="text-base font-semibold">Type scale</h3>
        <div className="mt-6 grid gap-6 rounded-xl border p-5">
          <div className="grid gap-3 sm:grid-cols-[5rem_1fr_4rem] sm:items-center">
            <Label htmlFor="base-size">Base size</Label>
            <Slider
              disabled={disabled}
              id="base-size"
              min={14}
              max={20}
              step={1}
              value={[draft.baseSize]}
              onValueChange={([baseSize]) => updateDraft({ baseSize })}
            />
            <span className="text-right font-mono text-xs">
              {draft.baseSize}px
            </span>
          </div>
          <div className="grid gap-3 sm:grid-cols-[5rem_1fr_4rem] sm:items-center">
            <Label htmlFor="type-ratio">Ratio</Label>
            <Slider
              disabled={disabled}
              id="type-ratio"
              min={1.125}
              max={1.5}
              step={0.025}
              value={[draft.typeRatio]}
              onValueChange={([typeRatio]) =>
                updateDraft({ typeRatio: Number(typeRatio.toFixed(3)) })
              }
            />
            <span className="text-right font-mono text-xs">
              {draft.typeRatio}
            </span>
          </div>
        </div>
        <div className="mt-8 divide-y border-y">
          {TYPE_EXAMPLES.map((example) => {
            const size = scale[example.id]
            const heading = !["body", "caption"].includes(example.id)
            return (
              <div key={example.id} className="py-6">
                <div className="text-muted-foreground mb-3 flex justify-between gap-4 font-mono text-[0.68rem]">
                  <span>{example.label}</span>
                  <span>{size.toFixed(1)}px</span>
                </div>
                <p
                  className="max-w-full leading-tight"
                  style={{
                    fontFamily: brandFontStack(
                      heading ? draft.headingFont : draft.bodyFont
                    ),
                    fontSize: `${size}px`,
                    fontWeight: heading ? 600 : 400,
                  }}
                >
                  {example.text}
                </p>
              </div>
            )
          })}
        </div>
      </div>
    </BrandIdentitySection>
  )
}
