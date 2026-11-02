"use client"

import { ParticleButton as Button } from "@/components/ui/particle-ui"

import { createContext, useContext, useState } from "react"
import CheckIcon from "lucide-react/dist/esm/icons/check"
import UsersIcon from "lucide-react/dist/esm/icons/users"

import { Field, FieldLabel } from "@/components/ui/field"
import { ParticlePopover as Popover } from "@/components/ui/particle-ui"
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from "@/components/ui/command"
import { EMPTY_RESPONSIBILITY, supportsParticleResponsibility, type ParticleResponsibility } from "../lib/particle-responsibility"
import type { Particle } from "../types"

type PersonOption = { id: string; name: string }
/** Supplied by the authorized workspace People reader; never inferred from a user ID. */
export const ParticleResponsibilityPeople = createContext<readonly PersonOption[] | null>(null)

function PersonPicker({ label, people, selected, disabled, onSelect, limit }: {
  label: string
  people: readonly PersonOption[]
  selected: readonly string[]
  disabled: boolean
  limit?: number
  onSelect: (id: string | null) => void
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const matching = people.filter(person => person.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))
  return <Popover open={open && !disabled} onOpenChange={value => { setOpen(value); setQuery("") }}>
    <Popover.Trigger><Button color="secondary" size="lg" type="button" variant="outline" disabled={disabled} aria-label={label} className="min-h-11 w-full justify-start truncate"><UsersIcon aria-hidden />{label}</Button></Popover.Trigger>
    <Popover.Content minWidth={0} className="nodrag nopan nowheel w-72 p-0" align="start">
      <Command shouldFilter={false}>
        <CommandInput autoFocus aria-label="Search people" placeholder="Search people…" value={query} onValueChange={setQuery} />
        <CommandList>
          <CommandEmpty>No people found.</CommandEmpty>
          <CommandGroup>
            <CommandItem value="clear" onSelect={() => { onSelect(null); setOpen(false) }}>Clear selection</CommandItem>
            {matching.slice(0, 50).map(person => <CommandItem disabled={Boolean(limit && selected.length >= limit && !selected.includes(person.id))} key={person.id} value={person.id} onSelect={() => { onSelect(person.id); setOpen(false) }}>
              <span className="min-w-0 flex-1 truncate">{person.name}</span>
              {selected.includes(person.id) && <CheckIcon aria-label="Selected" className="size-4" />}
            </CommandItem>)}
          </CommandGroup>
        </CommandList>
        {matching.length > 50 && <p className="px-3 py-2 text-xs text-muted-foreground">Keep typing to narrow results.</p>}
      </Command>
    </Popover.Content>
  </Popover>
}

export function ParticleResponsibilityFields({ particle, disabled, onChange }: {
  particle: Particle
  disabled: boolean
  onChange: (particle: Particle) => void
}) {
  if (particle.type !== "objective" || !supportsParticleResponsibility(particle)) return null
  return <ParticleResponsibilitySelector value={particle.responsibility ?? EMPTY_RESPONSIBILITY} disabled={disabled}
    onChange={responsibility => onChange({ ...particle, responsibility })} />
}

export function ParticleResponsibilitySelector({ value, disabled, onChange }: {
  value: ParticleResponsibility
  disabled: boolean
  onChange: (value: ParticleResponsibility) => void
}) {
  const people = useContext(ParticleResponsibilityPeople)
  const name = (id: string) => people?.find(person => person.id === id)?.name ?? "Unavailable person"
  return <div className="space-y-3" role="group" aria-label="Responsibility">
    <Field>
      <FieldLabel>Accountable person</FieldLabel>
      <PersonPicker label={value.ownerId ? name(value.ownerId) : "Assign owner"} people={people ?? []} selected={value.ownerId ? [value.ownerId] : []} disabled={disabled || people === null}
        onSelect={ownerId => onChange({ ...value, ownerId, contributorIds: value.contributorIds.filter(id => id !== ownerId) })} />
    </Field>
    <Field>
      <FieldLabel>Contributors</FieldLabel>
      <PersonPicker label="Add or remove contributors" limit={50} people={(people ?? []).filter(person => person.id !== value.ownerId)} selected={value.contributorIds} disabled={disabled || people === null}
        onSelect={id => onChange({ ...value, contributorIds: id === null ? [] : value.contributorIds.includes(id) ? value.contributorIds.filter(item => item !== id) : value.contributorIds.length < 50 ? [...value.contributorIds, id] : value.contributorIds })} />
      {value.contributorIds.length > 0 && <ul className="flex flex-wrap gap-1" aria-label="Assigned contributors">{value.contributorIds.map(id => <li key={id} className="rounded-md bg-muted px-2 py-1 text-xs">{name(id)}</li>)}</ul>}
    </Field>
    {value.contributorIds.length >= 50 && <p role="status" className="text-xs text-muted-foreground">50 contributors maximum.</p>}
    <p className="text-xs text-muted-foreground">People records. Assigning does not grant access.</p>
  </div>
}
