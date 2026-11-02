"use client"
import { useId, useState } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Field, FieldLabel } from "@/components/ui/field"
import { defaultImportMapping, parsePeopleImport } from "../lib"
import type { PeopleImportSummary } from "@/lib/people/import-history"

function looksLikeHeaders(text: string) {
  if (!text.trim()) return true
  try {
    return Object.values(
      defaultImportMapping(parsePeopleImport(text, "paste.csv").headers)
    ).some(Boolean)
  } catch {
    return false
  }
}

export function PeopleImportEntry({
  initialText = "",
  onFile,
  onPaste,
  imports,
  pending,
  onUndo,
}: {
  initialText?: string
  onFile: () => void
  onPaste: (text: string, hasHeaders: boolean) => void
  imports: PeopleImportSummary[]
  pending: boolean
  onUndo: (id: string) => void
}) {
  const id = useId()
  const [text, setText] = useState(initialText)
  const [headers, setHeaders] = useState(() => looksLikeHeaders(initialText))
  return (
    <div className="flex min-h-0 flex-col gap-4 overflow-y-auto">
      <Button
        type="button"
        variant="outline"
        disabled={pending}
        onClick={onFile}
      >
        Choose CSV or vCard
      </Button>
      <Field>
        <FieldLabel htmlFor={`${id}-paste`}>Paste spreadsheet rows</FieldLabel>
        <Textarea
          id={`${id}-paste`}
          rows={5}
          maxLength={1_000_000}
          value={text}
          disabled={pending}
          placeholder="Copy rows from a spreadsheet and paste here"
          onChange={(event) => {
            if (!text) setHeaders(looksLikeHeaders(event.target.value))
            setText(event.target.value)
          }}
        />
      </Field>
      <Field orientation="horizontal">
        <Checkbox
          id={`${id}-headers`}
          checked={headers}
          disabled={pending}
          onCheckedChange={(value) => setHeaders(value === true)}
        />
        <FieldLabel htmlFor={`${id}-headers`}>
          First row contains column names
        </FieldLabel>
      </Field>
      <Button
        disabled={pending || !text.trim()}
        onClick={() => onPaste(text, headers)}
      >
        Review pasted rows
      </Button>
      {imports.length > 0 && (
        <div className="flex flex-col gap-3 border-t pt-4">
          <p className="text-sm font-medium">Recent imports</p>
          <p className="text-muted-foreground text-xs">
            Undo restores unchanged fields and archives unchanged new contacts.
            Later edits remain. Available for the last five imports within seven
            days.
          </p>
          {imports.map((item) => (
            <div key={item.id} className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm">{item.label}</p>
                <p className="text-muted-foreground text-xs">
                  {item.added} added · {item.filled} enriched ·{" "}
                  <time dateTime={item.createdAt} suppressHydrationWarning>
                    {new Date(item.createdAt).toLocaleString()}
                  </time>
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                disabled={pending || !!item.undoneAt}
                onClick={() => onUndo(item.id)}
              >
                {item.undoneAt ? "Undone" : "Undo"}
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
