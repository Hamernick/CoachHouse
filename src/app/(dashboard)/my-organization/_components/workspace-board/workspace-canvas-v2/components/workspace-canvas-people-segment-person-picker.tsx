"use client"

import { memo, useMemo, useRef, useState } from "react"
import CheckIcon from "lucide-react/dist/esm/icons/check"
import PlusIcon from "lucide-react/dist/esm/icons/plus"
import UserPlusIcon from "lucide-react/dist/esm/icons/user-plus"

import type { OrgPersonWithImage } from "@/components/people/supporters-showcase"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover"
import { PERSON_CATEGORY_META } from "@/lib/people/categories"
import { cn } from "@/lib/utils"

const MAX_VISIBLE_PEOPLE = 50

function personMatchesQuery(person: OrgPersonWithImage, query: string) {
  if (!query) return true

  return [
    person.name,
    person.title,
    person.email,
    PERSON_CATEGORY_META[person.category].label,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .includes(query)
}

export const WorkspacePeopleSegmentPersonPicker = memo(
  function WorkspacePeopleSegmentPersonPicker({
    segmentLabel,
    availablePeople,
    onAddPeople,
  }: {
    segmentLabel: string
    availablePeople: OrgPersonWithImage[]
    onAddPeople: (personIds: string[]) => void
  }) {
    const [open, setOpen] = useState(false)
    const [query, setQuery] = useState("")
    const [selectedPersonIds, setSelectedPersonIds] = useState<string[]>([])
    const anchorRef = useRef<HTMLDivElement>(null)
    const normalizedQuery = query.trim().toLowerCase()
    const matchingPeople = useMemo(
      () =>
        availablePeople.filter((person) =>
          personMatchesQuery(person, normalizedQuery)
        ),
      [availablePeople, normalizedQuery]
    )
    const visiblePeople = matchingPeople.slice(0, MAX_VISIBLE_PEOPLE)
    const allPeopleAdded = availablePeople.length === 0
    const selectedPersonIdSet = useMemo(
      () => new Set(selectedPersonIds),
      [selectedPersonIds]
    )

    function togglePerson(personId: string) {
      setSelectedPersonIds((current) =>
        current.includes(personId)
          ? current.filter((id) => id !== personId)
          : [...current, personId]
      )
    }

    function addSelectedPeople() {
      if (selectedPersonIds.length === 0) return
      onAddPeople(selectedPersonIds)
      setSelectedPersonIds([])
      setQuery("")
      setOpen(false)
    }

    return (
      <Command
        shouldFilter={false}
        className="h-auto overflow-visible rounded-none bg-transparent"
      >
        <Popover
          open={open}
          onOpenChange={(nextOpen) => {
            setOpen(nextOpen)
            if (!nextOpen) {
              setQuery("")
              setSelectedPersonIds([])
            }
          }}
        >
          <PopoverAnchor asChild>
            <div
              ref={anchorRef}
              className={cn(
                "border-input focus-within-visible:border-ring focus-within-visible:ring-ring/50 h-8 w-full min-w-0 rounded-xl border bg-transparent shadow-xs outline-none focus-within-visible:ring-[3px] [&_[data-slot=command-input-wrapper]]:h-full [&_[data-slot=command-input]]:h-full [&_[data-slot=command-input]]:py-0 [&_[data-slot=command-input-wrapper]]:border-0",
                allPeopleAdded && "opacity-50"
              )}
            >
              <CommandInput
                value={query}
                onValueChange={(value) => {
                  setQuery(value)
                  if (!allPeopleAdded) setOpen(true)
                }}
                onFocus={() => {
                  if (!allPeopleAdded) setOpen(true)
                }}
                onClick={() => {
                  if (!allPeopleAdded) setOpen(true)
                }}
                disabled={allPeopleAdded}
                placeholder={
                  allPeopleAdded
                    ? `Everyone is in ${segmentLabel}`
                    : `Add people to ${segmentLabel}…`
                }
                aria-label={`Search people to add to ${segmentLabel}`}
                aria-expanded={open}
                className="h-10 text-sm"
              />
            </div>
          </PopoverAnchor>
          <PopoverContent
            align="start"
            className="w-[var(--radix-popover-trigger-width)] max-w-[calc(100vw-2rem)] p-0"
            onOpenAutoFocus={(event) => event.preventDefault()}
            onCloseAutoFocus={(event) => event.preventDefault()}
            onInteractOutside={(event) => {
              const target = event.target
              if (
                target instanceof Node &&
                anchorRef.current?.contains(target)
              ) {
                event.preventDefault()
              }
            }}
          >
            <CommandList aria-multiselectable="true">
              <CommandEmpty>No available people found.</CommandEmpty>
              {visiblePeople.length > 0 ? (
                <CommandGroup heading={`Add to ${segmentLabel}`}>
                  {visiblePeople.map((person) => {
                    const category = PERSON_CATEGORY_META[person.category]
                    const selected = selectedPersonIdSet.has(person.id)
                    const supportingText = [
                      person.title || person.email,
                      category.label,
                    ]
                      .filter(Boolean)
                      .join(" · ")

                    return (
                      <CommandItem
                        key={person.id}
                        value={person.id}
                        aria-selected={selected}
                        onSelect={() => togglePerson(person.id)}
                        className={cn(
                          "min-h-11 px-3 py-2",
                          selected && "bg-muted/70"
                        )}
                      >
                        <span className="min-w-0 flex-1">
                          <span className="text-foreground block truncate text-sm font-medium">
                            {person.name}
                          </span>
                          <span className="text-muted-foreground block truncate text-xs">
                            {supportingText}
                          </span>
                        </span>
                        <span
                          data-workspace-people-segment-add-control="true"
                          className={cn(
                            "border-border bg-background text-foreground ml-auto inline-flex h-7 shrink-0 items-center gap-1 rounded-md border px-2 text-xs font-medium",
                            selected &&
                              "bg-primary text-primary-foreground border-primary"
                          )}
                        >
                          {selected ? (
                            <CheckIcon aria-hidden className="size-3.5" />
                          ) : (
                            <PlusIcon aria-hidden className="size-3.5" />
                          )}
                          {selected ? "Selected" : "Add"}
                        </span>
                      </CommandItem>
                    )
                  })}
                </CommandGroup>
              ) : null}
            </CommandList>
            {matchingPeople.length > MAX_VISIBLE_PEOPLE ? (
              <p className="border-border text-muted-foreground border-t px-3 py-2 text-xs">
                Type more to narrow the results.
              </p>
            ) : null}
            <div className="border-border border-t p-2">
              <Button
                type="button"
                size="sm"
                className="h-9 w-full"
                disabled={selectedPersonIds.length === 0}
                onClick={addSelectedPeople}
              >
                <UserPlusIcon aria-hidden />
                {selectedPersonIds.length === 0
                  ? "Select people to add"
                  : `Add ${selectedPersonIds.length} ${selectedPersonIds.length === 1 ? "person" : "people"}`}
              </Button>
              <span className="sr-only" aria-live="polite">
                {selectedPersonIds.length} selected
              </span>
            </div>
          </PopoverContent>
        </Popover>
      </Command>
    )
  }
)
