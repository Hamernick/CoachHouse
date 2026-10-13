"use client"

import { useEffect, useId, useState } from "react"
import CheckIcon from "lucide-react/dist/esm/icons/check"
import ChevronDownIcon from "lucide-react/dist/esm/icons/chevron-down"
import PlusIcon from "lucide-react/dist/esm/icons/plus"

import {
  getReactGrabOwnerProps,
  getReactGrabLinkedSurfaceProps,
} from "@/components/dev/react-grab-surface"
import { listPeopleRolesAction } from "@/actions/people-roles"
import { Button } from "@/components/ui/button"
import {
  Command,
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
import {
  PERSON_CATEGORY_META,
  PERSON_CATEGORY_OPTIONS,
} from "@/lib/people/categories"
import {
  MAX_PERSON_ROLE_LENGTH,
  normalizeRoleLabel,
  personRoleLabel,
  type PersonRole,
} from "@/lib/people/roles"
import { cn } from "@/lib/utils"

export function PersonRolePicker({
  value,
  onChange,
  disabled,
  label = "Choose role",
  className,
}: {
  value: PersonRole
  onChange: (role: PersonRole) => void | Promise<void>
  disabled?: boolean
  label?: string
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [roles, setRoles] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const listId = useId()
  const owner = {
    ownerId: `person-role-picker:${listId}`,
    component: "PersonRolePicker",
    source: "src/features/people-roles/components/person-role-picker.tsx",
  }

  useEffect(() => {
    if (!open) return
    let active = true
    setLoading(true)
    setError(null)
    listPeopleRolesAction()
      .then((result) => {
        if (!active) return
        if ("error" in result) setError(result.error)
        else setRoles(result.roles)
      })
      .catch(() => {
        if (active)
          setError("Unable to load roles. Close the menu and try again.")
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [open])

  const search = normalizeRoleLabel(query)
  const options = [
    ...PERSON_CATEGORY_OPTIONS.map((option) => ({
      label: option.label,
      category: option.value,
      customRole: null as string | null,
    })),
    ...Array.from(
      new Set([...roles, ...(value.customRole ? [value.customRole] : [])])
    ).map((role) => ({
      label: role,
      category: value.category,
      customRole: role,
    })),
  ]
  const matches = options.filter((option) =>
    option.label.toLowerCase().includes(search.toLowerCase())
  )
  const canCreate =
    search.length > 0 &&
    search.length <= MAX_PERSON_ROLE_LENGTH &&
    !options.some(
      (option) => option.label.toLowerCase() === search.toLowerCase()
    )

  async function select(role: PersonRole) {
    if (saving) return
    setSaving(true)
    setError(null)
    try {
      await onChange(role)
      setOpen(false)
      setQuery("")
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Unable to save role. Try again."
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        if (!saving) {
          setOpen(next)
          setQuery("")
        }
      }}
    >
      <PopoverTrigger asChild>
        <Button
          {...getReactGrabOwnerProps({ ...owner, slot: "trigger" })}
          type="button"
          variant="outline"
          role="combobox"
          aria-label={label}
          aria-expanded={open}
          aria-controls={open ? listId : undefined}
          disabled={disabled || saving}
          className={cn(
            "h-9 justify-between gap-2 rounded-lg shadow-none",
            className
          )}
        >
          <span className="inline-flex min-w-0 items-center gap-2">
            <span
              aria-hidden
              className={cn(
                "size-1.5 shrink-0 rounded-full",
                value.customRole
                  ? "bg-muted-foreground"
                  : PERSON_CATEGORY_META[value.category].dotClass
              )}
            />
            <span className="truncate">{personRoleLabel(value)}</span>
          </span>
          <ChevronDownIcon
            aria-hidden
            className="size-3 shrink-0 text-muted-foreground"
          />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        {...getReactGrabLinkedSurfaceProps({
          ...owner,
          slot: "content",
          surfaceKind: "content",
        })}
        align="start"
        className="w-64 max-w-[calc(100vw-2rem)] rounded-lg p-0"
      >
        <Command shouldFilter={false}>
          <CommandInput
            value={query}
            onValueChange={setQuery}
            className="text-base md:text-sm"
            placeholder="Search or create a role…"
            aria-label="Search or create a role"
            maxLength={MAX_PERSON_ROLE_LENGTH}
            disabled={saving}
          />
          <CommandList
            id={listId}
            className="max-h-[min(18rem,var(--radix-popover-content-available-height))]"
          >
            <CommandGroup>
              {matches.map((option) => {
                const selected = value.customRole
                  ? option.customRole === value.customRole
                  : !option.customRole && option.category === value.category
                return (
                  <CommandItem
                    key={
                      option.customRole
                        ? `custom:${option.customRole}`
                        : option.category
                    }
                    value={option.label}
                    disabled={saving}
                    onSelect={() => void select(option)}
                  >
                    <span
                      aria-hidden
                      className={cn(
                        "size-2 shrink-0 rounded-full",
                        option.customRole
                          ? "bg-muted-foreground"
                          : PERSON_CATEGORY_META[option.category].dotClass
                      )}
                    />
                    <span className="min-w-0 flex-1 break-words">
                      {option.label}
                    </span>
                    {selected ? (
                      <CheckIcon aria-hidden className="size-4" />
                    ) : null}
                  </CommandItem>
                )
              })}
              {canCreate && !loading ? (
                <CommandItem
                  value={`create:${search}`}
                  disabled={saving}
                  onSelect={() =>
                    void select({
                      category: value.category,
                      customRole: search,
                    })
                  }
                >
                  <PlusIcon aria-hidden className="size-4 shrink-0" />
                  <span className="min-w-0 break-words">Create “{search}”</span>
                </CommandItem>
              ) : null}
            </CommandGroup>
            {loading ? (
              <p
                role="status"
                className="px-3 py-2 text-xs text-muted-foreground"
              >
                Loading saved roles…
              </p>
            ) : null}
            {saving ? (
              <p
                role="status"
                className="px-3 py-2 text-xs text-muted-foreground"
              >
                Saving…
              </p>
            ) : null}
            {error ? (
              <p role="alert" className="px-3 py-2 text-xs text-destructive">
                {error}
              </p>
            ) : null}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
