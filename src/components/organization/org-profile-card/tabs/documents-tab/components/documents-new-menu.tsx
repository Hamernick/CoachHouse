"use client"

import { cn } from "@/lib/utils"
import {
  useWorkspaceWindowHeader,
  WORKSPACE_HEADER_BUTTON,
} from "@/components/workspace/workspace-window-header-slots"
import { useRef } from "react"
import {
  IconBrandGoogleDrive,
  IconChevronDown,
  IconFileDescription,
  IconFileSpreadsheet,
  IconFolder,
  IconLayoutGrid,
  IconNote,
  IconPhoto,
  IconPresentation,
  IconUpload,
} from "@tabler/icons-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

const NATIVE_CREATION_ITEMS = [
  {
    label: "Image",
    href: "https://docs.google.com/drawings/create",
    icon: IconPhoto,
  },
  { label: "Note", href: "https://keep.google.com/", icon: IconNote },
  { label: "Document", href: "https://docs.new", icon: IconFileDescription },
  {
    label: "Spreadsheet",
    href: "https://sheets.new",
    icon: IconFileSpreadsheet,
  },
  {
    label: "Presentation",
    href: "https://slides.new",
    icon: IconPresentation,
  },
  {
    label: "Folder",
    href: "https://drive.google.com/drive/my-drive",
    icon: IconFolder,
  },
] as const

type Props = {
  canUpload: boolean
  canEdit: boolean
  editMode: boolean
  driveConnected: boolean
  drivePending: boolean
  onUploadFiles: (files: File[]) => Promise<void>
  onGoogleDrive: () => void
}

export function DocumentsNewMenu({
  canEdit,
  canUpload,
  editMode,
  driveConnected,
  drivePending,
  onUploadFiles,
  onGoogleDrive,
}: Props) {
  const inWindowHeader = useWorkspaceWindowHeader()
  const inputRef = useRef<HTMLInputElement>(null)

  if (!canEdit || !editMode) return null

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        multiple
        disabled={!canUpload}
        className="sr-only"
        aria-label="Choose files to upload"
        onChange={(event) => {
          const files = Array.from(event.currentTarget.files ?? [])
          if (canUpload && files.length > 0) void onUploadFiles(files)
          event.currentTarget.value = ""
        }}
      />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            className={cn(
              "rounded-full shadow-none",
              inWindowHeader
                ? WORKSPACE_HEADER_BUTTON
                : "h-11 px-4 text-base sm:h-9 sm:text-sm"
            )}
          >
            New
            <IconChevronDown className="size-4" aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="w-[min(16rem,calc(100vw-2rem))] rounded-xl p-1.5 shadow-xl dark:border-white/10 dark:bg-[#303030]"
        >
          {NATIVE_CREATION_ITEMS.map(({ label, href, icon: Icon }) => (
            <DropdownMenuItem
              key={label}
              asChild
              className="min-h-11 rounded-lg text-base sm:min-h-9 sm:text-sm"
            >
              <a href={href} target="_blank" rel="noreferrer">
                <Icon className="size-4" aria-hidden />
                {label}
              </a>
            </DropdownMenuItem>
          ))}

          <DropdownMenuSeparator className="mx-2 my-2" />
          <DropdownMenuItem
            asChild
            className="min-h-11 rounded-lg text-base sm:min-h-9 sm:text-sm"
          >
            <a
              href="https://docs.google.com/templates"
              target="_blank"
              rel="noreferrer"
            >
              <IconLayoutGrid className="size-4" aria-hidden />
              Start from templates
            </a>
          </DropdownMenuItem>

          <DropdownMenuSeparator className="mx-2 my-2" />
          <DropdownMenuItem
            className="min-h-11 rounded-lg text-base sm:min-h-9 sm:text-sm"
            disabled={!canUpload}
            onSelect={() =>
              window.setTimeout(() => inputRef.current?.click(), 0)
            }
          >
            <IconUpload className="size-4" aria-hidden />
            {canUpload ? "Upload files" : "Upload files · Upgrade"}
          </DropdownMenuItem>

          <DropdownMenuSeparator className="mx-2 my-2" />
          <DropdownMenuItem
            className="min-h-11 rounded-lg text-base sm:min-h-10 sm:text-sm"
            disabled={drivePending}
            onSelect={onGoogleDrive}
          >
            <IconBrandGoogleDrive
              className="size-5 text-[#4285f4]"
              aria-hidden
            />
            {drivePending
              ? "Opening Google Drive…"
              : driveConnected
                ? "Add from Google Drive"
                : "Connect Google Drive"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  )
}
