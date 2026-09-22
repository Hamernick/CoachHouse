"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"

import ArrowUpRightIcon from "lucide-react/dist/esm/icons/arrow-up-right"
import ChevronDownIcon from "lucide-react/dist/esm/icons/chevron-down"
import ChevronRightIcon from "lucide-react/dist/esm/icons/chevron-right"
import {
  resolvePrototypeLabSidebarActiveEntryId,
  resolvePrototypeLabSidebarOpenFolderIds,
  type PrototypeLabSidebarTreeNode,
} from "@/lib/prototype-lab-sidebar-tree"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
} from "@/components/ui/sidebar"
import { useInternalRoutePrefetch } from "@/hooks/use-internal-route-prefetch"
import { cn } from "@/lib/utils"
import { NavMainGroupItem } from "./nav-main/admin-group"
import {
  buildMainNavItemReactGrabProps,
  type NavMainItem,
} from "./nav-main/item"
import { PrototypeTreeEntry } from "./nav-main/prototype-tree-entry"
import { PrototypeTreeFolder } from "./nav-main/prototype-tree-folder"

function collectPrototypeTreePrefetchHrefs(
  nodes: PrototypeLabSidebarTreeNode[]
) {
  return nodes.flatMap((node): string[] =>
    node.kind === "folder"
      ? collectPrototypeTreePrefetchHrefs(node.children)
      : [node.href]
  )
}

function collectNavMainPrefetchHrefs(
  items: NavMainItem[]
): Array<string | undefined> {
  return items.flatMap((item) => [
    item.href,
    item.upgradeHref,
    ...(item.children ? collectNavMainPrefetchHrefs(item.children) : []),
    ...(item.tree ? collectPrototypeTreePrefetchHrefs(item.tree) : []),
  ])
}

function flattenNavMainItems(items: NavMainItem[]): NavMainItem[] {
  return items.flatMap((item) => [
    item,
    ...(item.children ? flattenNavMainItems(item.children) : []),
  ])
}

function NavMainTreeItem({
  activeEntryId,
  isActive,
  item,
  onPrefetch,
  tourId,
}: {
  activeEntryId: string
  isActive: boolean
  item: NavMainItem
  onPrefetch?: (href: string | null | undefined) => void
  tourId?: string
}) {
  const defaultOpenFolderIds =
    resolvePrototypeLabSidebarOpenFolderIds(activeEntryId)
  const [treeOpen, setTreeOpen] = useState(isActive)
  const previousIsActiveRef = useRef(isActive)
  const isTreeExpanded = isActive && treeOpen
  const reactGrabProps = buildMainNavItemReactGrabProps(item)

  useEffect(() => {
    if (!previousIsActiveRef.current && isActive) {
      setTreeOpen(true)
    }
    previousIsActiveRef.current = isActive
  }, [isActive])

  return (
    <Collapsible open={isTreeExpanded} onOpenChange={setTreeOpen}>
      <SidebarMenuItem>
        <SidebarMenuButton
          asChild
          isActive={isActive}
          tooltip={reactGrabProps.tooltipProps}
          className="justify-start gap-2 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:gap-0"
          {...reactGrabProps.ownerProps}
        >
          <Link
            href={item.href ?? "#"}
            prefetch={true}
            title={item.title}
            data-tour={tourId}
            className="flex w-full items-center gap-2"
            onFocus={() => onPrefetch?.(item.href ?? null)}
            onPointerEnter={() => onPrefetch?.(item.href ?? null)}
          >
            {item.icon ? <item.icon className="size-4 shrink-0" /> : null}
            <span className="min-w-0 flex-1 truncate leading-snug whitespace-nowrap group-data-[collapsible=icon]:hidden">
              {item.title}
            </span>
            {item.href === "/roadmap" ? (
              <ArrowUpRightIcon
                className="text-muted-foreground ml-auto size-3.5 shrink-0 group-data-[collapsible=icon]:hidden"
                aria-hidden
              />
            ) : null}
          </Link>
        </SidebarMenuButton>
        <SidebarMenuAction asChild>
          <CollapsibleTrigger
            aria-label={
              isTreeExpanded ? `Collapse ${item.title}` : `Expand ${item.title}`
            }
            className="group-data-[collapsible=icon]:hidden"
          >
            {isTreeExpanded ? (
              <ChevronDownIcon
                className="text-muted-foreground size-3.5"
                aria-hidden
              />
            ) : (
              <ChevronRightIcon
                className="text-muted-foreground size-3.5"
                aria-hidden
              />
            )}
          </CollapsibleTrigger>
        </SidebarMenuAction>
        <CollapsibleContent className="overflow-hidden group-data-[collapsible=icon]:hidden data-[state=closed]:animate-[accordion-up_140ms_ease-out] data-[state=open]:animate-[accordion-down_160ms_ease-out] motion-reduce:data-[state=closed]:animate-none motion-reduce:data-[state=open]:animate-none">
          <SidebarMenuSub className="mt-1">
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
      </SidebarMenuItem>
    </Collapsible>
  )
}

