"use client"

import { useRef } from "react"
import { Tabs, TabsContent } from "@/components/ui/tabs"

import { ProgramWizardLazy } from "@/components/programs/program-wizard-lazy"

import { ORG_PROFILE_TABS } from "./config"
import { OrgProfileDiscardDialog } from "./org-profile-discard-dialog"
import { OrgProfileHeader } from "./header"
import { useOrgProfileEditorState } from "./hooks/use-org-profile-editor-state"
import { useOrgProfileEditorDeepLinkFocus } from "./hooks/use-org-profile-editor-deep-link-focus"
import { OrgProfileTabNavigation } from "./org-profile-tab-navigation"
import { CompanyTab } from "./tabs/company-tab"
import { PeopleTab } from "./tabs/people-tab"
import { ProgramsTab } from "./tabs/programs-tab"
import { SupportersTab } from "./tabs/supporters-tab"
import type { OrgProfileCardProps, OrgProgram } from "./types"

export function OrgProfileEditor({
  initial,
  people,
  programs = [],
  canEdit = true,
  initialTab,
  initialProgramId,
  initialProgramStep,
  initialFocus,
  initialEditMode,
}: OrgProfileCardProps) {
  const editorRootRef = useRef<HTMLDivElement>(null)
  const {
    tab,
    handleTabChange,
    editMode,
    setEditMode,
    isPending,
    dirty,
    company,
    errors,
    validationAttempt,
    slugStatus,
    setSlugStatus,
    editProgram,
    editOpen,
    setEditOpen,
    confirmDiscardOpen,
    setConfirmDiscardOpen,
    currentTabLabel,
    publicLink,
    handleInputChange,
    handleCompanyUpdate,
    markDirty,
    persistProfileUpdates,
    handleSave,
    handleProgramEdit,
    handleCancelEdit,
    handleDiscardConfirm,
    pendingNavigationRef,
  } = useOrgProfileEditorState({
    initial,
    programs: programs as OrgProgram[],
    canEdit,
    initialTab,
    initialProgramId,
    initialEditMode,
  })
  useOrgProfileEditorDeepLinkFocus({
    canEdit,
    editMode,
    focusKey: initialFocus,
    rootRef: editorRootRef,
    setEditMode,
    tab,
  })

  const tabsIdBase = "org-profile-tabs"

  return (
    <div ref={editorRootRef} className="overflow-hidden pb-6">
      <OrgProfileHeader
        name={company.name || "Organization"}
        tagline={company.tagline || "—"}
        logoUrl={company.logoUrl ?? ""}
        headerUrl={company.headerUrl ?? ""}
        editMode={editMode}
        isSaving={isPending}
        isDirty={dirty}
        canEdit={canEdit}
        publicLink={publicLink}
        onLogoChange={(url) => persistProfileUpdates({ logoUrl: url })}
        onHeaderChange={(url) => persistProfileUpdates({ headerUrl: url })}
        onEnterEdit={() => canEdit && setEditMode(true)}
        onCancelEdit={handleCancelEdit}
        onSave={handleSave}
      />

      <div className="p-0">
        <Tabs value={tab} onValueChange={handleTabChange} className="w-full">
          <OrgProfileTabNavigation
            tab={tab}
            tabs={ORG_PROFILE_TABS}
            tabsIdBase={tabsIdBase}
            currentTabLabel={currentTabLabel}
            onTabChange={handleTabChange}
          />

          <TabsContent
            value="company"
            id={`${tabsIdBase}-content-company`}
            aria-labelledby={`${tabsIdBase}-trigger-company`}
            className="grid gap-8 p-6"
          >
            <CompanyTab
              focusKey={initialFocus}
              validationAttempt={validationAttempt}
              company={company}
              errors={errors}
              editMode={editMode}
              onInputChange={handleInputChange}
              onUpdate={handleCompanyUpdate}
              onDirty={markDirty}
              onAutoSave={persistProfileUpdates}
              slugStatus={slugStatus}
              setSlugStatus={setSlugStatus}
            />
          </TabsContent>

          <TabsContent
            value="programs"
            id={`${tabsIdBase}-content-programs`}
            aria-labelledby={`${tabsIdBase}-trigger-programs`}
            className="grid gap-8 p-6"
          >
            <ProgramsTab
              programs={programs as OrgProgram[]}
              companyName={company.name}
              canEdit={canEdit}
              editMode={editMode}
              onProgramEdit={handleProgramEdit}
            />
          </TabsContent>

          <TabsContent
            value="people"
            id={`${tabsIdBase}-content-people`}
            aria-labelledby={`${tabsIdBase}-trigger-people`}
            className="grid gap-8 p-6"
          >
            <PeopleTab editMode={editMode} people={people} />
          </TabsContent>

          <TabsContent
            value="supporters"
            id={`${tabsIdBase}-content-supporters`}
            aria-labelledby={`${tabsIdBase}-trigger-supporters`}
            className="grid gap-8 p-6"
          >
            <SupportersTab editMode={editMode} people={people} />
          </TabsContent>
        </Tabs>
      </div>

      <OrgProfileDiscardDialog
        open={confirmDiscardOpen}
        onOpenChange={setConfirmDiscardOpen}
        onKeepEditing={() => {
          pendingNavigationRef.current = null
          setConfirmDiscardOpen(false)
        }}
        onDiscard={() => {
          setConfirmDiscardOpen(false)
          handleDiscardConfirm()
        }}
      />

      {canEdit && editProgram ? (
        <ProgramWizardLazy
          mode="edit"
          program={editProgram}
          initialStep={initialProgramStep}
          open={editOpen}
          onOpenChange={setEditOpen}
        />
      ) : null}
    </div>
  )
}

export { OrgProfileEditor as OrgProfileCard }
