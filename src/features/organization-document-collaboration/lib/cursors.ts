import { Plugin, PluginKey } from "@tiptap/pm/state"
import { Decoration, DecorationSet } from "@tiptap/pm/view"
import type { DocumentParticipant } from "../types"
export const documentCursorsKey = new PluginKey<DecorationSet>("core-document-cursors")
export function documentCursorsPlugin() {
  return new Plugin<DecorationSet>({
    key: documentCursorsKey,
    state: {
      init: () => DecorationSet.empty,
      apply(transaction, previous) {
        const participants = transaction.getMeta(documentCursorsKey) as DocumentParticipant[] | undefined
        if (!participants) return previous.map(transaction.mapping, transaction.doc)
        const decorations = participants.flatMap(participant => {
          if (!participant.selection) return []
          const position = Math.min(transaction.doc.content.size, Math.max(0, participant.selection.head))
          return [Decoration.widget(position, () => {
            const caret = document.createElement("span")
            caret.className = "relative border-l-2 border-primary pointer-events-none"
            const label = document.createElement("span")
            label.className = "absolute bottom-full left-0 whitespace-nowrap rounded bg-primary px-1 text-[10px] text-primary-foreground"
            label.textContent = participant.display_name
            caret.append(label)
            return caret
          }, { key: participant.session_id, side: -1 })]
        })
        return DecorationSet.create(transaction.doc, decorations)
      },
    },
    props: { decorations: state => documentCursorsKey.getState(state) },
  })
}
