import { ProgramCard } from "@/components/programs/program-card"
import { OrganizationNarrativeContent } from "./organization-narrative-content"
import { cn } from "@/lib/utils"
import {
  resolveProgramBannerImageUrl,
  resolveProgramCardChips,
  resolveProgramProfileImageUrl,
  resolveProgramSummary,
} from "@/lib/programs/display"

import type { OrgProfile, OrgProgram } from "./types"
import { PUBLIC_CARD_SOCIAL_FIELDS } from "./public-card-sections-config"
import { hasPublicProfileValue } from "./public-card-section-utils"
import { locationSummary } from "./utils"
import {
  AddressDisplay,
  BrandLink,
  FieldText,
  FormRow,
  ProfileField,
} from "./shared"

export { OrgProfilePublicHeader } from "./public-card-header"
export { OrgProfilePublicPeopleSections } from "./public-card-people-sections"
export { hasPublicProfileValue } from "./public-card-section-utils"

export function OrgProfilePublicAboutSection({
  description,
  originStory,
  need,
  mission,
  vision,
  values,
  theoryOfChange,
}: {
  description: string
  originStory: string
  need: string
  mission: string
  vision: string
  values: string
  theoryOfChange: string
}) {
  return (
    <FormRow
      title="About"
      description="Story, purpose, and values"
      inset={false}
    >
      <div className="space-y-4 text-sm">
        {description.trim().length > 0 ? (
          <FieldText text={description} multiline />
        ) : null}
        {originStory.trim().length > 0 ? (
          <div className="space-y-1">
            <p className="text-muted-foreground text-xs tracking-wide uppercase">
              Origin story
            </p>
            <FieldText text={originStory} multiline />
          </div>
        ) : null}
        {need.trim().length > 0 ? (
          <div className="space-y-1">
            <p className="text-muted-foreground text-xs tracking-wide uppercase">
              Need
            </p>
            <FieldText text={need} multiline />
          </div>
        ) : null}
        {mission.trim().length > 0 ? (
          <div className="space-y-1">
            <p className="text-muted-foreground text-xs tracking-wide uppercase">
              Mission
            </p>
            <OrganizationNarrativeContent value={mission} />
          </div>
        ) : null}
        {vision.trim().length > 0 ? (
          <div className="space-y-1">
            <p className="text-muted-foreground text-xs tracking-wide uppercase">
              Vision
            </p>
            <OrganizationNarrativeContent value={vision} />
          </div>
        ) : null}
        {values.trim().length > 0 ? (
          <div className="space-y-1">
            <p className="text-muted-foreground text-xs tracking-wide uppercase">
              Values
            </p>
            <OrganizationNarrativeContent value={values} />
          </div>
        ) : null}
        {theoryOfChange.trim().length > 0 ? (
          <div className="space-y-1">
            <p className="text-muted-foreground text-xs tracking-wide uppercase">
              Theory of change
            </p>
            <FieldText text={theoryOfChange} multiline />
          </div>
        ) : null}
      </div>
    </FormRow>
  )
}

export function OrgProfilePublicDetailsSection({
  profile,
  addressLines,
}: {
  profile: OrgProfile
  addressLines: string[]
}) {
  return (
    <FormRow title="Details" description="How to connect" inset={false}>
      <div className="space-y-6">
        {addressLines.length > 0 ? (
          <div className="space-y-1">
            <p className="text-muted-foreground text-xs tracking-wide uppercase">
              Headquarters
            </p>
            <AddressDisplay lines={addressLines} />
          </div>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2">
          {hasPublicProfileValue(profile.publicUrl) ? (
            <ProfileField label="Website">
              <BrandLink href={profile.publicUrl as string} />
            </ProfileField>
          ) : null}
          {hasPublicProfileValue(profile.newsletter) ? (
            <ProfileField label="Newsletter">
              <BrandLink href={profile.newsletter as string} />
            </ProfileField>
          ) : null}
          {PUBLIC_CARD_SOCIAL_FIELDS.map(({ label, key }) =>
            hasPublicProfileValue(profile[key]) ? (
              <ProfileField key={key} label={label}>
                <BrandLink href={profile[key] as string} />
              </ProfileField>
            ) : null
          )}
        </div>
      </div>
    </FormRow>
  )
}

export function OrgProfilePublicProgramsSection({
  profileName,
  programs,
  selectedProgramId,
}: {
  profileName: string | null | undefined
  programs: OrgProgram[]
  selectedProgramId: string | null
}) {
  return (
    <section id="programs" className="scroll-mt-20 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Resource</h2>
          <p className="text-muted-foreground text-sm">
            {selectedProgramId
              ? "Focused view from map discovery"
              : "Highlights from the organization"}
          </p>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {programs.map((program) => (
          <div
            key={program.id}
            id={`program-${program.id}`}
            className={cn(
              "scroll-mt-20",
              selectedProgramId === program.id &&
                "ring-primary/35 ring-offset-background rounded-3xl ring-2 ring-offset-2"
            )}
          >
            <ProgramCard
              variant="medium"
              title={program.title ?? "Untitled resource"}
              org={profileName || undefined}
              location={locationSummary(program) || undefined}
              description={resolveProgramSummary(program) || undefined}
              bannerImageUrl={
                resolveProgramBannerImageUrl(program) || undefined
              }
              imageUrl={resolveProgramProfileImageUrl(program) || undefined}
              statusLabel={
                program.status_label ||
                (program.is_public ? undefined : "Private") ||
                undefined
              }
              chips={resolveProgramCardChips(program)}
              goalCents={program.goal_cents || 0}
              raisedCents={program.raised_cents || 0}
              ctaLabel={program.cta_label || "Learn more"}
              ctaHref={program.cta_url || undefined}
              patternId={`program-card-${program.id}`}
            />
          </div>
        ))}
      </div>
    </section>
  )
}
