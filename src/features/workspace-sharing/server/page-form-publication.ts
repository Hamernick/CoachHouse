import "server-only"

import { createFormVersion } from "@/features/organization-forms"
import type { WorkspacePageSnapshot } from "../types"
import { publicationHash } from "./page-projection"

/** Review identity includes the exact snapshot and page revision. Old publications
 * remain previews until explicitly reviewed and published with an intake binding. */
export function bindPageForms(snapshot: WorkspacePageSnapshot, pageId: string, revision: number) {
  const versions = snapshot.items.flatMap((item) => {
    if (item.content.kind !== "form") return []
    const hash = publicationHash({ pageId, revision, item })
    const id = `${hash.slice(0, 8)}-${hash.slice(8, 12)}-5${hash.slice(13, 16)}-8${hash.slice(17, 20)}-${hash.slice(20, 32)}`
    item.content.intakeVersionId = id
    return [createFormVersion({ id, formId: item.id, revision: revision + 1,
      title: item.title, description: item.description ?? "", definition: item.content.definition })]
  })
  return versions
}
