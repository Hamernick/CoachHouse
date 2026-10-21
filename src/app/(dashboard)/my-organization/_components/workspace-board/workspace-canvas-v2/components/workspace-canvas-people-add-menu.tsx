"use client"

import { cn } from "@/lib/utils"
import {
  useWorkspaceWindowHeader,
  WORKSPACE_HEADER_BUTTON,
} from "@/components/workspace/workspace-window-header-slots"
import { useRef, useState } from "react"
import PlusIcon from "lucide-react/dist/esm/icons/plus"
import FolderPlusIcon from "lucide-react/dist/esm/icons/folder-plus"
import UserPlusIcon from "lucide-react/dist/esm/icons/user-plus"
import ChevronDownIcon from "lucide-react/dist/esm/icons/chevron-down"

import type { OrgPerson } from "@/actions/people"
import { CreatePersonDialog } from "@/components/people/create-person-dialog"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export function WorkspacePeopleAddMenu({
  people,
  onCreateSegment,
}: {
  people: OrgPerson[]
  onCreateSegment: () => void
}) {
  const inWindowHeader = useWorkspaceWindowHeader()
  const [contactOpen, setContactOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const actionRef = useRef<"segment" | "contact" | null>(null)

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            ref={triggerRef}
            data-tour="people-add"
            size="sm"
            className={cn(
              "h-8 w-auto shrink-0 justify-center gap-1.5 rounded-xl px-2.5",
              inWindowHeader && WORKSPACE_HEADER_BUTTON
            )}
          >
            <PlusIcon aria-hidden />
            Add
            <ChevronDownIcon aria-hidden className="size-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          onCloseAutoFocus={(event) => {
            const action = actionRef.current
            actionRef.current = null
            if (!action) return
            // Let the destination own focus after the menu has closed.
            event.preventDefault()
            if (action === "contact") setContactOpen(true)
            else {
              triggerRef.current?.focus()
              onCreateSegment()
            }
          }}
        >
          <DropdownMenuItem
            onSelect={() => {
              actionRef.current = "segment"
            }}
          >
            <FolderPlusIcon aria-hidden />
            Add segment
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => {
              actionRef.current = "contact"
            }}
          >
            <UserPlusIcon aria-hidden />
            Add contact
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <CreatePersonDialog
        triggerClassName="hidden"
        people={people}
        extendedSocialLinksEnabled
        open={contactOpen}
        onOpenChange={(open) => {
          setContactOpen(open)
          if (!open) requestAnimationFrame(() => triggerRef.current?.focus())
        }}
      />
    </>
  )
}
