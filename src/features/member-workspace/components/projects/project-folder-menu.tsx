"use client"
import { useRef } from "react"
import { DotsThree, LockKey } from "@phosphor-icons/react/dist/ssr"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import type { ProjectAssetFolder } from "../../lib/project-asset-folders"
export function ProjectFolderMenu({ folder, canEdit, busy, onAccess, onRename, onRemove }: {
  folder: ProjectAssetFolder; canEdit: boolean; busy: boolean;
  onAccess?: (folder: ProjectAssetFolder, trigger: HTMLButtonElement) => void;
  onRename: (folder: ProjectAssetFolder) => void; onRemove: (folder: ProjectAssetFolder) => void
}) {
  const trigger = useRef<HTMLButtonElement>(null)
  const openingAccess = useRef(false)
  if (!canEdit && !onAccess) return null
  return <DropdownMenu onOpenChange={open => { if (open) openingAccess.current = false }}>
    <DropdownMenuTrigger asChild><Button ref={trigger} variant="ghost" size="icon" disabled={busy} className="size-6 text-muted-foreground" aria-label={`Actions for ${folder.name}`}><DotsThree weight="bold" /></Button></DropdownMenuTrigger>
    <DropdownMenuContent align="end" onCloseAutoFocus={event => { if (openingAccess.current) event.preventDefault() }}><DropdownMenuGroup>
      {onAccess && <DropdownMenuItem onSelect={() => { if (trigger.current) { openingAccess.current = true; onAccess(folder, trigger.current) } }}><LockKey aria-hidden />Access</DropdownMenuItem>}
      {canEdit && <><DropdownMenuItem onClick={() => onRename(folder)}>Rename</DropdownMenuItem><DropdownMenuItem onClick={() => onRemove(folder)}>Delete folder</DropdownMenuItem></>}
    </DropdownMenuGroup></DropdownMenuContent>
  </DropdownMenu>
}
