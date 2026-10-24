"use client"

import MoreHorizontalIcon from "lucide-react/dist/esm/icons/more-horizontal"
import PencilIcon from "lucide-react/dist/esm/icons/pencil"
import TrashIcon from "lucide-react/dist/esm/icons/trash"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

import { GoogleDriveMark } from "./google-drive-mark"

export function CoreDocumentMenu({
  canEditContent = true,
  title,
  pending,
  onEdit,
  onReplace,
  onRemove,
  className,
}: {
  canEditContent?: boolean
  title: string
  pending: boolean
  onEdit: () => void
  onReplace: () => void
  onRemove: () => void
  className?: string
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button

          type="button"
          variant="ghost"
          size="icon"
          className={className ?? "size-11 sm:size-8"}
          disabled={pending}
          aria-label={`Manage ${title}`}
        >
          <MoreHorizontalIcon aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent

        align="end"
      >
        <DropdownMenuGroup>
          <DropdownMenuItem className="min-h-11 sm:min-h-9" onSelect={onEdit} disabled={!canEditContent}>
            <PencilIcon aria-hidden="true" />
            Edit
          </DropdownMenuItem>
          <DropdownMenuItem
            className="min-h-11 sm:min-h-9"
            onSelect={onReplace}
          >
            <GoogleDriveMark />
            Replace with Google Drive…
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="min-h-11 sm:min-h-9"
            variant="destructive"
            onSelect={onRemove}
            disabled={!canEditContent}
          >
            <TrashIcon aria-hidden="true" />
            Remove
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
