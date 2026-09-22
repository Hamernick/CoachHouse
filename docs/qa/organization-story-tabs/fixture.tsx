import React, { useState } from "react"
import { createRoot } from "react-dom/client"

import { Button } from "@/components/ui/button"
import { ProfileFieldTabsProvider } from "@/components/organization/org-profile-card/profile-field-tabs-state"
import { StoryPreview } from "@/components/organization/org-profile-card/tabs/company-tab/display-sections"
import { StorySection } from "@/components/organization/org-profile-card/tabs/company-tab/edit-sections/story"
import type {
  OrgProfile,
  OrgProfileErrors,
} from "@/components/organization/org-profile-card/types"

const initial: OrgProfile = {
  originStory:
    "<h2>How we began</h2><p>Neighbors built <strong>something useful</strong>.</p><ul><li>Listen first</li><li>Work together</li></ul>",
  need: "<p>Reliable <em>local support</em>.</p>",
  mission: "<p>Make support accessible.</p>",
  vision: "<p>Every neighborhood thrives.</p>",
  values: "<ol><li>Care</li><li>Clarity</li></ol>",
  theoryOfChange: "<p>Connected people create lasting change.</p>",
}

function Fixture() {
  const [saved, setSaved] = useState(initial)
  const [company, setCompany] = useState(initial)
  const [editMode, setEditMode] = useState(false)
  const [errors, setErrors] = useState<OrgProfileErrors>({})
  const [validationAttempt, setValidationAttempt] = useState(0)
  const [focusKey, setFocusKey] = useState<string | null>(null)
  return (
    <main>
      <h1>About us tabs — isolated behavior check</h1>
      <p>
        Actual view/editor components; saves stay in memory. No account or
        database.
      </p>
      <nav>
        <Button onClick={() => setEditMode(true)}>Edit</Button>
        <Button
          onClick={() => {
            setSaved(company)
            setEditMode(false)
            setErrors({})
            setFocusKey(null)
          }}
        >
          Save fixture
        </Button>
        <Button
          onClick={() => {
            setCompany(saved)
            setEditMode(false)
            setErrors({})
            setFocusKey(null)
          }}
        >
          Cancel
        </Button>
        <Button
          onClick={() => {
            setErrors({
              mission: "Mission needs attention.",
              vision: "Vision needs attention.",
            })
            setValidationAttempt((attempt) => attempt + 1)
          }}
        >
          Validate mission
        </Button>
        <Button
          onClick={() => {
            setFocusKey("theoryOfChange")
            setEditMode(true)
          }}
        >
          Focus theory
        </Button>
      </nav>
      <ProfileFieldTabsProvider
        errors={errors}
        focusKey={focusKey}
        validationAttempt={validationAttempt}
      >
        {editMode ? (
          <StorySection
            company={company}
            errors={errors}
            onUpdate={(updates) => {
              setCompany((previous) => ({ ...previous, ...updates }))
              setErrors((previous) =>
                Object.fromEntries(
                  Object.entries(previous).map(([key, value]) => [
                    key,
                    key in updates ? "" : value,
                  ])
                )
              )
            }}
            onInputChange={() => undefined}
            onDirty={() => undefined}
            onAutoSave={async () => undefined}
            slugStatus={null}
            setSlugStatus={() => undefined}
          />
        ) : (
          <StoryPreview
            company={company}
            addressLines={[]}
            hasAnyBrandLink={false}
          />
        )}
      </ProfileFieldTabsProvider>
    </main>
  )
}

createRoot(document.getElementById("root")!).render(<Fixture />)
