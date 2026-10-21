"use client"

import {
  AddressDisplay,
  FieldText,
  FormRow,
  LinkText,
  ProfileField,
} from "@/components/organization/org-profile-card/shared"
import { OrganizationNarrativeContent } from "@/components/organization/org-profile-card/organization-narrative-content"
import type { CompanyViewProps } from "./types"
import { stripHtml } from "@/lib/markdown/convert"
import { cn } from "@/lib/utils"

import { OrganizationFormationStatusSummary } from "@/components/organization/organization-formation-status-summary"
import { resolveFormationStatusOption } from "@/lib/organization/formation-status"

export function IdentityPreview({ company }: CompanyViewProps) {
  const formationStatus = resolveFormationStatusOption(company.formationStatus)
  const hasDescription =
    typeof company.description === "string" &&
    company.description.trim().length > 0
  if (!(hasDescription || formationStatus)) {
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
        {formationStatus ? (
          <ProfileField label="Formation status">
            <OrganizationFormationStatusSummary
              formationStatus={formationStatus}
              ein={company.ein}
            />
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

export function StoryPreview({ company }: CompanyViewProps) {
  const originStory =
    typeof company.originStory === "string"
      ? stripHtml(company.originStory)
      : ""
  const vision = typeof company.vision === "string" ? company.vision : ""
  const need = typeof company.need === "string" ? stripHtml(company.need) : ""
  const mission = typeof company.mission === "string" ? company.mission : ""
  const values = typeof company.values === "string" ? company.values : ""
  const theoryOfChange =
    typeof company.theoryOfChange === "string"
      ? stripHtml(company.theoryOfChange)
      : ""

  if (
    ![originStory, vision, need, mission, values, theoryOfChange].some(
      (value) => value.trim().length > 0
    )
  ) {
    return null
  }

  return (
    <FormRow title="About us">
      <div className="grid gap-4 md:grid-cols-2 md:items-start">
        {originStory.trim().length > 0 ? (
          <ProfileField label="Origin story">
            <FieldText text={originStory} multiline />
          </ProfileField>
        ) : null}
        {need.trim().length > 0 ? (
          <ProfileField label="Need">
            <FieldText text={need} multiline />
          </ProfileField>
        ) : null}
        {mission.trim().length > 0 ? (
          <ProfileField label="Mission">
            <OrganizationNarrativeContent value={mission} />
          </ProfileField>
        ) : null}
        {vision.trim().length > 0 ? (
          <ProfileField label="Vision">
            <OrganizationNarrativeContent value={vision} />
          </ProfileField>
        ) : null}
        {values.trim().length > 0 ? (
          <ProfileField label="Values">
            <OrganizationNarrativeContent value={values} />
          </ProfileField>
        ) : null}
        {theoryOfChange.trim().length > 0 ? (
          <ProfileField label="Theory of change">
            <FieldText text={theoryOfChange} multiline />
          </ProfileField>
        ) : null}
      </div>
    </FormRow>
  )
}

export function ViewModeSections(props: CompanyViewProps) {
  const sections = [
    { id: "identity", node: IdentityPreview(props) },
    { id: "contact", node: ContactPreview(props) },
    { id: "address", node: AddressPreview(props) },
    { id: "story", node: StoryPreview(props) },
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
