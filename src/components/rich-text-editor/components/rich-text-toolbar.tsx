import { RichTextPasteMenu } from "./rich-text-paste-menu"
import type { Editor } from "@tiptap/react"
import type { ComponentType, ReactNode } from "react"
import AlignCenter from "lucide-react/dist/esm/icons/align-center"
import AlignLeft from "lucide-react/dist/esm/icons/align-left"
import AlignRight from "lucide-react/dist/esm/icons/align-right"
import BoldIcon from "lucide-react/dist/esm/icons/bold"
import ChevronDown from "lucide-react/dist/esm/icons/chevron-down"
import CornerDownLeft from "lucide-react/dist/esm/icons/corner-down-left"
import Heading1 from "lucide-react/dist/esm/icons/heading-1"
import Heading2 from "lucide-react/dist/esm/icons/heading-2"
import Heading3 from "lucide-react/dist/esm/icons/heading-3"
import ImagePlus from "lucide-react/dist/esm/icons/image-plus"
import ItalicIcon from "lucide-react/dist/esm/icons/italic"
import ListIcon from "lucide-react/dist/esm/icons/list"
import ListOrdered from "lucide-react/dist/esm/icons/list-ordered"
import Minus from "lucide-react/dist/esm/icons/minus"
import Pilcrow from "lucide-react/dist/esm/icons/pilcrow"
import Quote from "lucide-react/dist/esm/icons/quote"
import Redo2 from "lucide-react/dist/esm/icons/redo-2"
import Rows3 from "lucide-react/dist/esm/icons/rows-3"
import Table2 from "lucide-react/dist/esm/icons/table-2"
import TypeIcon from "lucide-react/dist/esm/icons/type"
import Trash2 from "lucide-react/dist/esm/icons/trash-2"
import UnderlineIcon from "lucide-react/dist/esm/icons/underline"
import Undo2 from "lucide-react/dist/esm/icons/undo-2"

import { Button, buttonVariants } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

type RichTextToolbarProps = {
  editor: Editor
  compact: boolean
  enableImages: boolean
  uploadingImage: boolean
  onImagePick: () => void
  toolbarActions?: ReactNode
  toolbarTrailingActions?: ReactNode
  toolbarClassName?: string
}

function ToolbarButton({
  icon: Icon,
  label,
  onClick,
  isActive,
  disabled,
}: {
  icon: ComponentType<{ className?: string }>
  label: string
  onClick: () => void
  isActive?: boolean
  disabled?: boolean
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={cn(
        "h-7 w-7 p-0 text-muted-foreground hover:text-foreground sm:h-8 sm:w-8",
        isActive && "bg-accent text-accent-foreground hover:bg-accent hover:text-accent-foreground",
      )}
    >
      <Icon className="h-4 w-4" />
    </Button>
  )
}

function ToolbarMenuTrigger({
  icon: Icon,
  label,
  valueLabel,
  className,
  ...props
}: React.ComponentProps<typeof DropdownMenuTrigger> & {
  icon: ComponentType<{ className?: string }>
  label: string
  valueLabel?: string
}) {
  return (
    <DropdownMenuTrigger
      type="button"
      data-toolbar-menu-trigger=""
      aria-label={valueLabel ? `${label} (${valueLabel})` : label}
      className={cn(
        buttonVariants({ variant: "ghost", size: "sm" }),
        "h-7 gap-1 px-1 text-muted-foreground hover:text-foreground sm:h-8 sm:px-1.5",
        className,
      )}
      {...props}
    >
      <Icon className="h-4 w-4" />
      <ChevronDown className="h-3 w-3" />
    </DropdownMenuTrigger>
  )
}

function ToolbarDivider() {
  return <span className="mx-1 hidden h-8 w-px bg-border sm:block" />
}

function ToolbarSpacer() {
  return <span className="flex-1" />
}

const TEXT_STYLE_LABELS: Record<string, string> = {
  paragraph: "Paragraph",
  "heading-1": "H1",
  "heading-2": "H2",
  "heading-3": "H3",
}

