import type { MutableRefObject } from "react"

import type { AnyExtension } from "@tiptap/core"
import CharacterCount from "@tiptap/extension-character-count"
import HardBreak from "@tiptap/extension-hard-break"
import HorizontalRule from "@tiptap/extension-horizontal-rule"
import Link from "@tiptap/extension-link"
import Placeholder from "@tiptap/extension-placeholder"
import Subscript from "@tiptap/extension-subscript"
import Superscript from "@tiptap/extension-superscript"
import { Table, TableCell, TableHeader, TableRow } from "@tiptap/extension-table"
import TextAlign from "@tiptap/extension-text-align"
import Typography from "@tiptap/extension-typography"
import Underline from "@tiptap/extension-underline"
import StarterKit from "@tiptap/starter-kit"

import { ImageExtension } from "@/components/tiptap/extensions/image"

type BuildRichTextExtensionsParams = {
  placeholderRef: MutableRefObject<string>
  isReadOnly: boolean
  enableImages: boolean
  onImageUpload?: (file: File) => Promise<string>
  fileSession?: boolean
  collaborativeHistory?: boolean
}

export function buildRichTextExtensions({
  placeholderRef,
  isReadOnly,
  enableImages,
  onImageUpload,
  fileSession = false,
  collaborativeHistory = false,
}: BuildRichTextExtensionsParams): AnyExtension[] {
  return [
    StarterKit.configure({
      heading: {
        levels: fileSession ? [1, 2, 3, 4, 5, 6] : [1, 2, 3],
      },
      orderedList: {
        HTMLAttributes: {
          class: "list-decimal",
        },
      },
      bulletList: {
        HTMLAttributes: {
          class: "list-disc",
        },
      },
      link: false,
      underline: false,
      hardBreak: false,
      horizontalRule: false,
      codeBlock: fileSession ? {} : false,
      ...(collaborativeHistory ? { undoRedo: false } : {}),
    }),
    TextAlign.configure({
      types: ["heading", "paragraph"],
    }),
    Table.configure({
      resizable: true,
    }),
    TableRow,
    TableHeader,
    TableCell,
    Subscript,
    Superscript,
    Underline,
    Link.configure({
      openOnClick: false,
      autolink: true,
      linkOnPaste: true,
      HTMLAttributes: {
        class: "text-primary underline underline-offset-2",
      },
    }),
    Placeholder.configure({
      placeholder: () => placeholderRef.current,
      emptyEditorClass: "is-editor-empty",
      emptyNodeClass: "is-editor-empty",
      showOnlyWhenEditable: !isReadOnly,
      showOnlyCurrent: false,
      includeChildren: false,
    }),
    ...(fileSession ? [] : [Typography]),
    CharacterCount.configure(),
    HardBreak.configure({
      keepMarks: true,
    }),
    HorizontalRule,
    ...(enableImages
      ? [
          ImageExtension.configure({
            uploadImage: onImageUpload,
          } as Record<string, unknown>),
        ]
      : []),
  ]
}
