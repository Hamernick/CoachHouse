"use client"

import { EditorContent, useEditor } from "@tiptap/react"
import { useCallback, useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"

import { useWorkspaceWindowHeaderActive } from "@/components/workspace/workspace-window-header-slots"
import { SelectionAssistanceMenu } from "@/features/workspace-ai/client"

import { cn } from "@/lib/utils"
import { LinkPreviewCard } from "@/components/rich-text-editor/components/link-preview-card"
import { RichTextToolbar } from "@/components/rich-text-editor/components/rich-text-toolbar"
import { buildRichTextExtensions } from "@/components/rich-text-editor/extensions"
import {
  extractLinks,
  syncPlaceholderState,
} from "@/components/rich-text-editor/helpers"
import { useImageUploadHandler } from "@/components/rich-text-editor/hooks/use-image-upload-handler"
import { useLinkPreviews } from "@/components/rich-text-editor/hooks/use-link-previews"
import type { RichTextEditorProps } from "@/components/rich-text-editor/types"

export function RichTextEditor({
  basicToolbar = false,
  hideLinkPreviews = false,
  value,
  onReady,
  applyExternalValue = true,
  onChange,
  ariaLabel,
  readOnly = false,
  placeholder = "Start typing...",
  className,
  mode = "default",
  minHeight,
  maxHeight,
  stableScrollbars = false,
  toolbarActions,
  toolbarTrailingActions,
  disableResize = false,
  onImageUpload,
  onImageUploaded,
  insertUploadedImage = true,
  preserveImages = false,
  linkPreviews = true,
  onImagePickerReady,
  toolbarPortalId,
  toolbarClassName,
  editorClassName,
  header,
  headerClassName,
  countClassName,
  contentClassName,
  session,
}: RichTextEditorProps) {
  const contextActive = useWorkspaceWindowHeaderActive()
  const applyingRef = useRef(false)
  const sessionRef = useRef(session)
  sessionRef.current = session
  const [counts, setCounts] = useState({ words: 0, chars: 0 })
  const [links, setLinks] = useState<string[]>([])
  const metadataTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const refreshMetadata = useCallback((instance: import("@tiptap/core").Editor) => {
    if (instance.isDestroyed) return
    setCounts({
      words: instance.storage.characterCount?.words?.() ?? 0,
      chars: instance.storage.characterCount?.characters?.() ?? 0,
    })
    const next = extractLinks(instance.getJSON())
    setLinks((current) =>
      current.length === next.length && current.every((url, index) => url === next[index])
        ? current
        : next
    )
    syncPlaceholderState(instance)
  }, [])
  const scheduleMetadata = useCallback((instance: import("@tiptap/core").Editor) => {
    if (metadataTimer.current) clearTimeout(metadataTimer.current)
    if (sessionRef.current && !sessionRef.current.active) return
    metadataTimer.current = setTimeout(() => {
      metadataTimer.current = null
      refreshMetadata(instance)
    }, 300)
  }, [refreshMetadata])
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const placeholderRef = useRef(placeholder)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [toolbarTarget, setToolbarTarget] = useState<HTMLElement | null>(null)
  const isReadOnly = Boolean(readOnly)
  const enableImages = typeof onImageUpload === "function" && !isReadOnly
  const editorMinHeight =
    typeof minHeight === "number" && minHeight > 0
      ? `${Math.round(minHeight)}px`
      : undefined
  const editorMaxHeight =
    typeof maxHeight === "number" && maxHeight > 0
      ? `${Math.round(maxHeight)}px`
      : undefined
  const editorStyle = [
    editorMinHeight ? `min-height: ${editorMinHeight};` : "",
    editorMaxHeight ? `max-height: ${editorMaxHeight};` : "",
    stableScrollbars ? "scrollbar-gutter: stable;" : "",
  ].join("")
  const overflowClass = stableScrollbars
    ? "overflow-y-scroll overflow-x-auto"
    : "overflow-auto"
  const resizeClass = disableResize ? "resize-none" : "resize-y"

  useEffect(() => {
    placeholderRef.current = placeholder
  }, [placeholder])

  if (
    session?.history === "collaborative" &&
    !session.extensions?.some((extension) => extension.name === "collaboration")
  ) {
    throw new Error("A collaborative file session requires a collaboration extension.")
  }

  const editor = useEditor({
    editable: !isReadOnly,
    extensions: [...buildRichTextExtensions({
      placeholderRef,
      isReadOnly,
      enableImages: enableImages || preserveImages,
      onImageUpload,
      fileSession: Boolean(session),
      collaborativeHistory: session?.history === "collaborative",
    }), ...(session?.extensions ?? [])],
    content: session?.history === "collaborative" ? undefined : session?.initialContent ?? value,
    ...(session ? { shouldRerenderOnTransaction: false } : {}),
    onUpdate: ({ editor, transaction }) => {
      if (applyingRef.current) return
      const currentSession = sessionRef.current
      if (currentSession) {
        currentSession.onUpdate(editor, transaction)
        scheduleMetadata(editor)
        return
      }
      onChange(editor.getHTML())
      setCounts({
        words: editor.storage.characterCount?.words?.() ?? 0,
        chars: editor.storage.characterCount?.characters?.() ?? 0,
      })
      setLinks(extractLinks(editor.getJSON()))
      syncPlaceholderState(editor)
    },
    editorProps: {
      attributes: {
        class: cn(
          "tiptap block w-full min-w-0 break-words prose prose-sm dark:prose-invert max-w-none min-h-[240px] bg-transparent dark:bg-input/30 px-4 py-3 focus:outline-none cursor-text",
          resizeClass,
          overflowClass,
          "prose-h1:text-3xl prose-h1:font-bold prose-h1:tracking-tight prose-h2:text-2xl prose-h2:font-semibold prose-h3:text-xl prose-h3:font-semibold",
          "prose-p:my-3 prose-ul:list-disc prose-ol:list-decimal prose-ul:pl-5 prose-ol:pl-6 prose-ol:list-inside",
          "prose-blockquote:border-l-2 prose-blockquote:border-primary/50 prose-blockquote:pl-4 prose-blockquote:text-muted-foreground",
          "prose-code:bg-muted prose-code:px-1.5 prose-code:py-1 prose-code:rounded-md prose-code:text-sm",
          "prose-hr:border-border prose-hr:my-6 prose-img:my-4 prose-img:rounded-lg prose-img:border prose-img:border-border/60",
          "[&_table]:my-4 [&_table]:w-full [&_table]:border-collapse [&_table]:overflow-hidden [&_table]:rounded-lg [&_td]:border [&_td]:border-border/70 [&_td]:px-3 [&_td]:py-2 [&_td]:align-top [&_th]:border [&_th]:border-border/70 [&_th]:bg-muted [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:font-semibold",
          editorClassName
        ),
        style: editorStyle,
        ...(ariaLabel ? { "aria-label": ariaLabel } : {}),
      },
      handleKeyDown: (_view, event) => {
        if (
          (event.metaKey || event.ctrlKey) &&
          event.key.toLowerCase() === "a"
        ) {
          if (!editor) return false
          event.preventDefault()
          editor.chain().focus().selectAll().run()
          return true
        }
        if (event.key !== "Enter" || !event.shiftKey) return false
        if (!editor) return false
        event.preventDefault()
        editor.chain().focus().setHardBreak().run()
        return true
      },
    },
    immediatelyRender: false,
  })
  const linkMeta = useLinkPreviews(links, {
    active: linkPreviews && !hideLinkPreviews && (session?.active ?? true),
    bounded: Boolean(session),
  })

  const onSessionReady = session?.onReady
  useEffect(() => {
    if (!editor || !onSessionReady) return
    onSessionReady(editor)
    return () => onSessionReady(null)
  }, [editor, onSessionReady])

  const sessionActive = session?.active
  useEffect(() => {
    if (sessionActive === undefined || !editor) return
    if (sessionActive) scheduleMetadata(editor)
    return () => {
      if (metadataTimer.current) clearTimeout(metadataTimer.current)
      metadataTimer.current = null
    }
  }, [editor, sessionActive, scheduleMetadata])
  useEffect(() => {
    if (!editor || editor.isDestroyed) return
    // Tiptap preserves editable across option updates; connection and permission
    // changes must update the live editor without emitting a content change.
    editor.setEditable(!isReadOnly, false)
  }, [editor, isReadOnly])

  useEffect(() => {
    if (editor) onReady?.(editor)
  }, [editor, onReady])

  useEffect(() => {
    if (!editor) return
    setCounts({
      words: editor.storage.characterCount?.words?.() ?? 0,
      chars: editor.storage.characterCount?.characters?.() ?? 0,
    })
  }, [editor])

  useEffect(() => {
    if (!toolbarPortalId) return
    if (typeof document === "undefined") return
    setToolbarTarget(document.getElementById(toolbarPortalId))
  }, [toolbarPortalId])

  useEffect(() => {
    if (!applyExternalValue || !editor || sessionRef.current || typeof value !== "string") return
    const current = editor.getHTML()
    if (current !== value) {
      applyingRef.current = true
      let cancelled = false
      const applyContent = () => {
        if (cancelled || !editor) return
        editor.commands.setContent(value)
        setCounts({
          words: editor.storage.characterCount?.words?.() ?? 0,
          chars: editor.storage.characterCount?.characters?.() ?? 0,
        })
        setLinks(extractLinks(editor.getJSON()))
        syncPlaceholderState(editor)
        queueMicrotask(() => {
          applyingRef.current = false
        })
      }
      if (typeof window !== "undefined") {
        requestAnimationFrame(applyContent)
      } else {
        applyContent()
      }
      return () => {
        cancelled = true
      }
    }
  }, [applyExternalValue, editor, value])

  useEffect(() => {
    if (!editor) return
    syncPlaceholderState(editor)
  }, [editor])

  useEffect(() => {
    if (!onImagePickerReady) return
    if (!enableImages || !editor) {
      onImagePickerReady(null)
      return
    }
    const open = () => fileInputRef.current?.click()
    onImagePickerReady(open)
    return () => onImagePickerReady(null)
  }, [editor, enableImages, onImagePickerReady])

  const handleImagePick = useImageUploadHandler({
    editor,
    onImageUpload,
    onImageUploaded,
    insertUploadedImage,
    setUploadingImage,
    fileInputRef,
  })

  if (!editor) {
    return null
  }

  const compact = mode === "compact" || mode === "homework"

  const toolbar = isReadOnly ? null : (
    <RichTextToolbar
      editor={editor}
      basic={basicToolbar}
      compact={compact}
      enableImages={enableImages}
      uploadingImage={uploadingImage}
      onImagePick={() => fileInputRef.current?.click()}
      toolbarActions={toolbarActions}
      toolbarTrailingActions={toolbarTrailingActions}
      toolbarClassName={toolbarClassName}
      subscribeToState={Boolean(session)}
    />
  )

  const handleWrapperMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    if (isReadOnly) return
    const target = event.target as HTMLElement
    if (
      target.closest("button, a, input, textarea, [data-editor-focus-ignore]")
    )
      return
    if (target.closest("[contenteditable='true'], .ProseMirror")) return
    editor.chain().focus().run()
  }

  const editorHeader = header ? (
    <div className={cn("text-muted-foreground px-3 pt-3 text-sm", headerClassName)}>
      {header}
    </div>
  ) : null

  return (
    <>
      <div
        className={cn(
          "bg-card dark:border-border/60 w-full max-w-full min-w-full overflow-hidden rounded-2xl border shadow-sm",
          className
        )}
      >
        {toolbarPortalId ? null : toolbar}
        {enableImages ? (
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={handleImagePick}
          />
        ) : null}
        <div
          className="flex min-h-0 flex-1 flex-col"
          onMouseDown={handleWrapperMouseDown}
        >
          {editorHeader}
          <div
            className={cn(
              "bg-muted/30 text-muted-foreground flex items-center justify-end gap-2 px-3 py-2 text-xs",
              countClassName
            )}
          >
            <span className="whitespace-nowrap">
              {counts.words} {counts.words === 1 ? "word" : "words"} •{" "}
              {counts.chars} {counts.chars === 1 ? "character" : "characters"}
            </span>
          </div>
          <div className={cn("flex min-h-0 flex-1 flex-col", contentClassName)}>
            <EditorContent editor={editor} />
            {!isReadOnly && <SelectionAssistanceMenu key={editor.instanceId} editor={editor} label={ariaLabel} active={contextActive && (session?.active ?? true)} />}
          </div>
          {linkPreviews && !hideLinkPreviews && links.length > 0 ? (
            <div className="bg-muted/20 flex flex-wrap items-center gap-2 rounded-b-md border-t px-3 py-2">
              {links.map((href) => (
                <LinkPreviewCard key={href} href={href} meta={linkMeta[href]} />
              ))}
            </div>
          ) : null}
        </div>
      </div>
      {toolbarPortalId && toolbarTarget && toolbar
        ? createPortal(toolbar, toolbarTarget)
        : null}
    </>
  )
}
