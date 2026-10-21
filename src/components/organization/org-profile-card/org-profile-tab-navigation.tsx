"use client"

import type BuildingIcon from "lucide-react/dist/esm/icons/building-2"

import { TabsList, TabsTrigger } from "@/components/ui/tabs"

import type { ProfileTab } from "./types"

export type OrgProfileTabOption = {
  value: ProfileTab
  label: string
  icon: typeof BuildingIcon
}

type OrgProfileTabNavigationProps = {
  tabs: OrgProfileTabOption[]
  tabsIdBase: string
}

export function OrgProfileTabNavigation({
  tabs,
  tabsIdBase,
}: OrgProfileTabNavigationProps) {
  return (
    <div
      className="mx-auto w-fit max-w-full rounded-full border border-border bg-[color-mix(in_srgb,var(--muted)_88%,var(--card))] p-1"
    >
      <TabsList
        data-tour="org-profile-tabs"
        className="h-8 max-w-full justify-start gap-1.5 overflow-x-auto overscroll-x-contain rounded-full bg-transparent p-0 [scrollbar-width:none] data-[orientation=horizontal]:h-8 [&::-webkit-scrollbar]:hidden [@media(pointer:coarse)]:data-[orientation=horizontal]:h-11"
      >
        {tabs.map((item) => (
          <TabsTrigger
            key={item.value}
            value={item.value}
            id={`${tabsIdBase}-trigger-${item.value}`}
            aria-controls={`${tabsIdBase}-content-${item.value}`}
            className="h-8 flex-none touch-manipulation rounded-full border-0 !bg-transparent px-3 py-0 text-foreground !shadow-none transition-colors duration-150 after:hidden hover:!bg-[color-mix(in_srgb,var(--foreground)_10%,var(--muted))] data-[state=active]:!bg-[color-mix(in_srgb,var(--foreground)_10%,var(--muted))] dark:text-foreground motion-reduce:transition-none [@media(pointer:coarse)]:h-11 [@media(pointer:coarse)]:min-w-11"
          >
            <item.icon className="h-4 w-4" aria-hidden />
            {item.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </div>
  )
}
