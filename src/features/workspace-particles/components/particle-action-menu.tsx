"use client"

import { useRef } from "react"
import PencilIcon from "lucide-react/dist/esm/icons/pencil"
import ExpandIcon from "lucide-react/dist/esm/icons/expand"
import CopyIcon from "lucide-react/dist/esm/icons/copy"
import LockIcon from "lucide-react/dist/esm/icons/lock"
import UnlockIcon from "lucide-react/dist/esm/icons/lock-open"
import MinusIcon from "lucide-react/dist/esm/icons/minus"
import RulerIcon from "lucide-react/dist/esm/icons/ruler"
import ShareIcon from "lucide-react/dist/esm/icons/share-2"
import {
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { PARTICLE_SIZES, supportedParticleSizes } from "../lib/particle-size"
import type { ParticleNodeData } from "./particle-node"
import { ParticleMenuOverlay } from "./particle-menu-overlay"

const ITEM = "min-h-9 rounded-lg px-2.5 gap-2.5 [@media(hover:none)]:min-h-11"
const PANEL =
  "nodrag nopan nowheel w-52 rounded-2xl p-1.5 shadow-none motion-reduce:animate-none"

export function ParticleActionMenu({
  data,
  selected,
  onPreview,
}: {
  data: ParticleNodeData
  selected: boolean
  onPreview?: () => void
}) {
  const { particle, onAction, editable } = data
  const openingInspector = useRef(false)
  const disabled = !editable || !onAction
  const Lock = particle.locked ? UnlockIcon : LockIcon
  const sizes = supportedParticleSizes(particle)
  const size = particle.size ?? ""
  if (!editable)
    return onPreview ? (
      <ParticleMenuOverlay
        title={particle.title}
        selected={selected}
        onCloseAutoFocus={(event) => event.preventDefault()}
      >
        <DropdownMenuItem className={ITEM} onSelect={onPreview}>
          <ExpandIcon aria-hidden />
          Full screen
        </DropdownMenuItem>
      </ParticleMenuOverlay>
    ) : null
  return (
    <ParticleMenuOverlay
      title={particle.title}
      selected={selected}
      onOpen={() => {
        openingInspector.current = false
      }}
      onCloseAutoFocus={(event) => {
        if (openingInspector.current) event.preventDefault()
      }}
    >
      <DropdownMenuGroup>
        {onPreview && (
          <DropdownMenuItem
            className={ITEM}
            onSelect={() => {
              openingInspector.current = true
              onPreview()
            }}
          >
            <ExpandIcon aria-hidden />
            Full screen
          </DropdownMenuItem>
        )}
        <DropdownMenuItem
          className={ITEM}
          onSelect={() => {
            openingInspector.current = true
            data.onOpen(particle.id)
          }}
        >
          <PencilIcon aria-hidden />
          {editable ? "Edit details…" : "View details…"}
        </DropdownMenuItem>
        <DropdownMenuItem
          className={ITEM}
          disabled={disabled}
          onSelect={() => void onAction?.(particle.id, "duplicate")}
        >
          <CopyIcon aria-hidden />
          Duplicate
        </DropdownMenuItem>
        <DropdownMenuItem className={ITEM} onSelect={() => {
          openingInspector.current = true
          data.onOpen(particle.id, { view: "share" })
        }}>
          <ShareIcon aria-hidden />Share…
        </DropdownMenuItem>
      </DropdownMenuGroup>
      <DropdownMenuSeparator />
      <DropdownMenuGroup>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger
            className={ITEM}
            disabled={disabled || particle.locked}
          >
            <RulerIcon aria-hidden className="text-muted-foreground size-4" />
            Size
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className={cn(PANEL, "w-40")}>
            <DropdownMenuRadioGroup
              value={size}
              onValueChange={(value) => {
                const choice = sizes.find((size) => size === value)
                if (choice) void onAction?.(particle.id, `family_${choice}`)
              }}
            >
              {sizes.map((item) => (
                <DropdownMenuRadioItem
                  key={item}
                  value={item}
                  className="min-h-9 rounded-lg [@media(hover:none)]:min-h-11"
                >
                  {PARTICLE_SIZES[item].label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuItem
          className={ITEM}
          disabled={disabled}
          onSelect={() =>
            void onAction?.(particle.id, particle.locked ? "unlock" : "lock")
          }
        >
          <Lock aria-hidden />
          {particle.locked ? "Unlock position" : "Lock position"}
        </DropdownMenuItem>
      </DropdownMenuGroup>
      <DropdownMenuSeparator />
      <DropdownMenuItem
        className={ITEM}
        disabled={disabled}
        onSelect={() => void onAction?.(particle.id, "remove")}
      >
        <MinusIcon aria-hidden />
        Remove from canvas
      </DropdownMenuItem>
    </ParticleMenuOverlay>
  )
}
