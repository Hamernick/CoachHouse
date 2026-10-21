"use client"

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react"
import EllipsisIcon from "lucide-react/dist/esm/icons/ellipsis"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { useParticleSurface } from "./particle-surface"

type MenuState = { open: boolean; setOpen: (open: boolean) => void }
const MenuContext = createContext<MenuState | null>(null)
export function ParticleMenuProvider({ value, children }: { value: MenuState; children: ReactNode }) {
  return <MenuContext.Provider value={value}>{children}</MenuContext.Provider>
}

export function ParticleMenuOverlay({
  title,
  selected = false,
  children,
  onOpen,
  onCloseAutoFocus,
}: {
  title: string
  selected?: boolean
  children: ReactNode
  onOpen?: () => void
  onCloseAutoFocus?: (event: Event) => void
}) {
  const context = useContext(MenuContext)
  const [localOpen, setLocalOpen] = useState(false)
  const open = context?.open ?? localOpen
  const setOpen = context?.setOpen ?? setLocalOpen
  const opened = useRef(onOpen)
  opened.current = onOpen
  useEffect(() => { if (open) opened.current?.() }, [open])
  const surface = useParticleSurface()
  return (
    <div
      {...surface()}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
      onDoubleClick={(event) => event.stopPropagation()}
      className={cn(
        "nodrag nopan pointer-events-none absolute -top-4 -right-4 z-10 p-1 opacity-0 transition-opacity duration-100 group-focus-within/particle:pointer-events-auto group-focus-within/particle:opacity-100 group-hover/particle:pointer-events-auto group-hover/particle:opacity-100 motion-reduce:transition-none [@media(hover:none)]:pointer-events-auto [@media(hover:none)]:opacity-100",
        (selected || open) && "pointer-events-auto opacity-100"
      )}
    >
      <DropdownMenu
        open={open}
        onOpenChange={(value) => {
          setOpen(value)
        }}
      >
        <DropdownMenuTrigger asChild>
          <Button
            {...surface()}
            type="button"
            variant="secondary"
            size="icon"
            aria-label={`Actions for ${title}`}
            className="size-8 rounded-full border shadow-none transition-none [@media(hover:none)]:size-11"
          >
            <EllipsisIcon aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          {...surface()}
          align="end"
          sideOffset={6}
          collisionPadding={12}
          className="nodrag nopan nowheel w-52 rounded-2xl p-1.5 shadow-none motion-reduce:animate-none"
          onCloseAutoFocus={onCloseAutoFocus}
        >
          {children}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
