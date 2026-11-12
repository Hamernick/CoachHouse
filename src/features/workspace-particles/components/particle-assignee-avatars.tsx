"use client"

import { Plus } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { assigneeMatches, type ParticleAssignee } from "../lib/particle-assignees"

/** Same overlapping, tinted initials treatment as the workspace team header. */
export function ParticleAssigneeAvatars({ ids, people }: { ids: string[]; people: readonly ParticleAssignee[] | null }) {
  const unique = [...new Map(ids.map(id => {
    const person = people?.find(item => assigneeMatches(item, id))
    return [person?.id ?? id, { id: person?.id ?? id, name: person?.name ?? "Unavailable teammate", avatarUrl: person?.avatarUrl }]
  })).values()]
  if (!unique.length) return <span className="flex size-7 items-center justify-center rounded-full bg-white text-muted-foreground dark:bg-muted"><Plus aria-hidden className="size-4" /></span>
  return <span className="flex [&>*+*]:-ml-2">
    {unique.slice(0, 4).map(person => {
      let hash = 0
      for (let index = 0; index < person.id.length; index += 1) hash = ((hash << 5) - hash + person.id.charCodeAt(index)) | 0
      const hue = Math.abs(hash) % 360
      const parts = person.name.trim().split(/\s+/).filter(Boolean)
      const initials = person.name === "Unavailable teammate" ? "?" : (parts.length > 1 ? `${parts[0][0]}${parts.at(-1)![0]}` : parts[0]?.slice(0, 2) ?? "?").toUpperCase()
      return <Avatar key={person.id} className="border-card size-7 border-2" title={person.name}>
        {person.avatarUrl && <AvatarImage src={person.avatarUrl} alt="" />}
        <AvatarFallback className="text-[10px] font-semibold" style={{ backgroundColor: `hsl(${hue} 28% 88%)`, color: `hsl(${hue} 32% 26%)` }}>{initials}</AvatarFallback>
        <span className="sr-only">{person.name}</span>
      </Avatar>
    })}
    {unique.length > 4 && <span className="border-card bg-muted text-muted-foreground flex size-7 items-center justify-center rounded-full border-2 text-[10px] font-semibold" aria-label={`${unique.length - 4} more assignees`}>+{unique.length - 4}</span>}
  </span>
}
