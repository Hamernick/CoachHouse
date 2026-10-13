import { cn } from "@/lib/utils"
import type { PublicMapMemberTab } from "./member-rail"

export const PUBLIC_MAP_MEMBER_TABS_LIST_CLASSNAME =
  "mx-auto h-7 w-fit max-w-full min-w-0 justify-center gap-0 self-center p-0"

export const PUBLIC_MAP_MEMBER_TAB_TRIGGER_CLASSNAME =
  "h-7 min-w-0 flex-none rounded-none bg-transparent px-2 py-1 text-center text-xs leading-none text-muted-foreground shadow-none transition-[color] after:pointer-events-none group-data-[orientation=horizontal]/tabs:after:bottom-0 hover:bg-transparent hover:text-foreground data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none dark:data-[state=active]:!bg-transparent [html.light_&]:!text-zinc-700 [html.light_&]:hover:!text-zinc-950 [html.light_&]:data-[state=active]:!text-zinc-950"

export const PUBLIC_MAP_INLINE_TAB_TRIGGER_CLASSNAME =
  "h-11 min-w-16 flex-none touch-manipulation rounded-full border-0 px-3 text-sm text-muted-foreground shadow-none transition-colors hover:bg-accent hover:text-foreground data-[state=active]:bg-accent data-[state=active]:text-foreground data-[state=active]:shadow-none group-data-[variant=default]/tabs-list:data-[state=active]:shadow-none dark:hover:bg-input/50 dark:data-[state=active]:bg-input/50 after:hidden sm:h-8 motion-reduce:transition-none"

export function buildTabPanelProps(tab: PublicMapMemberTab, activeTab: PublicMapMemberTab, persistent: boolean) {
  const inactive = persistent && activeTab !== tab
  return {
    value: tab,
    forceMount: persistent ? true as const : undefined,
    inert: inactive || undefined,
    "aria-hidden": inactive || undefined,
    // Parent opacity suppresses children whose visibility transitions outlive the tab switch.
    style: persistent ? { opacity: inactive ? 0 : 1, transition: "none" } : undefined,
    className: cn(
      "mt-0 flex h-full min-h-0 flex-1 flex-col overflow-hidden",
      persistent && "col-start-1 row-start-1 h-auto self-start data-[state=inactive]:hidden"
    ),
  }
}

