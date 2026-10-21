"use client"

import { useState } from "react"
import Link from "next/link"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar"
import { type NavMainItem } from "./item"

export function CollapsedNavGroupMenu({
  item,
  activeHref,
  isActive,
  onPrefetch,
}: {
  item: NavMainItem
  activeHref: string | null
  isActive: boolean
  onPrefetch?: (href: string | null | undefined) => void
}) {
  const [open, setOpen] = useState(false)
  function renderDestination(destination: NavMainItem) {
    if (!destination.href || destination.locked) {
      return <DropdownMenuItem key={destination.title} disabled>{destination.title}</DropdownMenuItem>
    }
    return (
      <DropdownMenuItem key={destination.href} asChild>
        <Link
          href={destination.href}
          prefetch
          aria-current={destination.href === activeHref ? "page" : undefined}
          onFocus={() => onPrefetch?.(destination.href)}
          onPointerEnter={() => onPrefetch?.(destination.href)}
        >
          {destination.icon ? <destination.icon /> : null}
          <span>{destination.title}</span>
        </Link>
      </DropdownMenuItem>
    )
  }

  return (
    <SidebarMenuItem>
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <SidebarMenuButton
            type="button"
            isActive={isActive}
            aria-label={`${item.title} menu`}
            tooltip={{ children: item.title, hidden: open }}

          >
            {item.icon ? <item.icon /> : null}
            <span className="sr-only">{item.title}</span>
          </SidebarMenuButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          side="right"
          align="start"
          sideOffset={8}
          className="w-56"
          aria-label={`${item.title} navigation`}

        >
          {item.href ? (
            <>
              <DropdownMenuGroup>{renderDestination(item)}</DropdownMenuGroup>
              <DropdownMenuSeparator />
            </>
          ) : null}
          <DropdownMenuGroup>
            {item.children?.map(renderDestination)}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </SidebarMenuItem>
  )
}