export function RichTextToolbar({
  editor,
  compact,
  enableImages,
  uploadingImage,
  onImagePick,
  toolbarActions,
  toolbarTrailingActions,
  toolbarClassName,
}: RichTextToolbarProps) {
  const textStyle = editor.isActive("heading", { level: 1 })
    ? "heading-1"
    : editor.isActive("heading", { level: 2 })
      ? "heading-2"
      : editor.isActive("heading", { level: 3 })
        ? "heading-3"
        : "paragraph"

  const textStyleLabel = TEXT_STYLE_LABELS[textStyle] ?? "Paragraph"
  const alignmentValue = editor.isActive({ textAlign: "center" })
    ? "center"
    : editor.isActive({ textAlign: "right" })
      ? "right"
      : "left"

  const blockItemClass = (active: boolean) =>
    cn("cursor-pointer", active && "bg-accent text-accent-foreground")

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-0.5 border-b bg-transparent px-2 py-2 sm:gap-1",
        toolbarClassName,
      )}
    >
      <RichTextPasteMenu editor={editor} />
      {toolbarActions ? <div className="flex items-center gap-1">{toolbarActions}</div> : null}
      <DropdownMenu>
        <ToolbarMenuTrigger icon={TypeIcon} label="Text style" valueLabel={textStyleLabel} />
        <DropdownMenuContent align="start" className="w-44 shadow-none">
          <DropdownMenuItem
            onSelect={() => editor.chain().focus().setParagraph().run()}
            className={blockItemClass(textStyle === "paragraph")}
          >
            <Pilcrow className="h-4 w-4" />
            Paragraph
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            className={blockItemClass(textStyle === "heading-1")}
          >
            <Heading1 className="h-4 w-4" />
            Heading 1
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            className={blockItemClass(textStyle === "heading-2")}
          >
            <Heading2 className="h-4 w-4" />
            Heading 2
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            className={blockItemClass(textStyle === "heading-3")}
          >
            <Heading3 className="h-4 w-4" />
            Heading 3
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ToolbarDivider />
      <ToolbarButton
        icon={BoldIcon}
        label="Bold"
        onClick={() => editor.chain().focus().toggleBold().run()}
        isActive={editor.isActive("bold")}
      />
      <ToolbarButton
        icon={ItalicIcon}
        label="Italic"
        onClick={() => editor.chain().focus().toggleItalic().run()}
        isActive={editor.isActive("italic")}
      />
      <ToolbarButton
        icon={UnderlineIcon}
        label="Underline"
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        isActive={editor.isActive("underline")}
      />

      <ToolbarDivider />
      <DropdownMenu>
        <ToolbarMenuTrigger icon={ListIcon} label="Blocks" valueLabel="Blocks" />
        <DropdownMenuContent align="start" className="w-48 shadow-none">
          <DropdownMenuItem
            onSelect={() => editor.chain().focus().toggleBulletList().run()}
            className={blockItemClass(editor.isActive("bulletList"))}
          >
            <ListIcon className="h-4 w-4" />
            Bulleted list
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => editor.chain().focus().toggleOrderedList().run()}
            className={blockItemClass(editor.isActive("orderedList"))}
          >
            <ListOrdered className="h-4 w-4" />
            Numbered list
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => editor.chain().focus().toggleBlockquote().run()}
            className={blockItemClass(editor.isActive("blockquote"))}
          >
            <Quote className="h-4 w-4" />
            Block quote
          </DropdownMenuItem>
          {!compact ? (
            <>
              <DropdownMenuItem
                onSelect={() => editor.chain().focus().setHorizontalRule().run()}
                className="cursor-pointer"
              >
                <Minus className="h-4 w-4" />
                Horizontal rule
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => editor.chain().focus().setHardBreak().run()}
                className="cursor-pointer"
              >
                <CornerDownLeft className="h-4 w-4" />
                Line break
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      {!compact ? (
        <>
          <DropdownMenu>
            <ToolbarMenuTrigger icon={Table2} label="Table" valueLabel="Table" />
            <DropdownMenuContent align="start" className="w-52 shadow-none">
              <DropdownMenuItem
                onSelect={() =>
                  editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
                }
                className="cursor-pointer"
              >
                <Table2 className="h-4 w-4" />
                Insert table
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={!editor.isActive("table")}
                onSelect={() => editor.chain().focus().addColumnAfter().run()}
                className="cursor-pointer"
              >
                <Table2 className="h-4 w-4" />
                Add column
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={!editor.isActive("table")}
                onSelect={() => editor.chain().focus().addRowAfter().run()}
                className="cursor-pointer"
              >
                <Rows3 className="h-4 w-4" />
                Add row
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={!editor.isActive("table")}
                onSelect={() => editor.chain().focus().deleteColumn().run()}
                className="cursor-pointer"
              >
                <Trash2 className="h-4 w-4" />
                Delete column
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={!editor.isActive("table")}
                onSelect={() => editor.chain().focus().deleteRow().run()}
                className="cursor-pointer"
              >
                <Trash2 className="h-4 w-4" />
                Delete row
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={!editor.isActive("table")}
                onSelect={() => editor.chain().focus().deleteTable().run()}
                className="cursor-pointer text-destructive focus:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
                Delete table
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <ToolbarDivider />
          <DropdownMenu>
            <ToolbarMenuTrigger icon={AlignLeft} label="Align" valueLabel="Align" />
            <DropdownMenuContent align="start" className="w-40 shadow-none">
              <DropdownMenuRadioGroup
                value={alignmentValue}
                onValueChange={(value) => {
                  if (!value) return
                  editor.chain().focus().setTextAlign(value as "left" | "center" | "right").run()
                }}
              >
                <DropdownMenuRadioItem value="left">
                  <AlignLeft className="h-4 w-4" />
                  Align left
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="center">
                  <AlignCenter className="h-4 w-4" />
                  Align center
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="right">
                  <AlignRight className="h-4 w-4" />
                  Align right
                </DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          <ToolbarDivider />
        </>
      ) : (
        <ToolbarDivider />
      )}
      {enableImages ? (
        <>
          <ToolbarButton
            icon={ImagePlus}
            label={uploadingImage ? "Uploading image" : "Insert image"}
            onClick={onImagePick}
            disabled={uploadingImage}
          />
          <ToolbarDivider />
        </>
      ) : null}
      <ToolbarSpacer />
      <ToolbarButton
        icon={Undo2}
        label="Undo"
        onClick={() => editor.chain().focus().undo().run()}
        disabled={!editor.can().undo()}
      />
      <ToolbarButton
        icon={Redo2}
        label="Redo"
        onClick={() => editor.chain().focus().redo().run()}
        disabled={!editor.can().redo()}
      />
      {toolbarTrailingActions ? (
        <div className="ml-1 flex items-center gap-1">{toolbarTrailingActions}</div>
      ) : null}
    </div>
  )
}
