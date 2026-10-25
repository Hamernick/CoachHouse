"use client"

import Image from "@tiptap/extension-image"
import { ReactNodeViewRenderer } from "@tiptap/react"

import { TiptapImage } from "@/components/tiptap/extensions/tiptap-image-node-view"

export const ImageExtension = Image.extend({
  addOptions() {
    const parent = this.parent?.()
    return {
      ...parent,
      inline: parent?.inline ?? false,
      allowBase64: parent?.allowBase64 ?? false,
      HTMLAttributes: parent?.HTMLAttributes ?? {},
      resize: parent?.resize ?? false,
      uploadImage: null,
    }
  },

  addAttributes() {
    return {
      src: {
        default: null,
      },
      alt: {
        default: "",
      },
      title: {
        default: null,
      },
      width: {
        default: "100%",
      },
      height: {
        default: null,
      },
      align: {
        default: "center",
      },
      caption: {
        default: "",
      },
      aspectRatio: {
        default: null,
      },
      uploading: {
        default: null,
      },
      uploadId: {
        default: null,
      },
    }
  },

  addNodeView: () => {
    return ReactNodeViewRenderer(TiptapImage)
  },
})
