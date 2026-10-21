"use client"

import PlusIcon from "lucide-react/dist/esm/icons/plus"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"

import { TabsList, TabsTrigger } from "@/features/platform-admin-dashboard"

export function ProjectDetailTabsList({ fiscalEnabled, canAdd, adding, onAddFiscal, hasPrograms = false }: {
  hasPrograms?: boolean
  fiscalEnabled: boolean
  canAdd: boolean
  adding: boolean
  onAddFiscal: () => void
}) {
  const tabs = [
    { value: "overview", label: "Overview" },
    ...(hasPrograms ? [{ value: "programs", label: "Programs" }] : []),
    ...(fiscalEnabled ? [{ value: "fiscal-sponsorship", label: "Fiscal Sponsorship" }] : []),
    { value: "activity", label: "Activity" },
    { value: "workstream", label: "Workstream" },
    { value: "tasks", label: "Tasks" },
    { value: "notes", label: "Notes" },
    { value: "assets", label: "Assets & Files" },
  ]
  return (
    <div  className="border-border flex min-w-0 items-start border-b">
      <div className="min-w-0 flex-1">
        <TabsList className="flex w-full min-w-0 flex-wrap gap-x-1 gap-y-0 overflow-visible border-0 px-0">
          {tabs.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value}
              className="mb-0 min-h-11 min-w-0 max-w-full shrink whitespace-normal px-2 after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:rounded-full after:bg-foreground after:opacity-0 after:transition-opacity data-[state=active]:after:opacity-100 motion-reduce:after:transition-none">
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>
      {canAdd ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="size-11 shrink-0" aria-label="Add project tab" disabled={adding}>
              <PlusIcon />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" >
            <DropdownMenuGroup>
              <DropdownMenuItem disabled={fiscalEnabled || adding} onSelect={onAddFiscal}>
                Fiscal Sponsorship{fiscalEnabled ? " (added)" : ""}
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </div>
  )
}
