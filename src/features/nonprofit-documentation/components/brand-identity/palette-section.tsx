"use client"

import { BrandTextField } from "./brand-text-field"
import { ColorPicker } from "@/components/ui/color-picker"
import { Label } from "@/components/ui/label"

import type { BrandIdentityColor, BrandIdentityDraft } from "../../types"
import {
  brandColorLabel,
  contrastRating,
  contrastRatio,
  foregroundFor,
  normalizeHex,
  normalizeProportions,
  rgbLabel,
} from "../../lib/brand-identity"
import {
  BrandIdentitySection,
  BrandIdentitySubsection,
} from "./brand-identity-section"

export function PaletteSection({
  draft,
  updateDraft, inlineEdit = false, disabled = false,
}: {
  inlineEdit?: boolean
  disabled?: boolean
  draft: BrandIdentityDraft
  updateDraft: (value: Partial<BrandIdentityDraft>) => void | Promise<void>
}) {
  const updateColor = (
    id: BrandIdentityColor["id"],
    value: Partial<BrandIdentityColor>
  ) => {
    return updateDraft({
      colors: draft.colors.map((color) =>
        color.id === id ? { ...color, ...value } : color
      ),
    })
  }
  const normalized = normalizeProportions(draft.colors)
  const pairs = draft.colors.flatMap((background) =>
    draft.colors
      .filter((foreground) => foreground.id !== background.id)
      .map((foreground) => ({ background, foreground }))
  )

  return (
    <BrandIdentitySection
      id="color-palette"
      eyebrow="A usable system"
      title="Color palette"
      description="Use each color for its fixed role, add your own name only if you have one, and treat HEX and RGB as the source of truth."
    >
      <div className="grid gap-3 sm:grid-cols-2">
        {draft.colors.map((color) => {
          const value = normalizeHex(color.value)
          return (
            <div
              key={color.id}
              className="overflow-hidden rounded-xl border"
              style={{ backgroundColor: value, color: foregroundFor(value) }}
            >
              <div className="flex h-40 flex-col p-4">
                <p className="text-sm font-semibold">{color.role}</p>
                <p className="mt-1 min-h-4 line-clamp-2 text-xs break-words opacity-80" title={color.name.trim() || undefined}>
                  {color.name.trim()}
                </p>
                <dl className="mt-auto grid grid-cols-[3rem_1fr] gap-y-1 font-mono text-[0.68rem] opacity-80">
                  <dt>HEX</dt>
                  <dd>{value}</dd>
                  <dt>RGB</dt>
                  <dd>{rgbLabel(value)}</dd>
                </dl>
              </div>
              <div className="bg-background text-foreground grid grid-cols-[minmax(0,1fr)_9.5rem] gap-3 border-t p-3">
                <div>
                  <Label
                    htmlFor={`color-name-${color.id}`}
                    className="text-muted-foreground text-xs"
                  >
                    Custom name (optional)
                  </Label>
                  <BrandTextField
                    id={`color-name-${color.id}`}
                    inlineEdit={inlineEdit} disabled={disabled} maxLength={120}
                    label={`${color.role} custom color name`}
                    value={color.name}
                    placeholder="Add your own name…"
                    className="mt-1"
                    onSave={(name) =>
                      updateColor(color.id, { name })
                    }

                  />
                </div>
                <div>
                  <Label
                    htmlFor={`color-value-${color.id}`}
                    className="text-muted-foreground text-xs"
                  >
                    HEX
                  </Label>
                  <div className="mt-1 flex items-start gap-1">
                  <div className="min-w-0 flex-1">
                  <BrandTextField
                    id={`color-value-${color.id}`}
                    inlineEdit={inlineEdit} disabled={disabled} maxLength={7}
                    label={`${color.role} hex value`}
                    onBlur={() => { void updateColor(color.id, { value: normalizeHex(color.value) }) }}
                    value={color.value}
                    onSave={(next) => {
                      if (inlineEdit && !/^#[0-9a-f]{6}$/i.test(next)) throw new Error("Use a six-digit HEX color, such as #214E3B.")
                      return updateColor(color.id, { value: inlineEdit ? normalizeHex(next) : next })
                    }}
                  />
                  </div>
                  <ColorPicker value={value} label={color.role} disabled={disabled} onSelect={(value) => updateColor(color.id, { value })} />
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <BrandIdentitySubsection
        title="Color proportions"
        description="The percentages automatically normalize to a complete system. Let the lightest surface create breathing room and reserve the strongest colors for emphasis."
      >
        <div className="flex min-h-32 overflow-hidden rounded-xl border">
          {normalized.map((color) => (
            <div
              key={color.id}
              className="flex min-w-12 flex-col justify-between p-3"
              style={{
                width: `${color.proportion}%`,
                backgroundColor: normalizeHex(color.value),
                color: foregroundFor(color.value),
              }}
            >
              <span className="truncate text-xs font-semibold">
                {brandColorLabel(color)}
              </span>
              <span className="text-xl font-semibold">
                {Math.round(color.proportion)}%
              </span>
            </div>
          ))}
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-4">
          {draft.colors.map((color) => (
            <div key={color.id}>
              <Label htmlFor={`color-proportion-${color.id}`}>
                {brandColorLabel(color)}
              </Label>
              <BrandTextField
                id={`color-proportion-${color.id}`}
                inlineEdit={inlineEdit} disabled={disabled}
                label={`${brandColorLabel(color)} proportion`}
                value={String(color.proportion)}
                type="number" min={0} max={100}
                className="mt-2"
                onSave={(value) => {
                  const proportion = Number(value)
                  if (inlineEdit && (!value.trim() || !Number.isFinite(proportion) || proportion < 0 || proportion > 100)) throw new Error("Enter a percentage from 0 to 100.")
                  return updateColor(color.id, { proportion: Math.max(0, proportion) })
                }}
              />
            </div>
          ))}
        </div>
      </BrandIdentitySubsection>

      <BrandIdentitySubsection
        title="Accessibility"
        description="Normal body text needs at least 4.5:1 contrast. Large text may use 3:1, but higher contrast is easier to read across more settings."
      >
        <div className="divide-y border-y">
          {pairs.map(({ foreground, background }) => {
            const ratio = contrastRatio(foreground.value, background.value)
            const rating = contrastRating(ratio)
            return (
              <div
                key={`${foreground.id}-${background.id}`}
                className="grid grid-cols-[2rem_minmax(0,1fr)_4rem_3.5rem] items-center gap-3 py-3 text-xs"
              >
                <span
                  className="flex size-8 items-center justify-center rounded border font-semibold"
                  style={{
                    color: normalizeHex(foreground.value),
                    backgroundColor: normalizeHex(background.value),
                  }}
                  aria-hidden
                >
                  Aa
                </span>
                <span className="truncate">
                  {brandColorLabel(foreground)} on {brandColorLabel(background)}
                </span>
                <span className="text-muted-foreground text-right font-mono">
                  {ratio.toFixed(1)}:1
                </span>
                <span
                  className={
                    rating === "Fail"
                      ? "text-destructive text-right"
                      : "text-right font-semibold"
                  }
                >
                  {rating}
                </span>
              </div>
            )
          })}
        </div>
      </BrandIdentitySubsection>
    </BrandIdentitySection>
  )
}
