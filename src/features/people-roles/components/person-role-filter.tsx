"use client"

import { useState } from "react"
import CheckIcon from "lucide-react/dist/esm/icons/check"
import ChevronDownIcon from "lucide-react/dist/esm/icons/chevron-down"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { PERSON_CATEGORY_OPTIONS } from "@/lib/people/categories"
import {
  readPeopleRoles,
  type PersonRole,
  type PersonRoleFilterValue,
} from "@/lib/people/roles"

export function PersonRoleFilter({
  value,
  onChange,
  people,
}: {
  value: PersonRoleFilterValue
  onChange: (value: PersonRoleFilterValue) => void
  people: PersonRole[]
}) {
  const [open, setOpen] = useState(false)
  const options: { value: PersonRoleFilterValue; label: string }[] = [
    { value: "all", label: "All roles" },
    ...PERSON_CATEGORY_OPTIONS,
    ...readPeopleRoles({ org_people: people }).map((label) => ({
      value: `custom:${label}` as const,
      label,
    })),
  ]
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label="Filter workspace people by role"
          id="workspace-people-category"
          className="h-8 w-36 min-w-0 shrink-0 flex-none justify-between gap-2 rounded-xl shadow-none"
        >
          <span className="truncate">
            {options.find((option) => option.value === value)?.label ??
              "All roles"}
          </span>
          <ChevronDownIcon
            aria-hidden
            className="size-3 shrink-0 text-muted-foreground"
          />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-64 max-w-[calc(100vw-2rem)] rounded-lg p-0"
      >
        <Command>
          <CommandInput className="text-sm" placeholder="Search roles…" aria-label="Search roles" />
          <CommandList>
            <CommandEmpty>No roles found.</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.label}
                  onSelect={() => {
                    onChange(option.value)
                    setOpen(false)
                  }}
                >
                  <span className="min-w-0 flex-1 break-words">
                    {option.label}
                  </span>
                  {value === option.value ? (
                    <CheckIcon aria-hidden className="size-4" />
                  ) : null}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
