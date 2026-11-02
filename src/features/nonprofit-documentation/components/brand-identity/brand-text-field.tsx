"use client"

import { InlineEdit } from "@/components/ui/inline-edit"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

type Props = {
  id: string
  label: string
  value: string
  onSave: (value: string) => void | Promise<void>
  inlineEdit?: boolean
  disabled?: boolean
  multiline?: boolean
  placeholder?: string
  maxLength?: number
  rows?: number
  type?: React.HTMLInputTypeAttribute
  min?: number
  max?: number
  onBlur?: () => void
  className?: string
}

export function BrandTextField({ label, onSave, inlineEdit, multiline, rows = 4, type, min, max, onBlur, ...props }: Props) {
  if (inlineEdit) return <InlineEdit {...props} label={label} onSave={onSave} multiline={multiline} placeholder={props.placeholder ?? `Add ${label.toLowerCase()}…`} />
  const shared = { ...props, "aria-label": label, onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => { void onSave(event.target.value) } }
  return multiline ? <Textarea {...shared} rows={rows} /> : <Input {...shared} type={type} min={min} max={max} onBlur={onBlur} />
}
