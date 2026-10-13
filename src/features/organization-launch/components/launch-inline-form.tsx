"use client"

import { useRouter } from "next/navigation"
import { useEffect, useId, useRef, useState, useTransition } from "react"
import LoaderCircleIcon from "lucide-react/dist/esm/icons/loader-circle"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export type LaunchField = {
  name: string
  label: string
  multiline?: boolean
  required?: boolean
  autoComplete?: string
  type?: "text" | "url"
  maxLength?: number
  options?: { value: string; label: string }[]
  when?: { name: string; value: string }
}

export function LaunchInlineForm({ initialValues, fields, onSave, hint, saveLabel = "Save", onDirtyChange, onPendingChange }: {
  initialValues: Record<string, string>
  fields: LaunchField[]
  onSave: (values: Record<string, string>) => Promise<{ error?: string; message?: string }>
  hint?: string
  saveLabel?: string
  onDirtyChange?: (dirty: boolean) => void
  onPendingChange?: (pending: boolean) => void
}) {
  const id = useId()
  const router = useRouter()
  const formRef = useRef<HTMLFormElement>(null)
  const [draft, setDraft] = useState<Record<string, string> | null>(null)
  const [saved, setSaved] = useState<{ baseline: string; values: Record<string, string> } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const saving = useRef(false)
  const baseline = JSON.stringify(initialValues)
  const values = draft ?? (saved?.baseline === baseline ? saved.values : initialValues)
  const dirty = draft !== null
  useEffect(() => { onDirtyChange?.(dirty) }, [dirty, onDirtyChange])
  useEffect(() => { onPendingChange?.(pending) }, [pending, onPendingChange])
  useEffect(() => {
    if (error && !pending) formRef.current?.querySelector<HTMLElement>("input, textarea")?.focus({ preventScroll: true })
  }, [error, pending])
  const change = (name: string, value: string) => {
    setDraft({ ...values, [name]: value }); setMessage(null); setError(null)
  }
  return (
    <form ref={formRef} data-launch-dirty={dirty || undefined} className="space-y-2" data-vaul-no-drag="" aria-busy={pending} onSubmit={(event) => {
      event.preventDefault()
      if (saving.current) return
      saving.current = true
      setError(null); setMessage(null)
      startTransition(async () => {
        try {
          const result = await onSave(values)
          if (result.error) {
            setError(result.error)
            return
          }
          setSaved({ baseline, values }); setDraft(null)
          setMessage(result.message ?? "Saved to your organization profile.")
          router.refresh()
        } catch { setError("Couldn’t confirm the save. Your edits are kept here; try again.") }
        finally { saving.current = false }
      })
    }} onKeyDown={(event) => {
      if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) event.currentTarget.requestSubmit()
    }}>
      {hint ? <p className="text-muted-foreground text-xs leading-4">{hint}</p> : null}
      <fieldset disabled={pending} className="min-w-0 space-y-3">
        {fields.filter((field) => !field.when || values[field.when.name] === field.when.value).map((field) => {
          const fieldId = `${id}-${field.name}`
          return <div key={field.name} className="min-w-0 space-y-1.5">
            <Label htmlFor={fieldId} className="text-xs">{field.label}</Label>
            {field.options ? <Select value={values[field.name]} onValueChange={(value) => change(field.name, value)} disabled={pending}>
              <SelectTrigger id={fieldId} className="h-11 w-full text-base sm:h-9 sm:text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>{field.options.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
            </Select> : field.multiline ? <Textarea id={fieldId} name={field.name} required={field.required} maxLength={field.maxLength} rows={3} value={values[field.name] ?? ""} onChange={(event) => change(field.name, event.target.value)} className="min-h-24 resize-y text-base sm:text-sm" />
              : <Input id={fieldId} name={field.name} type={field.type ?? "text"} autoComplete={field.autoComplete ?? "off"} required={field.required} maxLength={field.maxLength} value={values[field.name] ?? ""} onChange={(event) => change(field.name, event.target.value)} className="h-11 sm:h-9" />}
          </div>
        })}
      </fieldset>
      {error ? <p role="alert" className="text-destructive text-xs leading-4">{error}</p> : null}
      {message ? <p role="status" className="text-muted-foreground text-xs leading-4">{message}</p> : null}
      <div className="flex items-center justify-end gap-2">
        {dirty ? <Button type="button" variant="ghost" size="sm" disabled={pending} className="rounded-full" onClick={() => { setDraft(null); setError(null); setMessage(null) }}>Cancel</Button> : null}
        <Button type="submit" variant="ghost" size="sm" disabled={pending} className="rounded-full">{pending ? <LoaderCircleIcon aria-hidden="true" className="size-3.5 motion-safe:animate-spin" /> : null}{saveLabel}</Button>
      </div>
    </form>
  )
}
