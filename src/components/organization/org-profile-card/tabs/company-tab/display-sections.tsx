"use client"

import {
  AddressDisplay,
  BrandLink,
  FieldText,
  FormRow,
  LinkText,
  ProfileField,
} from "@/components/organization/org-profile-card/shared"
import { ProfileFieldTabs } from "../../profile-field-tabs"
import { OrganizationNarrativeContent } from "@/components/organization/org-profile-card/organization-narrative-content"
import type { CompanyViewProps } from "./types"
import { cn } from "@/lib/utils"
import {
  hasWorkspaceBrandKitProfileContent,
  WorkspaceBrandKitProfilePreview,
} from "@/features/workspace-brand-kit"

const FORMATION_STATUS_LABELS: Record<string, string> = {
  pre_501c3: "Pre-501(c)(3)",
  in_progress: "In progress",
  approved: "Approved",
}

export function IdentityPreview({ company }: CompanyViewProps) {
  const formationLabel =
    typeof company.formationStatus === "string"
      ? FORMATION_STATUS_LABELS[company.formationStatus]
      : ""
  const hasDescription =
    typeof company.description === "string" &&
    company.description.trim().length > 0
  const hasEin =
    typeof company.ein === "string" && company.ein.trim().length > 0
  const showFormation =
    Boolean(formationLabel) &&
    (hasDescription ||
      hasEin ||
      company.formationStatus === "approved" ||
      company.formationStatus === "pre_501c3")

  if (!(hasDescription || hasEin || showFormation)) {
    return null
  }

  return (
    <FormRow title="Identity">
      <div className="grid gap-4 md:grid-cols-2 md:items-start">
        {hasDescription ? (
          <ProfileField label="Description">
            <FieldText text={company.description} multiline />
          </ProfileField>
        ) : null}
        {hasEin ? (
          <ProfileField label="EIN">
            <FieldText text={company.ein} />
          </ProfileField>
        ) : null}
        {showFormation ? (
          <ProfileField label="Formation status">
            <FieldText text={formationLabel} />
          </ProfileField>
        ) : null}
      </div>
    </FormRow>
  )
}

export function ContactPreview({ company }: CompanyViewProps) {
  if (
    ![company.rep, company.email, company.phone].some(
      (value) => typeof value === "string" && value.trim()
    )
  ) {
    return null
  }

  return (
    <FormRow title="Contact">
      <div className="grid gap-4 md:grid-cols-2 md:items-start">
        {typeof company.rep === "string" && company.rep.trim() ? (
          <ProfileField label="Representative">
            <FieldText text={company.rep} />
          </ProfileField>
        ) : null}
        {typeof company.email === "string" && company.email.trim() ? (
          <ProfileField label="Email">
            <LinkText text={company.email} />
          </ProfileField>
        ) : null}
        {typeof company.phone === "string" && company.phone.trim() ? (
          <ProfileField label="Phone">
            <FieldText text={company.phone} />
          </ProfileField>
        ) : null}
      </div>
    </FormRow>
  )
}

export function AddressPreview({ addressLines }: CompanyViewProps) {
  if (addressLines.length === 0) {
    return null
  }

  return (
    <FormRow title="Address">
      <AddressDisplay lines={addressLines} />
    </FormRow>
  )
}

const socialFields: Array<{
  key: keyof CompanyViewProps["company"]
  label: string
}> = [
  { key: "twitter", label: "Twitter / X" },
  { key: "facebook", label: "Facebook" },
  { key: "linkedin", label: "LinkedIn" },
  { key: "instagram", label: "Instagram" },
  { key: "youtube", label: "YouTube" },
  { key: "tiktok", label: "TikTok" },
  { key: "github", label: "GitHub" },
]

