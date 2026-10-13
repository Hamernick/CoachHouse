"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import FileSpreadsheetIcon from "lucide-react/dist/esm/icons/file-spreadsheet"
import FileUpIcon from "lucide-react/dist/esm/icons/file-up"
import Loader2Icon from "lucide-react/dist/esm/icons/loader-2"
import PlusIcon from "lucide-react/dist/esm/icons/plus"

import { BudgetTable } from "@/components/training/module-detail/budget-table"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { toast } from "@/lib/toast"

import { connectFiscalSponsorshipDocumentAsset } from "../actions"
import {
  BUDGET_SUPPORT_ACCEPT,
  formatBudgetDollars,
  getBudgetRowTotal,
  getBudgetTotal,
  isCsvFile,
  makeBudgetRow,
  parseCsvBudgetRows,
  summarizeBudgetRows,
  uploadProjectAsset,
  type FiscalSponsorshipBudgetRow,
} from "../lib/budget-plan"
import type { FiscalSponsorshipApplicationDraft } from "../lib/application-draft"
import type { DraftFieldChange } from "./fiscal-sponsorship-application-editor-controls"

type FiscalSponsorshipBudgetPlanEditorProps = {
  guest?: boolean
  applicationReady: boolean
  draft: FiscalSponsorshipApplicationDraft
  formId: string
  onFieldChange: DraftFieldChange
  projectId: string
  sourceActivityTitle?: string | null
}

const COST_TYPE_OPTIONS = ["Fixed", "Variable", "Fixed or Variable"]
const UNIT_OPTIONS = [
  "Session / Hour",
  "Participant / Session",
  "Participant / Event",
  "Event / Month",
  "Participant / Trip",
  "Program / Participant",
  "Program / Session",
]

function formatMoney(value: number) {
  return Number.isFinite(value) ? value.toFixed(2) : "0.00"
}

