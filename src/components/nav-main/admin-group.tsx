"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import ChevronRightIcon from "lucide-react/dist/esm/icons/chevron-right"

import { Button } from "@/components/ui/button"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar"
import { resolvePrototypeLabSidebarOpenFolderIds } from "@/lib/prototype-lab-sidebar-tree"
import { cn } from "@/lib/utils"
import { buildMainNavItemReactGrabProps, type NavMainItem } from "./item"
import { PrototypeTreeEntry } from "./prototype-tree-entry"
import { PrototypeTreeFolder } from "./prototype-tree-folder"

function NavMainTreeSubItem({
  activeEntryId,
  isActive,
  item,
  onPrefetch,
}: {
  activeEntryId: string
  isActive: boolean
  item: NavMainItem
  onPrefetch?: (href: string | null | undefined) => void
}) {
  const defaultOpenFolderIds =
    resolvePrototypeLabSidebarOpenFolderIds(activeEntryId)
  const [treeOpen, setTreeOpen] = useState(isActive)
  const reactGrabProps = buildMainNavItemReactGrabProps(item)

  useEffect(() => {
    if (isActive) setTreeOpen(true)
  }, [isActive])

  return (
    <Collapsible open={treeOpen} onOpenChange={setTreeOpen}>
      <SidebarMenuSubItem>
        <div className="relative">
          <SidebarMenuSubButton
            asChild
            isActive={isActive}
            className="h-8 pr-8"
            {...reactGrabProps.ownerProps}
          >
            <Link
              href={item.href ?? "#"}
              prefetch={true}
              title={item.title}
              onFocus={() => onPrefetch?.(item.href ?? null)}
              onPointerEnter={() => onPrefetch?.(item.href ?? null)}
            >
              {item.icon ? <item.icon className="size-4 shrink-0" /> : null}
              <span>{item.title}</span>
            </Link>
          </SidebarMenuSubButton>
          <CollapsibleTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={
                treeOpen ? `Collapse ${item.title}` : `Expand ${item.title}`
              }
              className="absolute top-0 right-0 size-8 rounded-md"
            >
              <ChevronRightIcon
                className={cn(
                  "size-3.5 transition-transform",
                  treeOpen && "rotate-90"
                )}
                aria-hidden
              />
            </Button>
          </CollapsibleTrigger>
        </div>
        <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-[accordion-up_140ms_ease-out] data-[state=open]:animate-[accordion-down_160ms_ease-out] motion-reduce:data-[state=closed]:animate-none motion-reduce:data-[state=open]:animate-none">
          <SidebarMenuSub className="mt-1 ml-3 w-[calc(100%-12px)]">
            {item.tree?.map((node) =>
              node.kind === "folder" ? (
                <PrototypeTreeFolder
                  key={node.id}
                  activeEntryId={activeEntryId}
                  defaultOpenFolderIds={defaultOpenFolderIds}
                  node={node}
                  onPrefetch={onPrefetch}
                />
              ) : (
                <PrototypeTreeEntry
                  key={node.id}
                  href={node.href}
                  isActive={node.id === activeEntryId}
                  label={node.label}
                  onPrefetch={onPrefetch}
                />
              )
            )}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuSubItem>
    </Collapsible>
  )
}

export function NavMainGroupItem({
  activeHref,
  activeEntryId,
  item,
  onPrefetch,
}: {
  activeHref: string | null
  activeEntryId: string
  item: NavMainItem
  onPrefetch?: (href: string | null | undefined) => void
}) {
  const isActive =
    item.href === activeHref ||
    (item.children?.some((child) => child.href === activeHref) ?? false)
  const [open, setOpen] = useState(isActive)
  const reactGrabProps = buildMainNavItemReactGrabProps(item)

  useEffect(() => {
    if (isActive) setOpen(true)
  }, [isActive])

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <SidebarMenuItem>
        <div className="relative">
          <SidebarMenuButton
            asChild
            isActive={isActive}
            tooltip={reactGrabProps.tooltipProps}
            className="justify-start gap-2 pr-11 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:gap-0 md:pr-8"
            {...reactGrabProps.ownerProps}
          >
            <Link
              href={item.href ?? "#"}
              prefetch
              onFocus={() => onPrefetch?.(item.href)}
              onPointerEnter={() => onPrefetch?.(item.href)}
            >
              {item.icon ? <item.icon className="size-4 shrink-0" /> : null}
              <span className="min-w-0 flex-1 truncate leading-snug whitespace-nowrap group-data-[collapsible=icon]:hidden">
                {item.title}
              </span>
            </Link>
          </SidebarMenuButton>
          <CollapsibleTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={
                open ? `Collapse ${item.title}` : `Expand ${item.title}`
              }
              className="absolute top-0 right-0 size-11 rounded-md group-data-[collapsible=icon]:hidden md:size-8"
            >
              <ChevronRightIcon
                className={cn(
                  "size-3.5 transition-transform motion-reduce:transition-none",
                  open && "rotate-90"
                )}
                aria-hidden
              />
            </Button>
          </CollapsibleTrigger>
        </div>
        <CollapsibleContent className="overflow-hidden group-data-[collapsible=icon]:hidden data-[state=closed]:animate-[accordion-up_140ms_ease-out] data-[state=open]:animate-[accordion-down_160ms_ease-out] motion-reduce:data-[state=closed]:animate-none motion-reduce:data-[state=open]:animate-none">
          <SidebarMenuSub className="mt-1">
            {item.children?.map((child) => {
              const childIsActive = child.href === activeHref

              if (child.tree?.length) {
                return (
                  <NavMainTreeSubItem
                    key={child.title}
                    activeEntryId={activeEntryId}
                    isActive={childIsActive}
                    item={child}
                    onPrefetch={onPrefetch}
                  />
                )
              }

              const childReactGrabProps = buildMainNavItemReactGrabProps(child)
              return (
                <SidebarMenuSubItem key={child.title}>
                  <SidebarMenuSubButton
                    asChild
                    isActive={childIsActive}
                    className="h-8"
                    {...childReactGrabProps.ownerProps}
                  >
                    <Link
                      href={child.href ?? "#"}
                      prefetch={true}
                      title={child.title}
                      onFocus={() => onPrefetch?.(child.href ?? null)}
                      onPointerEnter={() => onPrefetch?.(child.href ?? null)}
                    >
                      {child.icon ? (
                        <child.icon className="size-4 shrink-0" />
                      ) : null}
                      <span>{child.title}</span>
                    </Link>
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
              )
            })}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  )
}
