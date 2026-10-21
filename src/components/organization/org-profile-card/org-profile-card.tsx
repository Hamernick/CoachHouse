"use client"

import { useEffect, useRef } from "react"
import { Tabs, TabsContent } from "@/components/ui/tabs"

import { ProgramWizardLazy } from "@/components/programs/program-wizard-lazy"

import { ORG_PROFILE_TABS } from "./config"
import { OrgProfileDiscardDialog } from "./org-profile-discard-dialog"
import { OrgProfileHeader } from "./header"
import { OrgProfileHeaderActions } from "./header-controls"
import { OrgProfileDonationLink } from "./org-profile-donation-link"
import { OrgProfileHeaderLinks } from "./header-links"
import { useOrgProfileEditorState } from "./hooks/use-org-profile-editor-state"
import { useOrgProfileEditorDeepLinkFocus } from "./hooks/use-org-profile-editor-deep-link-focus"
import { OrgProfileTabNavigation } from "./org-profile-tab-navigation"
import { CompanyTab } from "./tabs/company-tab"
import { PeopleTab } from "./tabs/people-tab"
import { ProgramsTab } from "./tabs/programs-tab"
import { BrandKitTab } from "./tabs/brand-kit-tab"
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
  navigationRequestId,
  onProgramEditorOpenChange,
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
    slugStatus,
    setSlugStatus,
    editProgram,
    editOpen,
    setEditOpen,
    confirmDiscardOpen,
    setConfirmDiscardOpen,
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
    initialTab: initialFocus?.startsWith("brand") ? "brand-kit" : initialTab,
    initialProgramId,
    initialEditMode,
    navigationRequestId,
  })
  useOrgProfileEditorDeepLinkFocus({
    canEdit,
    editMode,
    focusKey: initialFocus,
    requestId: navigationRequestId,
    rootRef: editorRootRef,
    setEditMode,
    tab,
  })

  useEffect(() => {
    onProgramEditorOpenChange?.(editOpen)
  }, [editOpen, onProgramEditorOpenChange])

  const tabsIdBase = "org-profile-tabs"

  return (
    <div ref={editorRootRef} className="[&_[data-slot=input]]:shadow-none [&_[data-slot=textarea]]:shadow-none [&_[data-slot=select-trigger]]:shadow-none">
      <OrgProfileHeaderActions
        publicLink={publicLink}
        editMode={editMode}
        canEdit={canEdit}
        isSaving={isPending}
        isDirty={dirty}
        onEnterEdit={() => canEdit && setEditMode(true)}
        onCancelEdit={handleCancelEdit}
        onSave={handleSave}
      />
      <Tabs
        value={tab}
        onValueChange={handleTabChange}
        className="w-full min-w-0 gap-3"
      >
        <OrgProfileTabNavigation
          tabs={ORG_PROFILE_TABS}
          tabsIdBase={tabsIdBase}
        />
        <div className="border-border/60 bg-background w-full min-w-0 overflow-hidden rounded-[22px] border pb-6">
          <OrgProfileHeader
            name={company.name || "Organization"}
            tagline={company.tagline || "—"}
            logoUrl={company.logoUrl ?? ""}
            editMode={editMode}
            isSaving={isPending}
            canEdit={canEdit}
            links={<OrgProfileHeaderLinks company={company} centered />}
            donationAction={<OrgProfileDonationLink href={company.donateUrl} />}
            onLogoChange={(url) => persistProfileUpdates({ logoUrl: url })}
          />

          <div className="p-0">
            <TabsContent
              value="company"
              id={`${tabsIdBase}-content-company`}
              aria-labelledby={`${tabsIdBase}-trigger-company`}
              className="grid gap-8 p-6"
            >
              <CompanyTab
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
              value="brand-kit"
              id={`${tabsIdBase}-content-brand-kit`}
              aria-labelledby={`${tabsIdBase}-trigger-brand-kit`}
              className="p-6"
            >
              <BrandKitTab
                company={company}
                errors={errors}
                editMode={editMode}
                onUpdate={handleCompanyUpdate}
                onDirty={markDirty}
                onAutoSave={persistProfileUpdates}
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
          </div>
        </div>
      </Tabs>

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
