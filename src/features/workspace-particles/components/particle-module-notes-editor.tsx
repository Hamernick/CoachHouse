"use client"

import { useId } from "react"
import { useModuleNotes } from "@/hooks/use-module-notes"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import LoaderCircleIcon from "lucide-react/dist/esm/icons/loader-circle"

export function ParticleModuleNotesEditor({
  moduleId,
  readOnly = false,
}: {
  moduleId: string
  readOnly?: boolean
}) {
  const { value, setValue, saveNow, isSaving, loaded, error, reload, dirty } =
    useModuleNotes(moduleId)
  return (
    <ModuleNotesFields
      value={value}
      onChange={setValue}
      onSave={saveNow}
      isSaving={isSaving}
      loaded={loaded}
      error={error}
      onReload={reload}
      dirty={dirty}
      readOnly={readOnly}
    />
  )
}

export function ModuleNotesFields({
  value,
  onChange,
  onSave,
  isSaving,
  loaded,
  error,
  onReload,
  dirty,
  readOnly = false,
}: {
  value: string
  onChange: (value: string) => void
  onSave: () => Promise<void>
  isSaving: boolean
  loaded: boolean
  error: string | null
  onReload: () => Promise<void>
  dirty: boolean
  readOnly?: boolean
}) {
  const id = useId()
  return (
    <div className="nodrag nopan nowheel flex min-h-0 flex-col gap-2">
      <label htmlFor={id} className="sr-only">
        Lesson notes
      </label>
      <Textarea
        id={id}
        value={value}
        disabled={!loaded || Boolean(error)}
        readOnly={readOnly}
        onChange={(event) => onChange(event.target.value)}
        onBlur={() => {
          if (!readOnly) void onSave()
        }}
        placeholder={loaded ? "Capture your notes…" : "Loading notes…"}
        className="min-h-40 resize-none rounded-xl shadow-none"
        maxLength={20_000}
      />
      <div
        role="status"
        className="text-muted-foreground flex items-center gap-2 text-xs"
      >
        {isSaving && (
          <LoaderCircleIcon
            className="size-3 animate-spin motion-reduce:animate-none"
            aria-hidden
          />
        )}
        {error ? (
          <>
            <span>{error}</span>
            {!readOnly && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void (loaded ? onSave() : onReload())}
              >
                Retry
              </Button>
            )}
          </>
        ) : !loaded ? (
          "Loading…"
        ) : isSaving ? (
          "Saving…"
        ) : dirty ? (
          "Not saved yet"
        ) : (
          "Personal notes · Saved in Documents"
        )}
      </div>
    </div>
  )
}