export function FiscalSponsorshipBudgetPlanEditor({
  applicationReady,
  guest = false,
  draft,
  formId,
  onFieldChange,
  projectId,
  sourceActivityTitle,
}: FiscalSponsorshipBudgetPlanEditorProps) {
  const router = useRouter()
  const [selectedSupportFile, setSelectedSupportFile] =
    React.useState<File | null>(null)
  const [isUploadPending, startUploadTransition] = React.useTransition()
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const rows =
    draft.budgetRows.length > 0 ? draft.budgetRows : [makeBudgetRow(0)]
  const totals = rows.map(getBudgetRowTotal)
  const hasLineItemAmounts = totals.some((total) => total > 0)
  const budgetTotal = getBudgetTotal(rows)
  const supportFileInputId = `${formId}-budgetSupportFile`
  const unitListId = `${formId}-fiscal-budget-unit-options`

  function commitRows(nextRows: FiscalSponsorshipBudgetRow[]) {
    const nextTotal = getBudgetTotal(nextRows)
    onFieldChange("budgetRows", nextRows)
    onFieldChange("expenseSummary", summarizeBudgetRows(nextRows))
    onFieldChange(
      "estimatedBudgetDollars",
      nextTotal > 0 ? formatMoney(nextTotal) : ""
    )
  }

  function handleRowChange(
    rowIndex: number,
    patch: Partial<FiscalSponsorshipBudgetRow>
  ) {
    const nextRows = [...rows]
    const nextRow = { ...nextRows[rowIndex], ...patch }
    nextRow.totalCost = formatMoney(getBudgetRowTotal(nextRow))
    nextRows[rowIndex] = nextRow
    commitRows(nextRows)
  }

  function handleAddRow() {
    commitRows([...rows, makeBudgetRow(rows.length)])
  }

  function handleRemoveRow(rowIndex: number) {
    const nextRows = rows.filter((_, index) => index !== rowIndex)
    commitRows(nextRows.length > 0 ? nextRows : [makeBudgetRow(0)])
  }

  async function handleImportCsvRows() {
    const file = selectedSupportFile

    if (!isCsvFile(file)) {
      toast.error("Choose a CSV file to import budget rows.")
      return
    }

    const importedRows = parseCsvBudgetRows(await file.text())
    if (importedRows.length === 0) {
      toast.error("That CSV did not include budget rows.")
      return
    }

    commitRows(importedRows)
    toast.success(
      `Imported ${importedRows.length} budget ${
        importedRows.length === 1 ? "row" : "rows"
      }.`
    )
  }

  function handleUploadSupportFile() {
    if (!applicationReady) {
      toast.error("Save the fiscal application before uploading budget files.")
      return
    }

    if (!selectedSupportFile) {
      toast.error("Choose a budget file to upload.")
      return
    }

    const file = selectedSupportFile
    startUploadTransition(async () => {
      const toastId = toast.loading("Uploading budget support file...")

      try {
        const asset = await uploadProjectAsset({
          description:
            "Budget, expense categories, vendor estimates, or other support for requested project costs.",
          file,
          projectId,
          title: file.name,
        })
        const connected = await connectFiscalSponsorshipDocumentAsset({
          assetId: asset.assetId,
          documentKey: "budget_support",
          projectId,
          title: asset.assetName || file.name,
        })

        if ("error" in connected) {
          toast.error(connected.error, { id: toastId })
          return
        }

        setSelectedSupportFile(null)
        if (fileInputRef.current) fileInputRef.current.value = ""
        toast.success("Budget support file uploaded", { id: toastId })
        router.refresh()
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Unable to upload that budget file.",
          { id: toastId }
        )
      }
    })
  }

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <Field>
        <div className="flex min-w-0 flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <FieldLabel>Budget plan</FieldLabel>
            <FieldDescription>
              {guest ? (
                "List the costs you expect. Add rows or import a CSV to build your budget."
              ) : (
                <>
                  {sourceActivityTitle
                    ? `Linked to the budget for ${sourceActivityTitle}.`
                    : "Linked to the budget for the selected activity or program."}{" "}
                  Saving this application updates the same line items in the program
                  builder.
                </>
              )}
            </FieldDescription>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-fit"
            onClick={handleAddRow}
          >
            <PlusIcon data-icon="inline-start" aria-hidden />
            Add row
          </Button>
        </div>
        <div className="min-w-0">
          <BudgetTable
            rows={rows}
            blankRow={makeBudgetRow(0)}
            totals={totals}
            subtotal={budgetTotal}
            costTypeOptions={COST_TYPE_OPTIONS}
            unitOptions={UNIT_OPTIONS}
            unitListId={unitListId}
            formatMoney={formatMoney}
            onUpdateRow={handleRowChange}
            onRowsChange={commitRows}
            layout="grid"
            maxBodyHeightClassName="max-h-[min(52vh,34rem)]"
          />
        </div>
        <FieldDescription className="flex items-center justify-between gap-3">
          <span>
            {hasLineItemAmounts
              ? "The fiscal application total updates from these line items."
              : "Add quantity and unit cost to calculate the budget."}
          </span>
          <span className="text-foreground shrink-0 font-semibold tabular-nums">
            {hasLineItemAmounts
              ? formatBudgetDollars(budgetTotal)
              : "Not calculated"}
          </span>
        </FieldDescription>
      </Field>

      <Field>
        <FieldLabel htmlFor={supportFileInputId}>
          {guest ? "Import a budget (optional)" : "Budget support files"}
        </FieldLabel>
        <Input
          ref={fileInputRef}
          id={supportFileInputId}
          type="file"
          accept={guest ? ".csv,text/csv" : BUDGET_SUPPORT_ACCEPT}
          onChange={(event) =>
            setSelectedSupportFile(event.target.files?.[0] ?? null)
          }
        />
        <FieldDescription>
          {selectedSupportFile
            ? `${selectedSupportFile.name} selected`
            : guest
              ? "CSV rows are added to your application. The file itself is not uploaded."
              : "CSV, spreadsheet, PDF, image, and document files are supported."}
        </FieldDescription>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!isCsvFile(selectedSupportFile)}
            onClick={() => void handleImportCsvRows()}
          >
            <FileSpreadsheetIcon data-icon="inline-start" aria-hidden />
            Import CSV rows
          </Button>
          {!guest ? (
            <Button
            type="button"
            size="sm"
            disabled={
              !selectedSupportFile || !applicationReady || isUploadPending
            }
            aria-busy={isUploadPending}
            onClick={handleUploadSupportFile}
          >
            {isUploadPending ? (
              <Loader2Icon
                data-icon="inline-start"
                className="animate-spin"
                aria-hidden
              />
            ) : (
              <FileUpIcon data-icon="inline-start" aria-hidden />
            )}
            Upload support file
            </Button>
          ) : null}
        </div>
        {!guest && !applicationReady ? (
          <FieldDescription>
            Save the application first to attach budget files for review.
          </FieldDescription>
        ) : null}
      </Field>
    </div>
  )
}
