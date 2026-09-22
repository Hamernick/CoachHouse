"use client"

import { useState } from "react"
import {
  Calendar,
  ChartBar,
  Kanban,
  ListBullets,
  Sliders,
  TextT,
  User,
} from "@phosphor-icons/react/dist/ssr"

import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"
import type { MemberWorkspaceProjectViewOptions } from "./member-workspace-project-view-options"

export function MemberWorkspaceProjectViewOptionsPopover({
  options,
  onChange,
}: {
  options: MemberWorkspaceProjectViewOptions
  onChange: (options: MemberWorkspaceProjectViewOptions) => void
}) {
  const [orderingOpen, setOrderingOpen] = useState(false)

  const viewTypes = [
    { id: "list", label: "List", icon: ListBullets },
    { id: "board", label: "Board", icon: Kanban },
    { id: "timeline", label: "Timeline", icon: ChartBar },
  ] as const

  const orderingOptions = [
    { id: "manual", label: "Manual" },
    { id: "alphabetical", label: "Alphabetical" },
    { id: "date", label: "Date" },
  ] as const

  const propertyOptions = [
    { id: "title", label: "Title", icon: TextT },
    { id: "status", label: "Status", icon: ChartBar },
    { id: "assignee", label: "Assignee", icon: User },
    { id: "dueDate", label: "Due date", icon: Calendar },
  ] as const

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-11 gap-2 sm:h-8 rounded-lg border-border/60 bg-transparent px-3">
          <Sliders className="h-4 w-4" />
          View
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 max-w-[calc(100vw-2rem)] rounded-xl p-0" align="end">
        <div className="p-4">
          <div className="flex rounded-xl bg-muted p-1">
            {viewTypes.map((type) => (
              <button
                key={type.id}
                onClick={() => onChange({ ...options, viewType: type.id })}
                className={cn(
                  "flex flex-1 flex-col items-center gap-1 rounded-lg py-2.5 text-xs font-medium transition-colors shadow-none",
                  options.viewType === type.id
                    ? "bg-background shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <type.icon className="h-5 w-5" />
                {type.label}
              </button>
            ))}
          </div>

          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm">Ordering</span>
              <Popover open={orderingOpen} onOpenChange={setOrderingOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-11 gap-2 sm:h-8 rounded-lg border-border/60 bg-transparent px-3">
                    <Sliders className="h-4 w-4" />
                    {orderingOptions.find((option) => option.id === options.ordering)?.label}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-36 rounded-xl p-1" align="end">
                  {orderingOptions.map((option) => (
                    <button
                      key={option.id}
                      onClick={() => {
                        onChange({ ...options, ordering: option.id })
                        setOrderingOpen(false)
                      }}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-accent",
                        options.ordering === option.id && "bg-accent",
                      )}
                    >
                      {option.label}
                    </button>
                  ))}
                </PopoverContent>
              </Popover>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm">Show closed projects</span>
              <Switch
                checked={options.showClosedProjects}
                onCheckedChange={(checked) => onChange({ ...options, showClosedProjects: checked })}
              />
            </div>

            <div className="pt-2">
              <span className="text-sm font-medium">Card fields</span>
              <div className="mt-2 flex flex-wrap gap-2">
                {propertyOptions.map((property) => (
                  <button
                    key={property.id}
                    type="button"
                    disabled={property.id === "title"}
                    onClick={() => {
                      if (property.id === "title") {
                        return
                      }
                      const nextProperties = options.properties.includes(property.id)
                        ? options.properties.filter((value) => value !== property.id)
                        : [...options.properties, property.id]
                      onChange({ ...options, properties: nextProperties })
                    }}
                    className={cn(
                      "flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs transition-colors",
                      options.properties.includes(property.id)
                        ? "border-border bg-background"
                        : "border-border hover:bg-accent",
                      property.id === "title" && "cursor-default opacity-70 hover:bg-background",
                    )}
                  >
                    <property.icon className="h-3.5 w-3.5" />
                    {property.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
