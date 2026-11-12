"use client"

import { createContext, useContext, useState } from "react"
import { Check } from "lucide-react"
import { ParticleAvatar, ParticleButton as Button } from "@/components/ui/particle-ui"
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from "@/components/ui/command"
import { assigneeMatches, type ParticleAssignee } from "../lib/particle-assignees"
import { EMPTY_RESPONSIBILITY, supportsParticleResponsibility, type ParticleResponsibility } from "../lib/particle-responsibility"
import type { Particle } from "../types"

/** Supplied by the authenticated team reader; contacts are not assignment options. */
export const ParticleResponsibilityPeople = createContext<readonly ParticleAssignee[] | null>(null)
export const ParticleResponsibilityPeopleState = createContext<{ error: string | null; retry?: () => void }>({ error: null })

export function ParticleResponsibilityFields({ particle, disabled, onChange }: {
  particle: Particle
  disabled: boolean
  onChange: (particle: Particle) => void
}) {
  if (!supportsParticleResponsibility(particle)) return null
  return <ParticleResponsibilitySelector value={particle.responsibility ?? EMPTY_RESPONSIBILITY} disabled={disabled}
    onChange={responsibility => onChange({ ...particle, responsibility })} />
}

export function ParticleResponsibilitySelector({ value, disabled, onChange }: {
  value: ParticleResponsibility
  disabled: boolean
  onChange: (value: ParticleResponsibility) => void
}) {
  const people = useContext(ParticleResponsibilityPeople)
  const { error, retry } = useContext(ParticleResponsibilityPeopleState)
  const [query, setQuery] = useState("")
  const selected = [...(value.ownerId ? [value.ownerId] : []), ...value.contributorIds]
  const matching = (people ?? []).filter(person => `${person.name} ${person.email ?? ""}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))
  const remove = (id: string) => {
    const remaining = selected.filter(item => item !== id)
    onChange({ ...value, ownerId: remaining[0] ?? null, contributorIds: remaining.slice(1) })
  }
  const toggle = (person: ParticleAssignee) => {
    const existing = selected.find(id => assigneeMatches(person, id))
    if (existing) return remove(existing)
    if (selected.length >= 51) return
    onChange(value.ownerId ? { ...value, contributorIds: [...value.contributorIds, person.id] }
      : { ...value, ownerId: person.id, contributorIds: value.contributorIds.filter(id => id !== person.id) })
  }
  const unavailable = people === null ? [] : selected.filter(id => !people.some(person => assigneeMatches(person, id)))
  return <div className="space-y-2" role="group" aria-label="Assign">
    <Command shouldFilter={false} className="rounded-lg border border-border bg-transparent">
      <CommandInput aria-label="Search team" placeholder="Search team…" value={query} onValueChange={setQuery} disabled={disabled || people === null} />
      <CommandList className="max-h-48">
        <CommandEmpty>{error ? "Team unavailable." : people === null ? "Loading team…" : query ? "No teammates found." : "No team members available."}</CommandEmpty>
        <CommandGroup>
          {matching.map(person => {
            const checked = selected.some(id => assigneeMatches(person, id))
            return <CommandItem key={person.id} value={person.id} aria-checked={checked} disabled={disabled || (!checked && selected.length >= 51)} onSelect={() => toggle(person)}>
              <span aria-hidden><ParticleAvatar className="particle-ui shrink-0" size={20} name={person.name} /></span>
              <span className="min-w-0 flex-1 truncate">{person.name}</span>
              {person.invited && <span className="text-xs text-muted-foreground">Invited</span>}
              {checked && <Check aria-hidden className="size-4 shrink-0" />}
            </CommandItem>
          })}
          {unavailable.map(id => <CommandItem key={id} value={id} aria-checked="true" disabled={disabled} onSelect={() => remove(id)}>
            <span className="min-w-0 flex-1 truncate">Unavailable teammate</span><Check aria-hidden className="size-4 shrink-0" />
          </CommandItem>)}
        </CommandGroup>
      </CommandList>
    </Command>
    {error && <div role="alert" className="flex items-center justify-between gap-2 text-xs"><span>{error}</span>{retry && <Button color="secondary" size="sm" variant="ghost" onClick={retry}>Retry</Button>}</div>}
  </div>
}
