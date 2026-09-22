"use client"

import Image from "next/image"
import artwork from "../../assets/heroes/tools-brand-identity.webp"
import { brandFontStack } from "../../lib/brand-fonts"
import { brandIdentityOwner } from "./brand-identity-owner"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

import type { BrandIdentityDraft } from "../../types"
import { BrandIdentitySection } from "./brand-identity-section"

export function FoundationSection({
  draft,
  updateDraft,
}: {
  draft: BrandIdentityDraft
  updateDraft: (value: Partial<BrandIdentityDraft>) => void
}) {
  return (
    <BrandIdentitySection
      id="foundation"
      title="Introduction"
      description="The purpose, people, and promise behind your identity."
    >
      <div
        className="relative mb-6 flex aspect-[16/9] items-center justify-center overflow-hidden rounded-lg text-center text-white"
        {...brandIdentityOwner(
          "foundation-section",
          "FoundationSection",
          "introduction",
          "preview"
        )}
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
          <Input
            id="brand-organization-name"
            value={draft.organizationName}
            onChange={(event) =>
              updateDraft({ organizationName: event.target.value })
            }
          />
        </Field>
        <Field label="Tagline" htmlFor="brand-tagline">
          <Input
            id="brand-tagline"
            value={draft.tagline}
            onChange={(event) => updateDraft({ tagline: event.target.value })}
          />
        </Field>
        <Field label="Introduction" htmlFor="brand-introduction" wide>
          <Textarea
            id="brand-introduction"
            rows={4}
            value={draft.introduction}
            onChange={(event) =>
              updateDraft({ introduction: event.target.value })
            }
          />
        </Field>
        <Field label="Purpose" htmlFor="brand-purpose">
          <Textarea
            id="brand-purpose"
            rows={4}
            value={draft.purpose}
            onChange={(event) => updateDraft({ purpose: event.target.value })}
          />
        </Field>
        <Field label="Primary audience" htmlFor="brand-audience">
          <Textarea
            id="brand-audience"
            rows={4}
            value={draft.audience}
            onChange={(event) => updateDraft({ audience: event.target.value })}
          />
        </Field>
        <fieldset
          className="min-w-0"
          {...brandIdentityOwner(
            "foundation-section",
            "FoundationSection",
            "actionables",
            "fields",
            "Three editable calls to action below Primary audience."
          )}
        >
          <legend className="text-sm font-medium">Actionables</legend>
          <div className="mt-2 grid gap-3 sm:grid-cols-3">
            {draft.actionables.map((action, index) => (
              <Input
                key={index}
                id={`brand-actionable-${index + 1}`}
                aria-label={`Actionable ${index + 1}`}
                className="shadow-none max-sm:min-h-11"
                value={action}
                placeholder="Donate, Volunteer, Join…"
                onChange={(event) => {
                  const actionables: BrandIdentityDraft["actionables"] = [
                    ...draft.actionables,
                  ]
                  actionables[index] = event.target.value
                  updateDraft({ actionables })
                }}
                {...brandIdentityOwner(
                  "foundation-section",
                  "FoundationSection",
                  `brand-actionable-${index + 1}`,
                  "field",
                  `Actionable ${index + 1}`
                )}
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
      {...brandIdentityOwner(
        "foundation-section",
        "FoundationSection",
        htmlFor,
        "field",
        label
      )}
    >
      <Label
        htmlFor={htmlFor}
        {...brandIdentityOwner(
          "foundation-section",
          "FoundationSection",
          htmlFor,
          "label",
          label
        )}
      >
        {label}
      </Label>
      <div className="mt-2">{children}</div>
    </div>
  )
}
