"use client"

import { useRef, useState, type ReactNode } from "react"
import Upload from "lucide-react/dist/esm/icons/upload"
import type { OrgPerson } from "@/actions/people"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"

import {
  PERSON_CATEGORY_OPTIONS,
  type PersonCategory,
} from "@/lib/people/categories"
import { PeopleImportEntry } from "./people-import-entry"
import { PeopleImportReviewTable } from "./people-import-review-table"
import { PeopleImportColumns } from "./people-import-columns"
import { useWorkspacePeopleImportController } from "../hooks/use-workspace-people-import-controller"

export function WorkspacePeopleImportPanel({
  people,
  organizationId,
  canEdit,
  onImported,
  children,
}: {
  people: OrgPerson[]
  organizationId: string
  canEdit: boolean
  onImported: (people: OrgPerson[]) => void
  children: (openFile: () => void) => ReactNode
}) {
  const controller = useWorkspacePeopleImportController({
    people,
    organizationId,
    canEdit,
    onImported,
  })
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [limit, setLimit] = useState(50)
  const { source, preview, pending, reading } = controller
  const isFile = (transfer: DataTransfer) => transfer.types.includes("Files")
  const selectFile = (files: FileList | null) => {
    if (!files?.length) return
    if (files.length !== 1) {
      controller.setError("Import one file at a time.")
      return
    }
    setLimit(50)
    void controller.readFile(files[0])
  }
  return (
    <div
      className="relative flex min-h-0 flex-1 flex-col"
      onPaste={(event) => {
        if (
          !canEdit ||
          pending ||
          (event.target instanceof Element &&
            event.target.closest("input,textarea,[contenteditable=true]"))
        )
          return
        const text = event.clipboardData.getData("text/plain")
        if (!/[\t\n]/.test(text)) return
        event.preventDefault()
        setLimit(50)
        controller.openImporter(text)
      }}
      onDragOver={(event) => {
        if (!isFile(event.dataTransfer)) return
        event.preventDefault()
        event.stopPropagation()
        event.dataTransfer.dropEffect = canEdit && !pending ? "copy" : "none"
        setDragging(canEdit && !pending)
      }}
      onDragLeave={(event) => {
        if (
          !(event.relatedTarget instanceof Node) ||
          !event.currentTarget.contains(event.relatedTarget)
        )
          setDragging(false)
      }}
      onDrop={(event) => {
        if (!isFile(event.dataTransfer)) return
        event.preventDefault()
        event.stopPropagation()
        setDragging(false)
        if (!canEdit) {
          controller.setError("Editing access is required to import contacts.")
          return
        }
        if (!pending) selectFile(event.dataTransfer.files)
      }}
    >
      {children(() => controller.openImporter())}
      <Input
        ref={inputRef}
        type="file"
        accept=".csv,.vcf,text/csv,text/vcard"
        className="sr-only"
        tabIndex={-1}
        aria-label="Import contacts file"
        disabled={!canEdit || pending}
        onChange={(event) => {
          selectFile(event.target.files)
          event.target.value = ""
        }}
      />
      {dragging && (
        <div className="bg-background/95 border-primary pointer-events-none absolute inset-2 z-50 grid place-items-center rounded-2xl border-2 border-dashed p-6 text-center">
          <div>
            <Upload className="mx-auto mb-3 size-6" aria-hidden />
            <p className="font-medium">Drop contacts</p>
            <p className="text-muted-foreground mt-1 text-sm">
              CSV or vCard · review before importing
            </p>
          </div>
        </div>
      )}
      {!source && !reading && !controller.entryOpen && controller.error && (
        <p role="alert" className="text-destructive px-3 py-2 text-sm">
          {controller.error}
        </p>
      )}
      <Dialog
        open={!!source || reading || controller.entryOpen}
        onOpenChange={(open) => {
          if (!open) controller.close()
        }}
      >
        <DialogContent
          className="flex max-h-[85dvh] flex-col overflow-hidden rounded-2xl sm:max-w-3xl"
          onInteractOutside={(event) => {
            if (pending) event.preventDefault()
          }}
          onEscapeKeyDown={(event) => {
            if (pending) event.preventDefault()
          }}
        >
          <DialogHeader>
            <DialogTitle>Import contacts</DialogTitle>
            <DialogDescription>
              {reading
                ? "Reading file…"
                : controller.entryOpen
                  ? "Choose a file or paste rows to review."
                  : controller.filename}
            </DialogDescription>
          </DialogHeader>
          {reading ? (
            <p role="status" className="text-muted-foreground py-8 text-center">
              Preparing your preview…
            </p>
          ) : controller.entryOpen ? (
            <>
              <PeopleImportEntry
                key={controller.pastedText}
                initialText={controller.pastedText}
                onFile={() => inputRef.current?.click()}
                onPaste={(text, headers) => {
                  setLimit(50)
                  controller.readPaste(text, headers)
                }}
                imports={controller.imports}
                pending={pending}
                onUndo={(id) => void controller.undo(id)}
              />
              {controller.error && (
                <p role="alert" className="text-destructive text-sm">
                  {controller.error}
                </p>
              )}
              {controller.receipt && (
                <p role="status" className="text-sm">
                  {controller.receipt}
                </p>
              )}
            </>
          ) : (
            source && (
              <>
                <div className="min-h-0 flex-1 space-y-4 overflow-auto">
                  <p className="text-muted-foreground text-sm">
                    Add contacts and fill blank fields. Existing values stay
                    unchanged. Same-name matches need review.
                  </p>
                  {source.format !== "vcf" && (
                    <PeopleImportColumns
                      headers={source.headers}
                      mapping={controller.mapping}
                      setMapping={controller.setMapping}
                      onMappingChange={() => controller.setDecisions({})}
                      pending={pending}
                    />
                  )}
                  <p className="text-muted-foreground text-xs">
                    Imports mapped fields only. Add optional CRM fields under
                    Match columns. Additional email addresses, photos and notes
                    are not imported.
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <Label htmlFor="people-import-category">New contacts</Label>
                    <Select
                      value={controller.category}
                      disabled={pending}
                      onValueChange={(value) =>
                        controller.setCategory(value as PersonCategory)
                      }
                    >
                      <SelectTrigger
                        id="people-import-category"
                        className="w-44"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PERSON_CATEGORY_OPTIONS.map((item) => (
                          <SelectItem key={item.value} value={item.value}>
                            {item.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {["staff", "governing_board", "advisory_board"].includes(
                    controller.category
                  ) && (
                    <p className="text-muted-foreground text-xs">
                      Staff and board contacts may appear on your organization’s
                      public profile.
                    </p>
                  )}
                  <p className="text-sm tabular-nums">
                    {preview.added} new · {preview.filled} enriched ·{" "}
                    {preview.skipped} skipped · {preview.review} need review
                  </p>
                  <PeopleImportReviewTable
                    controller={controller}
                    limit={limit}
                    onMore={() => setLimit(limit + 50)}
                  />
                </div>
                {controller.error && (
                  <p role="alert" className="text-destructive text-sm">
                    {controller.error}
                  </p>
                )}
                {controller.receipt && (
                  <p role="status" className="text-sm">
                    {controller.receipt}
                  </p>
                )}
                <DialogFooter>
                  {controller.undoBatchId && (
                    <Button
                      variant="outline"
                      disabled={pending}
                      onClick={() =>
                        void controller.undo(controller.undoBatchId!)
                      }
                    >
                      Undo import
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    disabled={pending}
                    onClick={controller.close}
                  >
                    {controller.receipt ? "Done" : "Cancel"}
                  </Button>
                  <Button
                    disabled={pending || !(preview.added || preview.filled)}
                    aria-busy={pending}
                    onClick={() => void controller.commit()}
                  >
                    {pending ? "Importing…" : "Import contacts"}
                  </Button>
                </DialogFooter>
              </>
            )
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