export function NavMain({
  items,
  label,
  className,
}: {
  items: NavMainItem[]
  label?: string
  className?: string
}) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const prefetchHrefs = useMemo(
    () => collectNavMainPrefetchHrefs(items),
    [items]
  )
  const prefetchHref = useInternalRoutePrefetch(prefetchHrefs)
  const isWorkspaceHref = (href: string) =>
    href === "/workspace" ||
    href === "/organization" ||
    href === "/organization/workspace"
  const matchesAliasWorkspacePath = (href: string, currentPath: string) => {
    if (!isWorkspaceHref(href)) return false
    return (
      currentPath === "/organization" ||
      currentPath.startsWith("/organization/workspace")
    )
  }

  const flattenedItems = useMemo(() => flattenNavMainItems(items), [items])
  const activeHref = pathname
    ? flattenedItems.reduce<string | null>((current, item) => {
        if (!item.href) return current
        const matches =
          pathname === item.href ||
          pathname.startsWith(`${item.href}/`) ||
          matchesAliasWorkspacePath(item.href, pathname)
        if (!matches) return current
        if (!current || item.href.length > current.length) return item.href
        return current
      }, null)
    : null
  const prototypeActiveEntryId = resolvePrototypeLabSidebarActiveEntryId(
    searchParams.get("entry")
  )

  return (
    <SidebarGroup className={cn("py-0", className)}>
      {label ? <SidebarGroupLabel>{label}</SidebarGroupLabel> : null}
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => {
            const isActive = Boolean(item.href && item.href === activeHref)
            const isOrganizationItem = Boolean(
              item.href && isWorkspaceHref(item.href)
            )
            const reactGrabProps = buildMainNavItemReactGrabProps(item)
            const tourId = isOrganizationItem
              ? "nav-organization"
              : item.href === "/organization/documents"
                ? "nav-documents"
                : item.href === "/roadmap"
                  ? "nav-roadmap"
                  : undefined

            if (item.children?.length) {
              return (
                <NavMainGroupItem
                  key={item.title}
                  activeHref={activeHref}
                  activeEntryId={prototypeActiveEntryId}
                  item={item}
                  onPrefetch={prefetchHref}
                />
              )
            }

            if (!item.href || item.locked) {
              return (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    tooltip={reactGrabProps.tooltipProps}
                    className="cursor-default justify-start gap-2 opacity-90 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:gap-0 hover:bg-transparent"
                    {...reactGrabProps.ownerProps}
                  >
                    <div
                      aria-disabled
                      className="flex w-full items-center gap-2"
                    >
                      {item.icon ? (
                        <item.icon className="size-4 shrink-0" />
                      ) : null}
                      <span className="min-w-0 flex-1 truncate leading-snug whitespace-nowrap group-data-[collapsible=icon]:hidden">
                        {item.title}
                      </span>
                      <span className="ml-auto flex shrink-0 items-center gap-1.5 group-data-[collapsible=icon]:hidden">
                        {item.upgradeHref ? (
                          <Link
                            href={item.upgradeHref}
                            prefetch={true}
                            onClick={(event) => event.stopPropagation()}
                            onFocus={() => prefetchHref(item.upgradeHref)}
                            onPointerEnter={() =>
                              prefetchHref(item.upgradeHref)
                            }
                            className="border-border/60 bg-background text-foreground hover:bg-muted inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium transition"
                          >
                            {item.upgradeLabel ?? item.badge ?? "Upgrade"}
                          </Link>
                        ) : item.badge ? (
                          <span className="border-border/60 bg-muted/50 text-muted-foreground inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium">
                            {item.badge}
                          </span>
                        ) : null}
                      </span>
                    </div>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )
            }

            if (item.tree?.length) {
              return (
                <NavMainTreeItem
                  key={item.title}
                  activeEntryId={prototypeActiveEntryId}
                  isActive={isActive}
                  item={item}
                  onPrefetch={prefetchHref}
                  tourId={tourId}
                />
              )
            }

            return (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton
                  asChild
                  isActive={isActive}
                  tooltip={reactGrabProps.tooltipProps}
                  className="justify-start gap-2 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:gap-0"
                  {...reactGrabProps.ownerProps}
                >
                  <Link
                    href={item.href}
                    prefetch={true}
                    title={item.title}
                    data-tour={tourId}
                    className="flex w-full items-center gap-2"
                    onFocus={() => prefetchHref(item.href)}
                    onPointerEnter={() => prefetchHref(item.href)}
                  >
                    {item.icon ? (
                      <item.icon className="size-4 shrink-0" />
                    ) : null}
                    <span className="min-w-0 flex-1 truncate leading-snug whitespace-nowrap group-data-[collapsible=icon]:hidden">
                      {item.title}
                    </span>
                    <span className="ml-auto flex shrink-0 items-center gap-2 group-data-[collapsible=icon]:hidden">
                      {item.href === "/roadmap" ? (
                        <ArrowUpRightIcon
                          className="text-muted-foreground size-3.5"
                          aria-hidden
                        />
                      ) : null}
                    </span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
