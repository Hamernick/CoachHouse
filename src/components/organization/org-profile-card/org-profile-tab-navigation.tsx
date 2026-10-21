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
      data-org-profile-tabs-separator="true"
      className="flex w-full border-b px-6"
    >
      <TabsList
        data-tour="org-profile-tabs"
        variant="line"
        className="text-muted-foreground h-10 w-fit max-w-full data-[orientation=horizontal]:h-10 items-end justify-start gap-1 rounded-none bg-transparent p-0"
      >
        {tabs.map((item) => (
          <TabsTrigger
            key={item.value}
            value={item.value}
            id={`${tabsIdBase}-trigger-${item.value}`}
            aria-controls={`${tabsIdBase}-content-${item.value}`}
            className="text-muted-foreground focus-visible:ring-ring data-[state=active]:text-foreground after:bg-primary relative inline-flex h-10 flex-none items-center justify-center gap-2 rounded-none border-0 bg-transparent px-2 pt-1 pb-2 text-sm font-medium whitespace-nowrap shadow-none transition-all duration-200 data-[orientation=horizontal]:after:bottom-[-1px] after:z-10 hover:bg-transparent focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none data-[state=active]:font-semibold data-[state=active]:shadow-none group-data-[variant=default]/tabs-list:data-[state=active]:shadow-none dark:data-[state=active]:!bg-transparent"
          >
            <item.icon className="h-4 w-4" aria-hidden />
            {item.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </div>
  )
}
