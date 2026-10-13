"use client"

import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import type { GuestProfileFields, GuestProfilePreview } from "../lib/guest-profile"

const fields = ["name", "description", "email", "phone"] as const
const labels = { name: "Organization name", description: "Description", email: "Contact email", phone: "Phone" }
export function FiscalProfileSelection({ preview, values, selected, onSelect, onChange, errors }: {
  preview: GuestProfilePreview; values: GuestProfileFields; selected: Partial<Record<keyof GuestProfileFields, boolean>>;
  onSelect: (key: keyof GuestProfileFields, checked: boolean) => void;
  onChange: (key: keyof GuestProfileFields, value: string) => void;
  errors: Record<string, string>;
}) {
  if (preview.isPublic) return <p className="mt-3 text-sm text-muted-foreground">Your organization profile is already public. You can link this application without copying private answers into it.</p>
  return <div className="mt-4 space-y-3">
    <p className="text-sm text-muted-foreground">Choose what to reuse. Unchecked fields stay unchanged. Your profile stays private.</p>
    {fields.map((field) => <div key={field} className="rounded-xl border p-3">
      <Label htmlFor={`reuse-${field}`} className="flex min-h-11 cursor-pointer items-center gap-2 text-sm">
        <Checkbox id={`reuse-${field}`} className="shadow-none" checked={Boolean(selected[field])} onCheckedChange={(checked) => onSelect(field, checked === true)} />
        {labels[field]}
      </Label>
      {preview.current[field] && <p className="mb-2 break-words text-xs text-muted-foreground">Current: {preview.current[field]}</p>}
      {selected[field] && <>
        {field === "description"
          ? <Textarea aria-label={labels[field]} value={values[field]} onChange={(event) => onChange(field, event.target.value)} aria-invalid={Boolean(errors[field])} aria-describedby={errors[field] ? `reuse-error-${field}` : undefined} className="bg-white shadow-none dark:bg-input/30" />
          : <Input aria-label={labels[field]} type={field === "email" ? "email" : field === "phone" ? "tel" : "text"} value={values[field]} onChange={(event) => onChange(field, event.target.value)} aria-invalid={Boolean(errors[field])} aria-describedby={errors[field] ? `reuse-error-${field}` : undefined} className="bg-white shadow-none dark:bg-input/30" />}
        {errors[field] && <p id={`reuse-error-${field}`} className="mt-1 text-xs text-destructive">{errors[field]}</p>}
      </>}
    </div>)}
    <p className="text-xs leading-5 text-muted-foreground">Mailing addresses, budgets, legal answers, documents and review notes won’t be copied. No paid plan or team access is added.</p>
  </div>
}
