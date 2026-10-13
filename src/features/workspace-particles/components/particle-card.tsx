"use client"

import TargetIcon from "lucide-react/dist/esm/icons/target"
import ListChecksIcon from "lucide-react/dist/esm/icons/list-checks"
import CalendarDaysIcon from "lucide-react/dist/esm/icons/calendar-days"
import UsersIcon from "lucide-react/dist/esm/icons/users"
import GitBranchIcon from "lucide-react/dist/esm/icons/git-branch"
import ChartNoAxesCombinedIcon from "lucide-react/dist/esm/icons/chart-no-axes-combined"
import WalletIcon from "lucide-react/dist/esm/icons/wallet"
import MoreHorizontalIcon from "lucide-react/dist/esm/icons/ellipsis"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu"
import { ParticleRemoveControl } from "./particle-library-tile"
import { cn } from "@/lib/utils"
import { particleRegistry } from "../lib/particle-registry"
import {
  ParticleFrame,
  ParticleHeader,
  ParticleBody,
  ParticleFooter,
} from "./particle-frame"
import { PARTICLE_PREVIEWS } from "./particle-preview"

import type { ParticleNodeData } from "./particle-node"

const ICONS = {
  objective: TargetIcon,
  activity: ListChecksIcon,
  calendar: CalendarDaysIcon,
  people: UsersIcon,
  decision: GitBranchIcon,
  metric: ChartNoAxesCombinedIcon,
  workflow: ListChecksIcon,
  finance: WalletIcon,
}

export function ParticleCard({
  data,
  selected = false,
  controls = true,
}: {
  data: ParticleNodeData
  selected?: boolean
  controls?: boolean
}) {
  const { particle, editable, onOpen, onEdit } = data
  const definition = particleRegistry[particle.type]
  const Icon = ICONS[particle.type]
  const Preview = PARTICLE_PREVIEWS[particle.type]
  const open = () => onOpen(particle.id)
  return (
    <ParticleFrame selected={selected}>
      {controls && data.onRemove && (
        <ParticleRemoveControl
          title={particle.title}
          disabled={!editable}
          onRemove={() => data.onRemove?.(particle.id)}
        />
      )}
      <ParticleHeader
        title={particle.title}
        label={definition.label}
        status={particle.status}
        icon={<Icon className="size-4" />}
      />
      <ParticleBody>
        <Preview
          particle={particle}
          editable={editable}
          onEdit={onEdit}
          onOpen={open}
        />
      </ParticleBody>
      <ParticleFooter>
        <span className="text-muted-foreground">
          {particle.locked ? "Position locked" : definition.label}
        </span>
        <Button
          variant="ghost"
          size="sm"
          className="nodrag nopan min-h-11 px-2 transition-none md:min-h-8"
          onClick={open}
        >
          Open {particle.type === "objective" ? "objective" : "details"}
        </Button>
      </ParticleFooter>
      {controls && (
        <div
          className={cn(
            "nodrag nopan absolute -top-5 -right-2 pt-2 opacity-0 transition-opacity duration-100 group-focus-within/particle:pointer-events-auto group-focus-within/particle:opacity-100 group-hover/particle:pointer-events-auto group-hover/particle:opacity-100 has-[[data-state=open]]:opacity-100 motion-reduce:transition-none [@media(hover:none)]:pointer-events-auto [@media(hover:none)]:opacity-100",
            selected && "pointer-events-auto opacity-100"
          )}
        >
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                aria-label={`Actions for ${particle.title}`}
                size="icon"
                variant="outline"
                className="size-11 rounded-full transition-none md:size-8"
              >
                <MoreHorizontalIcon aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="nodrag nopan">
              <DropdownMenuGroup>
                <DropdownMenuItem onSelect={open}>
                  Edit details
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={!editable}
                  onSelect={() =>
                    onEdit({ ...particle, locked: !particle.locked })
                  }
                >
                  {particle.locked ? "Unlock position" : "Lock position"}
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </ParticleFrame>
  )
}
