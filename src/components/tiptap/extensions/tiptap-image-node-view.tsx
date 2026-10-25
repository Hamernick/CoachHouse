"use client"

import type { ChangeEvent, KeyboardEvent, MouseEvent as ReactMouseEvent, TouchEvent as ReactTouchEvent } from "react"
import { useEffect, useRef, useState } from "react"
import type { NodeViewProps } from "@tiptap/react"
import { NodeViewWrapper, useEditorState } from "@tiptap/react"
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Maximize,
  MoreVertical,
  Trash,
  Edit,
  Loader2,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { useImageUpload } from "@/hooks/use-image-upload"
import { cn } from "@/lib/utils"
import { TiptapImageReplaceControls } from "./tiptap-image-replace-controls"

export function TiptapImage(props: NodeViewProps) {
  const { node, editor, selected, deleteNode, updateAttributes: commitAttributes, extension } = props
  const isEditable = useEditorState({
    editor,
    selector: ({ editor: currentEditor }) => currentEditor?.isEditable ?? false,
  })
  const imageRef = useRef<HTMLImageElement | null>(null)
  const nodeRef = useRef<HTMLDivElement | null>(null)
  const captionButtonRef = useRef<HTMLButtonElement | null>(null)
  const captionInputRef = useRef<HTMLInputElement | null>(null)
  const captionFocusRequestedRef = useRef(false)
  const cancelCaptionRef = useRef(false)
  const isUploading = node.attrs.uploading === true || node.attrs.uploading === "true"
  const [resizing, setResizing] = useState(false)
  const [resizingPosition, setResizingPosition] = useState<"left" | "right">("left")
  const [resizeInitialWidth, setResizeInitialWidth] = useState(0)
  const [resizeInitialMouseX, setResizeInitialMouseX] = useState(0)
  const [editingCaption, setEditingCaption] = useState(false)
  const [caption, setCaption] = useState(node.attrs.caption || "")
  const [openedMore, setOpenedMore] = useState(false)
  const [imageUrl, setImageUrl] = useState("")
  const [altText, setAltText] = useState(node.attrs.alt || "")

  function updateAttributes(attributes: Record<string, unknown>) {
    if (editor.isEditable) commitAttributes(attributes)
  }

  const { fileInputRef, handleFileChange, handleRemove, uploading, error } = useImageUpload({
    uploadFile: extension?.options?.uploadImage ?? undefined,
    onUpload: (uploadedImageUrl) => {
      updateAttributes({
        src: uploadedImageUrl,
        alt: altText || fileInputRef.current?.files?.[0]?.name,
      })
      handleRemove()
      setOpenedMore(false)
    },
  })

  function handleResizingPosition({
    e,
    position,
  }: {
    e: ReactMouseEvent<HTMLDivElement, MouseEvent>
    position: "left" | "right"
  }) {
    startResize(e)
    setResizingPosition(position)
  }

  function startResize(event: ReactMouseEvent<HTMLDivElement>) {
    event.preventDefault()
    setResizing(true)
    setResizeInitialMouseX(event.clientX)
    if (imageRef.current) {
      setResizeInitialWidth(imageRef.current.offsetWidth)
    }
  }

  function resize(event: MouseEvent) {
    if (!resizing) return

    let dx = event.clientX - resizeInitialMouseX
    if (resizingPosition === "left") {
      dx = resizeInitialMouseX - event.clientX
    }

    const newWidth = Math.max(resizeInitialWidth + dx, 150)
    const parentWidth = nodeRef.current?.parentElement?.offsetWidth ?? 0

    if (newWidth < parentWidth) {
      updateAttributes({
        width: newWidth,
      })
    }
  }

  function endResize() {
    setResizing(false)
    setResizeInitialMouseX(0)
    setResizeInitialWidth(0)
  }

  function handleTouchStart(event: ReactTouchEvent, position: "left" | "right") {
    event.preventDefault()
    setResizing(true)
    setResizingPosition(position)
    setResizeInitialMouseX(event.touches[0]?.clientX ?? 0)
    if (imageRef.current) {
      setResizeInitialWidth(imageRef.current.offsetWidth)
    }
  }

  function handleTouchMove(event: TouchEvent) {
    if (!resizing) return

    let dx = (event.touches[0]?.clientX ?? resizeInitialMouseX) - resizeInitialMouseX
    if (resizingPosition === "left") {
      dx = resizeInitialMouseX - (event.touches[0]?.clientX ?? resizeInitialMouseX)
    }

    const newWidth = Math.max(resizeInitialWidth + dx, 150)
    const parentWidth = nodeRef.current?.parentElement?.offsetWidth ?? 0

    if (newWidth < parentWidth) {
      updateAttributes({
        width: newWidth,
      })
    }
  }

  function handleTouchEnd() {
    setResizing(false)
    setResizeInitialMouseX(0)
    setResizeInitialWidth(0)
  }

  function handleCaptionChange(e: ChangeEvent<HTMLInputElement>) {
    setCaption(e.target.value)
  }

  function handleCaptionBlur() {
    if (!cancelCaptionRef.current) updateAttributes({ caption })
    setEditingCaption(false)
  }

  function beginCaptionEdit() {
    if (!editor.isEditable) return
    cancelCaptionRef.current = false
    setCaption(node.attrs.caption || "")
    setEditingCaption(true)
  }

  function handleCaptionKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === "Escape") {
      e.preventDefault()
      e.stopPropagation()
      cancelCaptionRef.current = e.key === "Escape"
      e.currentTarget.blur()
      requestAnimationFrame(() => captionButtonRef.current?.focus())
    }
  }

  const handleImageUrlSubmit = () => {
    if (imageUrl) {
      updateAttributes({
        src: imageUrl,
        alt: altText,
      })
      setImageUrl("")
      setAltText("")
      setOpenedMore(false)
    }
  }

  // Global pointer/touch listeners are required for edge drag handles outside node bounds.
  useEffect(() => {
    window.addEventListener("mousemove", resize)
    window.addEventListener("mouseup", endResize)
    window.addEventListener("touchmove", handleTouchMove)
    window.addEventListener("touchend", handleTouchEnd)
    return () => {
      window.removeEventListener("mousemove", resize)
      window.removeEventListener("mouseup", endResize)
      window.removeEventListener("touchmove", handleTouchMove)
      window.removeEventListener("touchend", handleTouchEnd)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resizing, resizeInitialMouseX, resizeInitialWidth])

  return (
    <NodeViewWrapper
      ref={nodeRef}
      className={cn(
        "relative flex flex-col rounded-md border-2 border-transparent transition-all duration-200",
        selected ? "border-blue-300" : "",
        node.attrs.align === "left" && "left-0 -translate-x-0",
        node.attrs.align === "center" && "left-1/2 -translate-x-1/2",
        node.attrs.align === "right" && "left-full -translate-x-full",
      )}
      style={{ width: node.attrs.width }}
    >
      <div className={cn("group relative flex flex-col rounded-md", resizing && "")}>
        <figure className="relative m-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={imageRef}
            src={node.attrs.src}
            alt={node.attrs.alt ?? ""}
            title={node.attrs.title}
            className={cn("rounded-lg transition-shadow duration-200 hover:shadow-lg", isUploading && "opacity-60")}
            onLoad={(e) => {
              const img = e.currentTarget
              const aspectRatio = img.naturalWidth / img.naturalHeight
              updateAttributes({ aspectRatio })
            }}
          />
          {isUploading ? (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-lg bg-muted/40">
              <div className="absolute inset-0 rounded-lg bg-muted/30 animate-pulse motion-reduce:animate-none" />
              <Loader2 className="relative h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : null}
          {isEditable && (
            <>
              <div
                className="absolute inset-y-0 z-20 flex w-[25px] cursor-col-resize items-center justify-start p-2"
                style={{ left: 0 }}
                onMouseDown={(event) => {
                  handleResizingPosition({ e: event, position: "left" });
                }}
                onTouchStart={(event) => handleTouchStart(event, "left")}
              >
                <div className="z-20 h-[70px] w-1 rounded-xl border bg-[rgba(0,0,0,0.65)] opacity-0 transition-all group-hover:opacity-100" />
              </div>
              <div
                className="absolute inset-y-0 z-20 flex w-[25px] cursor-col-resize items-center justify-end p-2"
                style={{ right: 0 }}
                onMouseDown={(event) => {
                  handleResizingPosition({ e: event, position: "right" });
                }}
                onTouchStart={(event) => handleTouchStart(event, "right")}
              >
                <div className="z-20 h-[70px] w-1 rounded-xl border bg-[rgba(0,0,0,0.65)] opacity-0 transition-all group-hover:opacity-100" />
              </div>
            </>
          )}
        </figure>

        {editingCaption && isEditable ? (
          <Input
            ref={captionInputRef}
            aria-label="Image caption"
            value={caption}
            onChange={handleCaptionChange}
            onBlur={handleCaptionBlur}
            onKeyDown={handleCaptionKeyDown}
            className="mt-2 text-center text-base text-muted-foreground sm:text-sm"
            placeholder="Add a caption…"
            autoFocus
          />
        ) : isEditable ? (
          <Button
            ref={captionButtonRef}
            type="button"
            variant="ghost"
            aria-label={node.attrs.caption ? "Edit image caption" : "Add image caption"}
            className="mt-2 h-auto min-h-11 whitespace-normal break-words text-center text-sm font-normal text-muted-foreground sm:min-h-6"
            onClick={beginCaptionEdit}
          >
            {node.attrs.caption || "Add a caption…"}
          </Button>
        ) : node.attrs.caption ? <p className="mt-2 break-words text-center text-sm text-muted-foreground">{node.attrs.caption}</p> : null}

        {isEditable && !isUploading && (
          <div
            className={cn(
              "absolute right-4 top-4 flex items-center gap-1 rounded-md border bg-background/80 p-1 opacity-0 backdrop-blur transition-opacity focus-within:opacity-100",
              !resizing && "group-hover:opacity-100",
              openedMore && "opacity-100",
            )}
          >
            <Button
              type="button"
              aria-label="Align image left"
              aria-pressed={node.attrs.align === "left"}
              size="icon"
              className={cn("size-7", node.attrs.align === "left" && "bg-accent")}
              variant="ghost"
              onClick={() => updateAttributes({ align: "left" })}
            >
              <AlignLeft className="size-4" />
            </Button>
            <Button
              type="button"
              aria-label="Align image center"
              aria-pressed={node.attrs.align === "center"}
              size="icon"
              className={cn("size-7", node.attrs.align === "center" && "bg-accent")}
              variant="ghost"
              onClick={() => updateAttributes({ align: "center" })}
            >
              <AlignCenter className="size-4" />
            </Button>
            <Button
              type="button"
              aria-label="Align image right"
              aria-pressed={node.attrs.align === "right"}
              size="icon"
              className={cn("size-7", node.attrs.align === "right" && "bg-accent")}
              variant="ghost"
              onClick={() => updateAttributes({ align: "right" })}
            >
              <AlignRight className="size-4" />
            </Button>
            <Separator orientation="vertical" className="h-[20px]" />
            <DropdownMenu open={openedMore} onOpenChange={(open) => { if (open) setAltText(node.attrs.alt ?? ""); setOpenedMore(open) }}>
              <DropdownMenuTrigger asChild>
                <Button type="button" size="icon" className="size-7" variant="ghost" aria-label="Image options">
                  <MoreVertical className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="start" alignOffset={-90} className="mt-1 text-sm"
                onCloseAutoFocus={(event) => {
                  if (!captionFocusRequestedRef.current) return
                  captionFocusRequestedRef.current = false
                  if (!editor.isEditable) return
                  event.preventDefault()
                  requestAnimationFrame(() => captionInputRef.current?.focus())
                }}
              >
                <DropdownMenuItem onSelect={() => { captionFocusRequestedRef.current = true; beginCaptionEdit() }}>
                  <Edit className="mr-2 size-4" /> Edit Caption
                </DropdownMenuItem>
                <TiptapImageReplaceControls
                  fileInputRef={fileInputRef}
                  handleFileChange={handleFileChange}
                  uploading={uploading}
                  error={error}
                  imageUrl={imageUrl}
                  setImageUrl={setImageUrl}
                  altText={altText}
                  setAltText={setAltText}
                  handleImageUrlSubmit={handleImageUrlSubmit}
                  saveAltText={() => { updateAttributes({ alt: altText.trim() }); setOpenedMore(false) }}
                />
                <DropdownMenuItem
                  onClick={() => {
                    const image = imageRef.current
                    const aspectRatio = image?.naturalWidth && image.naturalHeight
                      ? image.naturalWidth / image.naturalHeight
                      : Number(node.attrs.aspectRatio)
                    if (Number.isFinite(aspectRatio) && aspectRatio > 0) {
                      const parentWidth = nodeRef.current?.parentElement?.offsetWidth ?? 0
                      updateAttributes({
                        width: parentWidth,
                        height: parentWidth / aspectRatio,
                      })
                    }
                  }}
                >
                  <Maximize className="mr-2 size-4" /> Full Width
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={deleteNode}>
                  <Trash className="mr-2 size-4" /> Delete Image
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>
    </NodeViewWrapper>
  )
}