export function StoryPreview({ company }: CompanyViewProps) {
  const originStory =
    typeof company.originStory === "string" ? company.originStory : ""
  const vision = typeof company.vision === "string" ? company.vision : ""
  const need = typeof company.need === "string" ? company.need : ""
  const mission = typeof company.mission === "string" ? company.mission : ""
  const values = typeof company.values === "string" ? company.values : ""
  const theoryOfChange =
    typeof company.theoryOfChange === "string" ? company.theoryOfChange : ""

  if (
    ![originStory, vision, need, mission, values, theoryOfChange].some(
      (value) => value.trim().length > 0
    )
  ) {
    return null
  }

  return (
    <FormRow title="About us">
      <ProfileFieldTabs group="story" label="About us fields">
        {originStory.trim().length > 0 ? (
          <ProfileField label="Origin story" focusKey="originStory">
            <OrganizationNarrativeContent value={originStory} />
          </ProfileField>
        ) : null}
        {need.trim().length > 0 ? (
          <ProfileField label="Need" focusKey="need">
            <OrganizationNarrativeContent value={need} />
          </ProfileField>
        ) : null}
        {mission.trim().length > 0 ? (
          <ProfileField label="Mission" focusKey="mission">
            <OrganizationNarrativeContent value={mission} />
          </ProfileField>
        ) : null}
        {vision.trim().length > 0 ? (
          <ProfileField label="Vision" focusKey="vision">
            <OrganizationNarrativeContent value={vision} />
          </ProfileField>
        ) : null}
        {values.trim().length > 0 ? (
          <ProfileField label="Values" focusKey="values">
            <OrganizationNarrativeContent value={values} />
          </ProfileField>
        ) : null}
        {theoryOfChange.trim().length > 0 ? (
          <ProfileField label="Theory of change" focusKey="theoryOfChange">
            <OrganizationNarrativeContent value={theoryOfChange} />
          </ProfileField>
        ) : null}
      </ProfileFieldTabs>
    </FormRow>
  )
}

export function WebsitePreview({ company }: CompanyViewProps) {
  if (!(typeof company.publicUrl === "string" && company.publicUrl.trim())) {
    return null
  }
  return (
    <FormRow title="Website">
      <BrandLink href={company.publicUrl} />
    </FormRow>
  )
}

export function NewsletterPreview({ company }: CompanyViewProps) {
  if (!(typeof company.newsletter === "string" && company.newsletter.trim())) {
    return null
  }
  return (
    <FormRow title="Newsletter">
      <BrandLink href={company.newsletter} />
    </FormRow>
  )
}

export function DonationPreview({ company }: CompanyViewProps) {
  if (!(typeof company.donateUrl === "string" && company.donateUrl.trim())) {
    return null
  }
  return (
    <FormRow title="Donation page">
      <BrandLink href={company.donateUrl} />
    </FormRow>
  )
}

export function SocialPreview({ company, hasAnyBrandLink }: CompanyViewProps) {
  if (!hasAnyBrandLink) {
    return null
  }

  return (
    <FormRow title="Social">
      <div className="grid gap-4 md:grid-cols-2 md:items-start">
        {socialFields.map(({ key, label }) => {
          const value = company[key]
          if (typeof value === "string" && value.trim()) {
            return (
              <ProfileField key={String(key)} label={label}>
                <BrandLink href={value} />
              </ProfileField>
            )
          }
          return null
        })}
      </div>
    </FormRow>
  )
}

export function BrandKitPreview({ company }: CompanyViewProps) {
  if (!hasWorkspaceBrandKitProfileContent(company)) {
    return null
  }

  return (
    <FormRow title="Brand Kit">
      <WorkspaceBrandKitProfilePreview profile={company} />
    </FormRow>
  )
}

export function ViewModeSections(props: CompanyViewProps) {
  const sections = [
    { id: "identity", node: IdentityPreview(props) },
    { id: "contact", node: ContactPreview(props) },
    { id: "address", node: AddressPreview(props) },
    { id: "story", node: StoryPreview(props) },
    { id: "website", node: WebsitePreview(props) },
    { id: "newsletter", node: NewsletterPreview(props) },
    { id: "donation", node: DonationPreview(props) },
    { id: "social", node: SocialPreview(props) },
    { id: "brand-kit", node: BrandKitPreview(props) },
  ].filter((section) => Boolean(section.node))

  if (sections.length === 0) {
    return (
      <div className="mx-auto flex min-h-[220px] w-full max-w-3xl items-center justify-center">
        <div className="border-border/60 bg-muted/20 text-muted-foreground w-full rounded-xl border border-dashed px-6 py-8 text-center text-sm">
          No organization details yet. Add company information to populate this
          section.
        </div>
      </div>
    )
  }

  const hasIdentity = sections.some((section) => section.id === "identity")

  return (
    <div
      className={cn(
        "mx-auto w-full max-w-4xl",
        hasIdentity ? "divide-border/60 divide-y" : "space-y-6"
      )}
    >
      {sections.map((section, index) => (
        <div
          key={section.id}
          className={cn(
            "py-6",
            index === 0 && "pt-0",
            index === sections.length - 1 && "pb-0"
          )}
        >
          {section.node}
        </div>
      ))}
    </div>
  )
}
