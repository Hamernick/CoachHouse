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
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import styles from "../../profile-edit-fields.module.css"

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
    <FormRow title="Identity" layout="stacked" inset={false}>
      <div className={cn(styles.group, styles.readOnly)}>
        {hasDescription ? (
          <ProfileField label="Description" className={styles.stacked}>
            <FieldText text={company.description} multiline />
          </ProfileField>
        ) : null}
        {formationStatus ? (
          <ProfileField label="Formation status" className={styles.stacked}>
            <OrganizationFormationStatusSummary
              formationStatus={formationStatus}
              ein={company.ein}
              className="bg-white dark:bg-primary/5"
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
    <FormRow title="Contact" layout="stacked" inset={false}>
      <div className={cn(styles.group, styles.readOnly)}>
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
    <FormRow title="Address" layout="stacked" inset={false}>
      <div className={cn(styles.group, styles.readOnly)}>
        <div className={cn(styles.row, styles.stacked)}>
          <AddressDisplay lines={addressLines} />
        </div>
      </div>
    </FormRow>
  )
}

export function StoryPreview({ company }: CompanyViewProps) {
  const fields = [
    { key: "originStory", label: "Origin story", value: company.originStory },
    { key: "need", label: "Need", value: company.need },
    { key: "mission", label: "Mission", value: company.mission },
    { key: "vision", label: "Vision", value: company.vision },
    { key: "values", label: "Values", value: company.values },
    {
      key: "theoryOfChange",
      label: "Theory of change",
      value: company.theoryOfChange,
    },
  ].filter(
    (field): field is typeof field & { value: string } =>
      typeof field.value === "string" &&
      (stripHtml(field.value).trim().length > 0 || /<img\b/i.test(field.value))
  )

  if (fields.length === 0) return null

  return (
    <FormRow title="About us" layout="stacked" inset={false}>
      <Accordion
        type="single"
        collapsible
        className={cn(styles.group, styles.storyAccordion)}
      >
        {fields.map((field) => (
          <AccordionItem
            key={field.key}
            value={field.key}
            className="border-border/60"
          >
            <AccordionTrigger className="text-muted-foreground min-h-11 px-4 py-3 text-sm font-medium hover:no-underline">
              {field.label}
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4">
              <OrganizationNarrativeContent
                value={field.value}
                className="overflow-x-auto"
              />
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
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

  return (
    <div className={styles.sections}>
      {sections.map((section) => (
        <div key={section.id}>{section.node}</div>
      ))}
    </div>
  )
}
