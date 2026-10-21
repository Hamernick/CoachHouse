"use client"

import { useState } from "react"
import {
  BrandIdentityFoundation, BrandIdentityMarks, BrandIdentityPalette,
  BrandIdentityTypography, BrandIdentityApplications, BrandIdentityExports,
  type BrandAssetId, type BrandIdentityDraft,
} from "@/features/nonprofit-documentation"
import { Button } from "@/components/ui/button"
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog"
import { useWorkspaceBrandAssets } from "../hooks/use-workspace-brand-assets"
import { resolveWorkspaceBrandIdentity, updateWorkspaceBrandIdentity } from "../lib/brand-identity-profile"
import type { WorkspaceBrandKitProfileEditorProps } from "./workspace-brand-kit-profile-editor-types"
import { WorkspaceBrandKitProfileVoice } from "./workspace-brand-kit-profile-voice"
import styles from "./workspace-brand-kit-profile-editor.module.css"

export function WorkspaceBrandKitProfileEditor(props: WorkspaceBrandKitProfileEditorProps) {
  const identity = resolveWorkspaceBrandIdentity(props.profile)
  const files = useWorkspaceBrandAssets(props)
  const [removeId, setRemoveId] = useState<BrandAssetId | null>(null)
  const updateDraft = (updates: Partial<BrandIdentityDraft>) => {
    if (!props.readOnly) props.onChange(updateWorkspaceBrandIdentity(props.profile, updates))
  }
  const shared = {
    draft: identity.draft, updateDraft, assets: files.assets, assetUrls: files.assetUrls,
    uploadAsset: files.uploadAsset, downloadAsset: files.downloadAsset,
    deleteAsset: async (id: BrandAssetId) => { setRemoveId(id) },
    disabled: Boolean(props.readOnly) || files.busy || files.loading,
  }
  return (
    <div className={styles.editor} data-organization-focus-target="brand-kit" tabIndex={-1}>
      {files.error ? <div role="alert" className="mb-4 flex items-center gap-2 text-sm">
        <p>{files.error}</p><Button variant="outline" className="rounded-full" onClick={files.retry}>Retry</Button>
      </div> : null}
      {props.errors.brandIdentity ? <p role="alert" className="text-destructive mb-4 text-sm">{props.errors.brandIdentity}</p> : null}
      {!props.readOnly ? <p className="text-muted-foreground mb-5 text-xs">Save attaches your changes to this organization. Uploaded originals remain in Documents.</p> : null}
      <fieldset disabled={props.readOnly || files.busy} className="min-w-0" data-read-only={props.readOnly || undefined}>
        <legend className="sr-only">Organization brand kit</legend>
        <BrandIdentityFoundation draft={identity.draft} updateDraft={updateDraft} audienceMaxLength={240} taglineMaxLength={160} />
        <BrandIdentityMarks {...shared} />
        <BrandIdentityPalette draft={identity.draft} updateDraft={updateDraft} />
        <BrandIdentityTypography draft={identity.draft} updateDraft={updateDraft} disabled={props.readOnly || files.busy} />
        <BrandIdentityApplications {...shared} />
        <WorkspaceBrandKitProfileVoice profile={props.profile} errors={props.errors} onChange={props.onChange} hideAudience />
      </fieldset>
      <BrandIdentityExports draft={identity.draft} assets={files.assets} ready={!files.loading && !files.error && !files.busy} loadAssets={files.loadAssets} showPrint={false} />
      <AlertDialog open={Boolean(removeId)} onOpenChange={(open) => { if (!open) setRemoveId(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Remove this brand asset?</AlertDialogTitle>
            <AlertDialogDescription>The original stays in Documents. Save the brand kit to apply this change.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Keep asset</AlertDialogCancel><AlertDialogAction onClick={() => {
            if (removeId && !props.readOnly) props.onChange({ brandIdentity: { ...identity, assets: { ...identity.assets, [removeId]: null } } })
            setRemoveId(null)
          }}>Remove asset</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
