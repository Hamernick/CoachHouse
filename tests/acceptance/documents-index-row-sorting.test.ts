import { describe, expect, it } from "vitest"

import { STATUS_SORT_RANK } from "@/components/organization/org-profile-card/tabs/documents-tab/constants"
import { sortDocumentRows } from "@/components/organization/org-profile-card/tabs/documents-tab/hooks/documents-index-row-sorting"
import type {
  DocumentIndexRow,
  DocumentStatus,
  UploadRow,
} from "@/components/organization/org-profile-card/tabs/documents-tab/types"

function makeUploadRow(
  status: DocumentStatus,
  overrides: Partial<UploadRow> = {}
): UploadRow {
  return {
    id: `upload-${status}`,
    source: "upload",
    name: status,
    description: status,
    categories: ["General"],
    status,
    visibility: "private",
    updatedAt: "2026-06-06T12:00:00.000Z",
    definition: {
      kind: `kind-${status}`,
      key: "verificationLetter",
      title: status,
      description: status,
      defaultName: `${status}.pdf`,
      category: "General",
    },
    document: null,
    ...overrides,
  }
}

describe("documents index row sorting", () => {
  it("keeps ready and in-progress documents at the top by default status sort", () => {
    const rows: DocumentIndexRow[] = [
      makeUploadRow("missing"),
      makeUploadRow("not_started"),
      makeUploadRow("ready"),
      makeUploadRow("in_progress"),
      makeUploadRow("published"),
    ]

    expect(
      sortDocumentRows(rows, "status", "asc").map((row) => row.status)
    ).toEqual(["ready", "in_progress", "published", "missing", "not_started"])
    expect(STATUS_SORT_RANK.ready).toBeLessThan(STATUS_SORT_RANK.missing)
    expect(STATUS_SORT_RANK.in_progress).toBeLessThan(
      STATUS_SORT_RANK.not_started
    )
  })
})
