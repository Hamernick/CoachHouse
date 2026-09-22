"use client"

import { useEffect, useState } from "react"
import { saveRoadmapSectionAction } from "@/actions/roadmap"
import { RichTextEditor } from "@/components/rich-text-editor"
import { RoadmapBudgetTableEditor } from "@/components/roadmap/roadmap-budget-table-editor"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import type { RoadmapSection } from "@/lib/roadmap"
import { toast } from "@/lib/toast"

export function OrganizationCoreDocumentEditor({
  section,
  organizationId,
  userId,
  onClose,
  onSaved,
}: {
  section: RoadmapSection
  organizationId: string
  userId: string
  onClose: () => void
  onSaved: () => void
}) {
  const [content, setContent] = useState(section.content)
  const [rows, setRows] = useState(section.budgetRows ?? [])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const dirty =
    content !== section.content ||
    JSON.stringify(rows) !== JSON.stringify(section.budgetRows ?? [])
  useEffect(() => {
    if (!dirty) return
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ""
    }
    window.addEventListener("beforeunload", warn)
    return () => window.removeEventListener("beforeunload", warn)
  }, [dirty])
  const close = () => {
    if (
      !saving &&
      (!dirty || window.confirm("Discard unsaved document changes?"))
    )
      onClose()
  }
  const save = async () => {
    setSaving(true)
    setError(null)
    try {
      const result = await saveRoadmapSectionAction({
        targetOrganizationId: organizationId,
        expectedOrganizationId: organizationId,
        expectedUserId: userId,
        expectedLastUpdated: section.lastUpdated,
        sectionId: section.id,
        content,
        budgetRows: rows,
      })
      if ("error" in result) {
        setError(result.error)
        return
      }
      toast.success("Document saved")
      onSaved()
      onClose()
    } catch {
      setError("Unable to save. Your changes are still here. Try again.")
    } finally {
      setSaving(false)
    }
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) close()
      }}
    >
      <DialogContent className="flex max-h-[90vh] flex-col overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>{section.title}</DialogTitle>
          <DialogDescription>
            Edit this organization’s core document.
          </DialogDescription>
        </DialogHeader>
        <RichTextEditor
          value={content}
          onChange={setContent}
          ariaLabel={section.title}
          preserveImages
          readOnly={saving}
          minHeight={300}
        />
        {section.id === "budget" ? (
          <RoadmapBudgetTableEditor
            rows={rows}
            canEdit={!saving}
            isDirty={dirty}
            isSaving={saving}
            onRowsChange={setRows}
            onSave={() => void save()}
          />
        ) : null}
        {error ? (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        ) : null}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={close} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={() => void save()} disabled={saving || !dirty}>
            {saving ? "Saving…" : "Save document"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
