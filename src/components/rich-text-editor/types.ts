import type { ReactNode } from "react"
import type { AnyExtension, Content, Editor } from "@tiptap/core"
import type { Transaction } from "@tiptap/pm/state"

/** Native-document ownership for file sessions and collaboration bindings.
 * Controlled roadmap consumers continue using value/onChange unchanged. */
export type RichTextEditorSession = {
  extensions?: AnyExtension[]
  active: boolean
  onReady?: (editor: Editor | null) => void
  onUpdate: (editor: Editor, transaction: Transaction) => void
} & (
  | { history: "local"; initialContent: Content }
  // The authoritative CRDT checkpoint initializes the shared document once.
  // Seeding plain content in each client would duplicate initial paragraphs.
  | { history: "collaborative"; initialContent?: never }
)

export type LinkPreviewMeta = {
  title?: string | null
  description?: string | null
  image?: string | null
}

export type LinkPreviewMetaMap = Record<string, LinkPreviewMeta>

export type RichTextEditorProps = {
  basicToolbar?: boolean
  hideLinkPreviews?: boolean
  value: string
  onChange: (value: string) => void
  ariaLabel?: string
  readOnly?: boolean
  placeholder?: string
  className?: string
  mode?: "default" | "compact" | "homework"
  minHeight?: number
  maxHeight?: number
  stableScrollbars?: boolean
  toolbarActions?: ReactNode
  toolbarTrailingActions?: ReactNode
  disableResize?: boolean
  onImageUpload?: (file: File) => Promise<string>
  onImageUploaded?: (payload: {
    url: string
    file: File
  }) => void | Promise<void>
  insertUploadedImage?: boolean
  preserveImages?: boolean
  onImagePickerReady?: (open: (() => void) | null) => void
  toolbarPortalId?: string
  toolbarClassName?: string
  editorClassName?: string
  header?: ReactNode
  headerClassName?: string
  countClassName?: string
  contentClassName?: string
  session?: RichTextEditorSession
}
