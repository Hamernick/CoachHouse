"use client"

import styles from "../../../profile-edit-fields.module.css"

import { Switch } from "@/components/ui/switch"
import { resolveCoreDocumentPublication } from "@/lib/roadmap/core-document-publication"
import { RichTextEditor } from "@/components/rich-text-editor"

import {
  FormRow,
  ProfileField,
} from "@/components/organization/org-profile-card/shared"
import type { CompanyEditProps } from "../types"

const STORY_FIELDS = [
  {
    name: "originStory",
    label: "Origin story",
    placeholder:
      "We started after seeing students and families navigate fragmented support alone.",
  },
  {
    name: "need",
    label: "Need Statement",
    placeholder:
      "Students in our district lack access to labs, internships, and career exposure.",
  },
] as const

const THEORY_FIELD = {
  name: "theoryOfChange",
  label: "Theory of change",
  placeholder:
    "When students, mentors, and core supports are connected early, confidence and long-term opportunity grow.",
} as const

const NARRATIVE_FIELDS = [
  {
    name: "mission",
    label: "Mission",
    placeholder:
      "We equip middle school students with hands-on programs and mentors in technology careers.",
  },
  {
    name: "vision",
    label: "Vision",
    placeholder:
      "A city where every student has access to high-quality STEM learning.",
  },
  {
    name: "values",
    label: "Values",
    placeholder: "Equity, curiosity, community",
  },
] as const

function StoryCoreDocumentField({
  company,
  errors,
  field,
  onUpdate,
  onDirty,
}: Pick<CompanyEditProps, "company" | "errors" | "onUpdate" | "onDirty"> & {
  field: (typeof STORY_FIELDS)[number] | typeof THEORY_FIELD | (typeof NARRATIVE_FIELDS)[number]
}) {
  const value = company[field.name] ?? ""
  const error = errors[field.name] ?? ""

  return (
    <div className={styles.group}>
      <ProfileField
        label={field.label}
        focusKey={field.name}
        labelAction={
          <Switch
            className="relative shadow-none after:absolute after:-inset-x-1.5 after:top-1/2 after:h-11 after:-translate-y-1/2"
            aria-label={`Show ${field.label} on public profile`}
            checked={company.coreDocumentPublication?.[field.name]?.status === "complete"}
            onCheckedChange={(checked) => {
              const publication = company.coreDocumentPublication ?? resolveCoreDocumentPublication({})
              onUpdate({ coreDocumentPublication: {
                ...publication,
                [field.name]: { ...publication[field.name], status: checked ? "complete" : "in_progress" },
              } })
              onDirty()
            }}
          />
        }
      >
        <RichTextEditor
          className={styles.richText}
          toolbarClassName={styles.richTextToolbar}
          countClassName="hidden"
          value={value}
          onChange={(nextValue) => {
            onUpdate({ [field.name]: nextValue })
            onDirty()
          }}
          ariaLabel={field.label}
          placeholder={field.placeholder}
          mode="compact"
          minHeight={160}
          maxHeight={360}
          stableScrollbars
          preserveImages
          editorClassName="min-h-[160px]"
        />
        {error ? <p className="text-destructive text-xs">{error}</p> : null}
      </ProfileField>
    </div>
  )
}

export function StorySection({
  company,
  errors,
  onUpdate,
  onDirty,
}: CompanyEditProps) {
  return (
    <FormRow
      layout="stacked"
      inset={false}
      title="About us"
      description="What you do, why it matters, and how change happens."
    >
      <div className="grid min-w-0 gap-3">
        {STORY_FIELDS.map((field) => (
          <StoryCoreDocumentField
            key={field.name}
            company={company}
            errors={errors}
            field={field}
            onUpdate={onUpdate}
            onDirty={onDirty}
          />
        ))}
        {NARRATIVE_FIELDS.map((field) => (
          <StoryCoreDocumentField
            key={field.name}
            company={company}
            errors={errors}
            field={field}
            onUpdate={onUpdate}
            onDirty={onDirty}
          />
        ))}
        <StoryCoreDocumentField
          company={company}
          errors={errors}
          field={THEORY_FIELD}
          onUpdate={onUpdate}
          onDirty={onDirty}
        />
      </div>
    </FormRow>
  )
}
