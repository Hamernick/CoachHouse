"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu"
import { CONTACT_DETAIL_FIELDS } from "@/lib/people/contact-schema"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { IMPORT_FIELD_LABELS } from "../lib"
import type { ImportField, ImportMapping } from "../types"

export function PeopleImportColumns({
  headers,
  mapping,
  setMapping,
  onMappingChange,
  pending,
}: {
  headers: string[]
  mapping: ImportMapping
  setMapping: (mapping: ImportMapping) => void
  onMappingChange: () => void
  pending: boolean
}) {
  const [added, setAdded] = useState<string[]>([])
  const [open, setOpen] = useState(
    !mapping.name && !mapping.firstName && !mapping.lastName
  )
  const available = Object.keys(CONTACT_DETAIL_FIELDS).filter(
    (key) => !mapping[key as ImportField] && !added.includes(key)
  )
  return (
    <details
      className="rounded-xl border p-3"
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary className="cursor-pointer text-sm font-medium">
        Match columns
      </summary>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {Object.entries(IMPORT_FIELD_LABELS)
          .filter(
            ([field]) =>
              !(field in CONTACT_DETAIL_FIELDS) ||
              mapping[field as ImportField] ||
              added.includes(field)
          )
          .map(([field, label]) => (
            <div key={field} className="space-y-1">
              <Label htmlFor={`people-import-${field}`}>{label}</Label>
              <Select
                value={mapping[field as ImportField] || "__none__"}
                disabled={pending}
                onValueChange={(value) => {
                  setMapping({
                    ...mapping,
                    [field]: value === "__none__" ? "" : value,
                  })
                  onMappingChange()
                }}
              >
                <SelectTrigger id={`people-import-${field}`} className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Not imported</SelectItem>
                  {headers.map((header) => (
                    <SelectItem key={header} value={header}>
                      {header}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
      </div>
      {available.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              disabled={pending}
              className="mt-3"
            >
              Add field
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuGroup>
              {available.map((field) => (
                <DropdownMenuItem
                  key={field}
                  onSelect={() => setAdded([...added, field])}
                >
                  {IMPORT_FIELD_LABELS[field as ImportField]}
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </details>
  )
}
