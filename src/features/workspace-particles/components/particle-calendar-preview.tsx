"use client"

import { particlePreviewLimit } from "../lib/particle-registry"
import { useEffect, useState } from "react"
import MailIcon from "lucide-react/dist/esm/icons/mail"
import LinkedinIcon from "lucide-react/dist/esm/icons/linkedin"
import GlobeIcon from "lucide-react/dist/esm/icons/globe"
import InstagramIcon from "lucide-react/dist/esm/icons/instagram"
import FileTextIcon from "lucide-react/dist/esm/icons/file-text"
import CircleIcon from "lucide-react/dist/esm/icons/circle"
import ClockIcon from "lucide-react/dist/esm/icons/clock"
import CircleCheckIcon from "lucide-react/dist/esm/icons/circle-check"
import BanIcon from "lucide-react/dist/esm/icons/ban"
import { Button } from "@/components/ui/button"
import {
  CALENDAR_CHANNELS,
  CALENDAR_STATUSES,
  calendarChronologicalOrder,
} from "../lib/particle-calendar"
import type { ParticlePreviewProps } from "./particle-preview"
import { ParticleProgress } from "./particle-frame"
import { useParticleSurface } from "./particle-surface"

const CHANNEL_ICONS = {
  email: MailIcon,
  linkedin: LinkedinIcon,
  website: GlobeIcon,
  instagram: InstagramIcon,
  other: FileTextIcon,
}
const STATUS_ICONS = {
  draft: CircleIcon,
  scheduled: ClockIcon,
  published: CircleCheckIcon,
  cancelled: BanIcon,
}

function EntryDate({ instant }: { instant: string | null }) {
  const [localized, setLocalized] = useState<{
    instant: string
    label: string
  } | null>(null)
  useEffect(() => {
    if (instant)
      setLocalized({
        instant,
        label: new Intl.DateTimeFormat(undefined, {
          month: "short",
          day: "numeric",
        }).format(new Date(instant)),
      })
  }, [instant])
  return instant ? (
    <time dateTime={instant}>
      {localized?.instant === instant ? localized.label : instant.slice(5, 10)}
    </time>
  ) : (
    <>Unscheduled</>
  )
}

export function ParticleCalendarPreview({
  particle,
  onOpen,
}: ParticlePreviewProps) {
  const surface = useParticleSurface()
  if (particle.type !== "calendar") return null
  const limit = particlePreviewLimit(particle)
  const entries = calendarChronologicalOrder(particle.data.entries)
  const complete = entries.filter(
    (entry) => entry.status === "published"
  ).length
  return (
    <div className="flex flex-col gap-2">
      <ParticleProgress
        value={entries.length ? (complete / entries.length) * 100 : 0}
        label={`${entries.length} items · ${complete} published`}
      />
      {entries.slice(0, limit).map((entry) => {
        const Icon = CHANNEL_ICONS[entry.channels[0] ?? "other"]
        const StatusIcon = STATUS_ICONS[entry.status]
        const channels = entry.channels
          .map(
            (value) =>
              CALENDAR_CHANNELS.find((channel) => channel.value === value)
                ?.label
          )
          .join(", ")
        const status = CALENDAR_STATUSES.find(
          (item) => item.value === entry.status
        )?.label
        return (
          <Button
            key={entry.id}
            type="button"
            variant="ghost"
            {...surface()}
            aria-label={`Open ${entry.title}, ${channels}, ${status}`}
            title={`${channels} · ${status}`}
            className="nodrag nopan h-auto min-h-11 justify-start gap-2 px-0 text-left text-xs whitespace-normal"
            onClick={() => onOpen(entry.id)}
          >
            <Icon className="size-4 shrink-0" aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="block truncate">{entry.title}</span>
              <span className="text-muted-foreground text-[11px]">
                {entry.delivery === "automatic" ? "Auto · " : ""}
                <EntryDate instant={entry.scheduledAt} />
              </span>
            </span>
            <StatusIcon className="size-3.5 shrink-0" aria-hidden />
          </Button>
        )
      })}
      {!entries.length ? (
        <p className="text-muted-foreground text-xs">No content planned yet.</p>
      ) : null}
      {entries.length > limit ? (
        <p className="text-muted-foreground text-xs">
          {entries.length - limit} more entries
        </p>
      ) : null}
    </div>
  )
}
