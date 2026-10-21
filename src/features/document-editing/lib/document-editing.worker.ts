import type { JSONContent } from "@tiptap/core"
import { createMarkdownAdapter } from "./markdown-adapter"

export type MarkdownWorkerResult =
  | { kind: "ready"; document: JSONContent }
  | { kind: "source"; reason: string }

self.onmessage = (event: MessageEvent<{ content: string }>) => {
  let result: MarkdownWorkerResult
  try {
    const document = createMarkdownAdapter().parse(event.data.content)
    const pending = [document]
    let nodes = 0
    while (pending.length) {
      const node = pending.pop()
      if (++nodes > 5000) throw new Error("This document exceeds the current rich-view budget. Use its complete source view.")
      if (node?.content) pending.push(...node.content)
    }
    result = { kind: "ready", document }
  } catch (error) {
    result = { kind: "source", reason: error instanceof Error ? error.message : "Use the complete source view for this document." }
  }
  self.postMessage(result)
}
