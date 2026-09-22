"use client"

import { RichTextEditor } from "@/components/rich-text-editor"

import {
  FormRow,
  ProfileField,
} from "@/components/organization/org-profile-card/shared"
import { ProfileFieldTabs } from "../../../profile-field-tabs"
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
    label: "Need",
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

const ALL_STORY_FIELDS = [...STORY_FIELDS, ...NARRATIVE_FIELDS, THEORY_FIELD]

export function StorySection({
  company,
  errors,
  onUpdate,
  onDirty,
}: CompanyEditProps) {
  return (
    <FormRow
      title="About us"
      description="What you do, why it matters, and how change happens."
    >
      <ProfileFieldTabs group="story" label="About us fields">
        {ALL_STORY_FIELDS.map((field) => (
          <ProfileField
            key={field.name}
            label={field.label}
            focusKey={field.name}
          >
            <RichTextEditor
              value={company[field.name] ?? ""}
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
            {errors[field.name] ? (
              <p className="text-destructive text-xs">{errors[field.name]}</p>
            ) : null}
          </ProfileField>
        ))}
      </ProfileFieldTabs>
    </FormRow>
  )
}
