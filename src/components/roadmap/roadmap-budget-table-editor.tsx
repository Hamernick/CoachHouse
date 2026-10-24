"use client"

import { useCallback, useRef } from "react"
import PlusIcon from "lucide-react/dist/esm/icons/plus"

import { BudgetTable } from "@/components/training/module-detail/budget-table"
import { Button } from "@/components/ui/button"
import { useIsMobile } from "@/hooks/use-mobile"
import type { BudgetTableRow } from "@/lib/modules"
import {
  BLANK_ROADMAP_BUDGET_ROW,
  formatRoadmapBudgetAmount,
  getRoadmapBudgetRowTotal,
} from "@/lib/roadmap/budget"

const COST_TYPE_OPTIONS = ["Fixed", "Variable", "Fixed or Variable"]
const UNIT_OPTIONS = [
  "Month",
  "Year",
  "Person / Hour",
  "Session / Hour",
  "Participant / Session",
  "Event / Month",
  "Program",
  "Item",
]

type RoadmapBudgetTableEditorProps = {
  rows: BudgetTableRow[]
  canEdit: boolean
  isDirty: boolean
  isSaving: boolean
  onRowsChange: (rows: BudgetTableRow[]) => void
  onSave: () => void
}

export function RoadmapBudgetTableEditor({
  rows,
  canEdit,
  isDirty,
  isSaving,
  onRowsChange,
  onSave,
}: RoadmapBudgetTableEditorProps) {
  const isMobile = useIsMobile()
  const pendingAddedRowIndexRef = useRef<number | null>(null)
  const displayRows = rows.length > 0 ? rows : [{ ...BLANK_ROADMAP_BUDGET_ROW }]
  const totals = displayRows.map(getRoadmapBudgetRowTotal)
  const subtotal = totals.reduce((sum, total) => sum + total, 0)
  const unitListId = "roadmap-budget-unit-options"

  const handleCategoryInputMount = useCallback(
    (rowIndex: number, input: HTMLInputElement | null) => {
      if (!input || pendingAddedRowIndexRef.current !== rowIndex) return
      pendingAddedRowIndexRef.current = null
      requestAnimationFrame(() => {
        if (!input.isConnected) return
        input.scrollIntoView({ block: "nearest", inline: "nearest" })
        input.focus({ preventScroll: true })
      })
    },
    []
  )

  function handleAddRow() {
    pendingAddedRowIndexRef.current = displayRows.length
    onRowsChange([...displayRows, { ...BLANK_ROADMAP_BUDGET_ROW }])
  }

  function handleUpdateRow(rowIndex: number, patch: Partial<BudgetTableRow>) {
    const nextRows = [...displayRows]
    const nextRow = { ...nextRows[rowIndex], ...patch }
    nextRow.totalCost = formatRoadmapBudgetAmount(
      getRoadmapBudgetRowTotal(nextRow)
    )
    nextRows[rowIndex] = nextRow
    onRowsChange(nextRows)
  }

  return (
    <div
      className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-contain pb-4"

    >
      <div className="flex shrink-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-muted-foreground max-w-2xl text-sm text-pretty">
          Add the organization&apos;s expected expenses. Totals update as you
          enter quantities and unit costs.
        </p>
        {canEdit ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddRow}
            >
              <PlusIcon data-icon="inline-start" aria-hidden />
              Add line item
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={onSave}
              disabled={!isDirty || isSaving}
            >
              {isSaving ? "Saving…" : isDirty ? "Save budget" : "Saved"}
            </Button>
          </div>
        ) : null}
      </div>

      <BudgetTable
        rows={displayRows}
        blankRow={{ ...BLANK_ROADMAP_BUDGET_ROW }}
        totals={totals}
        subtotal={subtotal}
        costTypeOptions={COST_TYPE_OPTIONS}
        unitOptions={UNIT_OPTIONS}
        unitListId={unitListId}
        formatMoney={formatRoadmapBudgetAmount}
        onUpdateRow={handleUpdateRow}
        onRowsChange={onRowsChange}
        onCategoryInputMount={handleCategoryInputMount}
        layout={isMobile ? "stacked" : "grid"}
        maxBodyHeightClassName="max-h-[min(58dvh,38rem)]"
        readOnly={!canEdit}
      />
    </div>
  )
}
