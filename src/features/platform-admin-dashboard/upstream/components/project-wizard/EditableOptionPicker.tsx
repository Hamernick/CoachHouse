"use client"

import { useState } from "react"
import { Check, PencilSimple } from "@phosphor-icons/react/dist/ssr"
import { Button } from "../ui/button"
import { Input } from "../ui/input"
import { Label } from "../ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "../ui/command"

export type EditableOption = { id: string; label: string; color?: string }
const COLORS = [
  ["Gray", "#64748b"],
  ["Blue", "#2563eb"],
  ["Teal", "#0d9488"],
  ["Green", "#16a34a"],
  ["Amber", "#d97706"],
  ["Orange", "#ea580c"],
  ["Red", "#dc2626"],
  ["Purple", "#9333ea"],
] as const

export function EditableOptionPicker({
  shared = false,
  noun,
  options,
  selectedId,
  onSelect,
  onSave,
  onDelete,
  trigger,
}: {
  noun: string
  shared?: boolean
  options: EditableOption[]
  selectedId?: string
  onSelect: (option: EditableOption | null) => void
  onSave: (option: EditableOption) => Promise<string | void> | string | void
  onDelete: (option: EditableOption) => Promise<string | void> | string | void
  trigger: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [draft, setDraft] = useState<EditableOption | null>(null)
  const [error, setError] = useState("")
  const [pending, setPending] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const existing = draft && options.some((option) => option.id === draft.id)
  const canCreate =
    query.trim() &&
    !options.some(
      (option) => option.label.toLowerCase() === query.trim().toLowerCase()
    )

  function edit(option: EditableOption) {
    setDraft({ ...option, color: option.color ?? COLORS[0][1] })
    setError("")
    setConfirmDelete(false)
  }
  async function save(remove = false) {
    if (!draft) return
    const label = draft.label.trim()
    if (!remove && (!label || label.length > 80 || label.includes(","))) {
      setError("Use 1–80 characters without commas.")
      return
    }
    if (
      !remove &&
      options.some(
        (option) =>
          option.id !== draft.id &&
          option.label.toLowerCase() === label.toLowerCase()
      )
    ) {
      setError(`That ${noun} already exists.`)
      return
    }
    setPending(true)
    try {
      const message = await (remove
        ? onDelete(draft)
        : onSave({ ...draft, label }))
      if (message) {
        setError(message)
        return
      }
      setDraft(null)
      setQuery("")
      setConfirmDelete(false)
    } catch {
      setError("Could not save. Please retry.")
    } finally {
      setPending(false)
    }
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        if (!pending) {
          setOpen(next)
          setDraft(null)
          setQuery("")
          setError("")
        }
      }}
    >
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="start">
        {draft ? (
          <div
            className="space-y-3 p-3"
            onKeyDown={(event) => {
              if (
                event.key === "Enter" &&
                event.target instanceof HTMLInputElement
              ) {
                event.preventDefault()
                void save()
              }
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor={`option-${noun}`}>
                {existing ? "Edit" : "Create"} {noun}
              </Label>
              <Input
                id={`option-${noun}`}
                autoFocus
                maxLength={80}
                value={draft.label}
                disabled={pending}
                onChange={(event) =>
                  setDraft({ ...draft, label: event.target.value })
                }
              />
            </div>
            <fieldset>
              <legend className="mb-1.5 text-xs font-medium">Color</legend>
              <div className="flex flex-wrap gap-1">
                {COLORS.map(([name, color]) => (
                  <Button
                    key={color}
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-6"
                    aria-label={name}
                    aria-pressed={draft.color === color}
                    disabled={pending}
                    onClick={() => setDraft({ ...draft, color })}
                  >
                    <span
                      className="flex size-5 items-center justify-center rounded-full"
                      style={{ backgroundColor: color }}
                    >
                      {draft.color === color && (
                        <Check className="size-3 text-white" weight="bold" />
                      )}
                    </span>
                  </Button>
                ))}
              </div>
            </fieldset>
            <p className="text-muted-foreground text-xs">{shared ? "Changes apply across all projects." : "Applies when you save this project."}</p>
          {error && (
              <p role="alert" className="text-destructive text-xs">
                {error}
              </p>
            )}
            {confirmDelete ? (
              <div className="space-y-2">
                <p className="text-xs">Delete “{draft.label}”{shared ? " from all projects" : ""}?</p>
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={pending}
                    onClick={() => setConfirmDelete(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    disabled={pending}
                    onClick={() => void save(true)}
                  >
                    {pending ? "Deleting…" : "Delete"}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-1">
                {existing && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="text-destructive mr-auto"
                    disabled={pending}
                    onClick={() => setConfirmDelete(true)}
                  >
                    Delete
                  </Button>
                )}
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={pending}
                  onClick={() => setDraft(null)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={pending}
                  onClick={() => void save()}
                >
                  {pending ? "Saving…" : "Save"}
                </Button>
              </div>
            )}
          </div>
        ) : (
          <Command>
            <CommandInput
              placeholder={`Find or create ${noun}…`}
              value={query}
              onValueChange={setQuery}
            />
            <CommandList>
              {!canCreate && <CommandEmpty>No results.</CommandEmpty>}
              <CommandGroup>
                {options.map((option) => (
                  <CommandItem
                    key={option.id}
                    value={option.label}
                    className="gap-2"
                    onSelect={() => {
                      onSelect(option)
                      setOpen(false)
                    }}
                  >
                    <span
                      className="size-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: option.color ?? COLORS[0][1] }}
                    />
                    <span className="min-w-0 flex-1 truncate">
                      {option.label}
                    </span>
                    {selectedId === option.id && (
                      <Check className="size-3.5 shrink-0" />
                    )}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-6 shrink-0"
                      aria-label={`Edit ${option.label}`}
                      onClick={(event) => {
                        event.stopPropagation()
                        edit(option)
                      }}
                      onKeyDown={(event) => event.stopPropagation()}
                    >
                      <PencilSimple className="size-3.5" />
                    </Button>
                  </CommandItem>
                ))}
                {canCreate && (
                  <CommandItem
                    forceMount
                    value={`Create ${query}`}
                    onSelect={() =>
                      edit({ id: crypto.randomUUID(), label: query.trim() })
                    }
                  >
                    Create {noun} “{query.trim()}”
                  </CommandItem>
                )}
                {selectedId && (
                  <CommandItem
                    value="Clear selection"
                    onSelect={() => {
                      onSelect(null)
                      setOpen(false)
                    }}
                  >
                    Clear selection
                  </CommandItem>
                )}
              </CommandGroup>
            </CommandList>
          </Command>
        )}
      </PopoverContent>
    </Popover>
  )
}
