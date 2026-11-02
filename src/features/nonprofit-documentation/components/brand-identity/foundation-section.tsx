"use client"

import Image from "next/image"
import artwork from "../../assets/heroes/tools-brand-identity.webp"
import { brandFontStack } from "../../lib/brand-fonts"

import { BrandTextField } from "./brand-text-field"
import { Label } from "@/components/ui/label"

import type { BrandIdentityDraft } from "../../types"
import { BrandIdentitySection } from "./brand-identity-section"

export function FoundationSection({
  draft,
  updateDraft,
  inlineEdit = false, disabled = false,
  audienceMaxLength,
  taglineMaxLength,
}: {
  inlineEdit?: boolean
  disabled?: boolean
  audienceMaxLength?: number
  taglineMaxLength?: number
  draft: BrandIdentityDraft
  updateDraft: (value: Partial<BrandIdentityDraft>) => void | Promise<void>
}) {
  return (
    <BrandIdentitySection
      id="foundation"
      title="Introduction"
      description="The purpose, people, and promise behind your identity."
    >
      <div
        className="relative mb-6 flex aspect-[16/9] items-center justify-center overflow-hidden rounded-lg text-center text-white"

      >
        <Image
          src={artwork}
          alt=""
          preload
          fill
          sizes="720px"
          className="object-cover"
        />
        <span className="bg-background/90 text-foreground absolute top-3 left-3 rounded px-2 py-1 text-[10px]">
          Example artwork
        </span>
        <div className="relative px-6">
          <h3
            className="text-3xl font-semibold tracking-tight sm:text-4xl"
            style={{ fontFamily: brandFontStack(draft.headingFont) }}
          >
            {draft.organizationName || "Your nonprofit"}
          </h3>
          <p className="mt-3 text-sm sm:text-base">{draft.tagline}</p>
        </div>
      </div>
      <div className="grid gap-5">
        <Field label="Organization name" htmlFor="brand-organization-name">
          <BrandTextField
            id="brand-organization-name"
            maxLength={120}
            value={draft.organizationName}
            label="Organization name" inlineEdit={inlineEdit} disabled={disabled}
            onSave={(value) => updateDraft({ organizationName: value })}
          />
        </Field>
        <Field label="Tagline" htmlFor="brand-tagline">
          <BrandTextField
            id="brand-tagline"
            maxLength={taglineMaxLength}
            value={draft.tagline}
            label="Tagline" inlineEdit={inlineEdit} disabled={disabled}
            onSave={(value) => updateDraft({ tagline: value })}
          />
        </Field>
        <Field label="Introduction" htmlFor="brand-introduction" wide>
          <BrandTextField
            id="brand-introduction"
            rows={4}
            value={draft.introduction}
            label="Introduction" inlineEdit={inlineEdit} disabled={disabled} multiline maxLength={5000}
            onSave={(value) => updateDraft({ introduction: value })}
          />
        </Field>
        <Field label="Purpose" htmlFor="brand-purpose">
          <BrandTextField
            id="brand-purpose"
            rows={4}
            value={draft.purpose}
            label="Purpose" inlineEdit={inlineEdit} disabled={disabled} multiline maxLength={5000}
            onSave={(value) => updateDraft({ purpose: value })}
          />
        </Field>
        <Field label="Primary audience" htmlFor="brand-audience">
          <BrandTextField
            id="brand-audience"
            maxLength={audienceMaxLength}
            rows={4}
            value={draft.audience}
            label="Primary audience" inlineEdit={inlineEdit} disabled={disabled} multiline
            onSave={(value) => updateDraft({ audience: value })}
          />
        </Field>
        <fieldset
          className="min-w-0"

        >
          <legend className="text-sm font-medium">Actionables</legend>
          <div className="mt-2 grid gap-3 sm:grid-cols-3">
            {draft.actionables.map((action, index) => (
              <BrandTextField
                inlineEdit={inlineEdit} disabled={disabled} maxLength={120}
                label={`Actionable ${index + 1}`}
                key={index}
                id={`brand-actionable-${index + 1}`}
                className="shadow-none max-sm:min-h-11"
                value={action}
                placeholder="Donate, Volunteer, Join…"
                onSave={(value) => {
                  const actionables: BrandIdentityDraft["actionables"] = [
                    ...draft.actionables,
                  ]
                  actionables[index] = value
                  return updateDraft({ actionables })
                }}

              />
            ))}
          </div>
        </fieldset>
      </div>
    </BrandIdentitySection>
  )
}

function Field({
  label,
  htmlFor,
  children,
  wide = false,
}: {
  label: string
  htmlFor: string
  children: React.ReactNode
  wide?: boolean
}) {
  return (
    <div
      className={wide ? "min-w-0" : undefined}

    >
      <Label
        htmlFor={htmlFor}

      >
        {label}
      </Label>
      <div className="mt-2">{children}</div>
    </div>
  )
}
