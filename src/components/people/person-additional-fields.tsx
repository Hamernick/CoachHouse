"use client"
import PlusIcon from "lucide-react/dist/esm/icons/plus"
import XIcon from "lucide-react/dist/esm/icons/x"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Field, FieldLabel, FieldGroup } from "@/components/ui/field"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectGroup,
  SelectItem,
} from "@/components/ui/select"
import {
  CONTACT_DETAIL_FIELDS,
  CONTACT_STAGES,
  type ContactDetails,
  type ContactDetailField,
  type ContactMetadata,
} from "@/lib/people/contact-schema"

export function PersonAdditionalFields({
  value,
  onChange,
  metadata,
  formId,
  readOnly,
}: {
  value: ContactDetails
  onChange: (value: ContactDetails) => void
  metadata?: ContactMetadata
  formId: string
  readOnly: boolean
}) {
  const keys = Object.keys(CONTACT_DETAIL_FIELDS) as ContactDetailField[]
  const present = keys.filter((key) => value[key] !== undefined)
  const available = keys.filter((key) => value[key] === undefined)
  return (
    <div className="mt-5 flex flex-col gap-4">
      {present.length > 0 && (
        <FieldGroup>
          {present.map((key) => {
            const field = CONTACT_DETAIL_FIELDS[key]
            const id = `${formId}-details-${key}`
            return (
              <Field key={key}>
                <div className="flex items-center justify-between gap-2">
                  <FieldLabel htmlFor={id}>{field.label}</FieldLabel>
                  {!readOnly && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      aria-label={`Remove ${field.label}`}
                      onClick={() => {
                        const next = { ...value }
                        delete next[key]
                        onChange(next)
                      }}
                    >
                      <XIcon />
                    </Button>
                  )}
                </div>
                {field.type === "select" ? (
                  <Select
                    value={value[key] || undefined}
                    disabled={readOnly}
                    onValueChange={(next) =>
                      onChange({ ...value, [key]: next })
                    }
                  >
                    <SelectTrigger id={id} className="w-full">
                      <SelectValue placeholder="Choose stage" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {CONTACT_STAGES.map((stage) => (
                          <SelectItem key={stage} value={stage}>
                            {stage}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    id={id}
                    type={field.type}
                    value={value[key] ?? ""}
                    maxLength={key === "website" ? 2048 : 200}
                    placeholder={
                      key === "timezone" ? "America/Chicago" : undefined
                    }
                    readOnly={readOnly}
                    onChange={(event) =>
                      onChange({ ...value, [key]: event.target.value })
                    }
                  />
                )}
              </Field>
            )
          })}
        </FieldGroup>
      )}
      {!readOnly && available.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="outline" className="w-fit">
              <PlusIcon />
              Add field
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuGroup>
              {available.map((key) => (
                <DropdownMenuItem
                  key={key}
                  onSelect={() => onChange({ ...value, [key]: "" })}
                >
                  {CONTACT_DETAIL_FIELDS[key].label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      <details className="text-sm">
        <summary className="text-muted-foreground cursor-pointer">
          Sources
        </summary>
        <div className="mt-3 flex flex-col gap-3">
          {!metadata || !Object.keys(metadata.provenance).length ? (
            <p className="text-muted-foreground">
              Source not recorded for this contact.
            </p>
          ) : (
            <>
              <p className="text-muted-foreground text-xs">
                Provided information; not independently verified.
              </p>
              {Object.entries(metadata.provenance).map(([field, source]) => (
                <div key={field} className="flex flex-col gap-1">
                  <span className="font-medium">
                    {field.startsWith("details.")
                      ? CONTACT_DETAIL_FIELDS[
                          field.slice(8) as ContactDetailField
                        ]?.label
                      : field.charAt(0).toUpperCase() + field.slice(1)}
                  </span>
                  <span className="text-muted-foreground break-words">
                    {source.label} · {source.kind}
                  </span>
                  <time
                    className="text-muted-foreground text-xs"
                    dateTime={source.recordedAt}
                    suppressHydrationWarning
                  >
                    {new Date(source.recordedAt).toLocaleString()}
                  </time>
                </div>
              ))}
            </>
          )}
        </div>
      </details>
    </div>
  )
}
