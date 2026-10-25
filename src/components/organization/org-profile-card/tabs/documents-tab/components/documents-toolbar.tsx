"use client"

import {
  WorkspaceWindowHeaderPortal,
  useWorkspaceWindowHeader,
} from "@/components/workspace/workspace-window-header-slots"
import { IconLayoutGrid, IconList, IconSearch } from "@tabler/icons-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { DocumentsNewMenu } from "./documents-new-menu"
import { DocumentsToolbarFilterMenu } from "./documents-toolbar-filter-menu"
import type { DocumentsLibraryTab } from "./documents-library-grid"
import type { DocumentsToolbarProps } from "./documents-toolbar-types"

const TABS: Array<{ value: DocumentsLibraryTab; label: string }> = [
  { value: "all", label: "All" },
  { value: "images", label: "Images" },
  { value: "documents", label: "Documents" },
]

export function DocumentsToolbar(props: DocumentsToolbarProps) {
  const inWindowHeader = useWorkspaceWindowHeader()
  return (
    <header className={inWindowHeader ? undefined : "mb-6 space-y-5"}>
      <WorkspaceWindowHeaderPortal>
        <div
          className={cn(
            "flex min-w-0",
            inWindowHeader
              ? "flex-wrap items-center gap-2"
              : "flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"
          )}
        >
          {!inWindowHeader && (
            <div className="min-w-0">
              <h1
                id="documents-title"
                className="text-2xl font-semibold tracking-tight"
              >
                Documents
              </h1>
            </div>
          )}
          <div className="flex w-full min-w-0 items-center justify-end gap-2 lg:w-auto">
            <div className="relative w-44 max-w-full min-w-0">
              <IconSearch
                className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
                aria-hidden
              />
              <Input
                value={props.searchQuery}
                onChange={(event) =>
                  props.onSearchQueryChange(event.target.value)
                }
                placeholder="Search…"
                className={cn(
                  "border-border/70 bg-muted/70 hover:bg-muted focus-visible:bg-background rounded-full pr-3 pl-9 text-base shadow-none transition-[background-color,border-color,box-shadow] dark:bg-white/10 dark:hover:bg-white/15",
                  inWindowHeader
                    ? "h-7 text-xs [@media(pointer:coarse)]:h-11 [@media(pointer:coarse)]:text-base"
                    : "h-11 sm:h-9 sm:text-sm"
                )}
                aria-label="Search documents"
                data-tour="documents-search"
              />
            </div>
            <DocumentsNewMenu
              canEdit={props.canEdit}
              canUpload={props.canUpload}
              editMode={props.editMode}
              driveConnected={props.driveConnected}
              drivePending={props.drivePending}
              onUploadFiles={props.onUploadFiles}
              onGoogleDrive={props.onGoogleDrive}
            />
          </div>
        </div>
      </WorkspaceWindowHeaderPortal>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          className="flex items-center gap-1"
          role="tablist"
          aria-label="Document type"
        >
          {TABS.map((tab) => (
            <Button
              key={tab.value}
              type="button"
              variant="ghost"
              role="tab"
              aria-selected={props.tab === tab.value}
              className={cn(
                "text-muted-foreground hover:bg-muted hover:text-foreground min-h-11 rounded-full px-3 text-sm font-medium transition-[background-color,color] focus-visible:ring-2 sm:min-h-9",
                props.tab === tab.value &&
                  "bg-muted text-foreground dark:bg-zinc-700"
              )}
              onClick={() => props.onTabChange(tab.value)}
            >
              {tab.label}
            </Button>
          ))}
        </div>

        <div className="flex items-center gap-1">
          <DocumentsToolbarFilterMenu
            source={props.source}
            fileType={props.fileType}
            showDeleted={props.showDeleted}
            onSourceChange={props.onSourceChange}
            onFileTypeChange={props.onFileTypeChange}
            onShowDeletedChange={props.onShowDeletedChange}
            onReset={props.onReset}
          />
          <div className="bg-border mx-1 h-7 w-px" aria-hidden />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={cn(
              "text-muted-foreground hover:bg-muted hover:text-foreground size-11 rounded-full focus-visible:ring-2 sm:size-9",
              props.viewMode === "grid" &&
                "bg-muted text-foreground dark:bg-zinc-700"
            )}
            aria-pressed={props.viewMode === "grid"}
            aria-label="Grid view"
            onClick={() => props.onViewModeChange("grid")}
          >
            <IconLayoutGrid className="size-[1.125rem]" aria-hidden />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={cn(
              "text-muted-foreground hover:bg-muted hover:text-foreground size-11 rounded-full focus-visible:ring-2 sm:size-9",
              props.viewMode === "list" &&
                "bg-muted text-foreground dark:bg-zinc-700"
            )}
            aria-pressed={props.viewMode === "list"}
            aria-label="List view"
            onClick={() => props.onViewModeChange("list")}
          >
            <IconList className="size-[1.125rem]" aria-hidden />
          </Button>
        </div>
      </div>
    </header>
  )
}
