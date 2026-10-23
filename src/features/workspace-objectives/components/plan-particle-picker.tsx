"use client"
import { useState } from "react"
import { Plus, FileText } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from "@/components/ui/command"
import { PARTICLE_PRESETS, particleRegistry, type Particle, type ParticlePreset } from "@/features/workspace-particles/client"

export function PlanParticlePicker({ particles, excluded, pending, onAdd, onCreate, label = "Add to plan" }: {
  particles: Particle[]; excluded: string[]; pending: boolean; label?: string
  onAdd: (particle: Particle) => Promise<boolean>; onCreate: (preset: ParticlePreset) => Promise<boolean>
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [busy, setBusy] = useState(false)
  const choose = async (action: () => Promise<boolean>) => {
    if (busy || pending) return
    setBusy(true)
    try { if (await action()) { setOpen(false); setQuery("") } }
    finally { setBusy(false) }
  }
  return <Popover open={open} onOpenChange={setOpen}>
    <PopoverTrigger asChild><Button variant="ghost" size="sm" className="w-fit rounded-full" disabled={pending}><Plus aria-hidden />{label}</Button></PopoverTrigger>
    <PopoverContent align="start" className="w-[min(360px,calc(100vw-32px))] overflow-hidden rounded-2xl p-1 shadow-none" onEscapeKeyDown={event => event.stopPropagation()}>
      <Command aria-label="Add a particle to this plan" aria-busy={busy} className="rounded-xl">
        <CommandInput value={query} onValueChange={setQuery} placeholder="Search or create…" />
        <CommandList className="max-h-80 overscroll-contain">
          <CommandEmpty>No matches.</CommandEmpty>
          <CommandGroup heading="On this workspace">
            {particles.filter(item => !excluded.includes(item.id) && item.type !== "objective").map(item => <CommandItem key={item.id} value={`${item.id} ${item.title} ${particleRegistry[item.type].label}`} disabled={pending || busy} onSelect={() => void choose(() => onAdd(item))} className="min-h-11 gap-3 rounded-xl">
              <FileText className="size-4 text-muted-foreground" aria-hidden /><span className="min-w-0 truncate">{item.title}</span>
            </CommandItem>)}
          </CommandGroup>
          <CommandGroup heading="Create">
            {PARTICLE_PRESETS.filter(item => item.type !== "objective").map(preset => <CommandItem key={preset.id} value={`new ${preset.label} ${preset.hint}`} disabled={pending || busy} className="min-h-11 gap-3 rounded-xl" onSelect={() => void choose(() => onCreate(preset))}>
              <Plus className="size-4 text-muted-foreground" aria-hidden /><span>New {preset.label.toLowerCase()}</span>
            </CommandItem>)}
          </CommandGroup>
        </CommandList>
      </Command>
    </PopoverContent>
  </Popover>
}
