"use client"

import type { Editor } from "@tiptap/react"
import { useRef } from "react"
import ClipboardIcon from "lucide-react/dist/esm/icons/clipboard"
import ChevronDown from "lucide-react/dist/esm/icons/chevron-down"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuShortcut,
} from "@/components/ui/dropdown-menu"

import { pasteEditorClipboard } from "../clipboard"

export function RichTextPasteMenu({ editor }: { editor: Editor }) {
  const pastingRef = useRef(false)
  function paste(plain: boolean) {
    pastingRef.current = true
    void pasteEditorClipboard(editor, plain)
  }

  return (
    <DropdownMenu
      onOpenChange={(open) => {
        if (open) pastingRef.current = false
      }}
    >
      <DropdownMenuTrigger asChild>
        <Button

          type="button"
          variant="ghost"
          size="sm"
          data-toolbar-menu-trigger=""
          className="text-muted-foreground hover:text-foreground h-7 gap-1 px-1 sm:h-8 sm:px-1.5"
          aria-label="Paste options"
          title="Paste options"
        >
          <ClipboardIcon data-icon="inline-start" />
          <ChevronDown data-icon="inline-end" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent

        align="start"
        className="max-w-[calc(100vw-2rem)] shadow-none"
        onCloseAutoFocus={(event) => {
          if (pastingRef.current) {
            event.preventDefault()
            editor.commands.focus()
          }
        }}
      >
        <DropdownMenuGroup>
          <DropdownMenuItem onSelect={() => void paste(false)}>
            Paste <DropdownMenuShortcut>Ctrl/Cmd+V</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => void paste(true)}>
            Paste without formatting{" "}
            <DropdownMenuShortcut>Ctrl/Cmd+Shift+V</DropdownMenuShortcut>
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
