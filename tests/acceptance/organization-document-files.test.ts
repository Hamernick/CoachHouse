import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

const ROOT = process.cwd()

function readSource(relativePath: string) {
  return readFileSync(join(ROOT, relativePath), "utf8")
}

describe("organization document files", () => {
  it("enforces a serialized 5 GB organization quota without changing per-file limits", () => {
    const migration = readSource(
      "supabase/migrations/20260904113000_add_organization_document_library.sql"
    )

    expect(migration).toContain(
      "create table if not exists public.organization_document_files"
    )
    expect(migration).toContain("quota_bytes constant bigint := 5368709120")
    expect(migration).toContain("pg_advisory_xact_lock")
    expect(migration).toContain("Organization document storage quota exceeded.")
    expect(migration).toContain("size_bytes between 0 and 52428800")
    expect(migration).toContain("set allowed_mime_types = null")
    expect(migration).not.toContain("set file_size_limit")
    expect(migration).toContain("organization_document_files_select")
    expect(migration).toContain("organization_document_files_insert")
    expect(migration).toContain("organization_document_files_update")
    expect(migration).toContain("organization_document_files_delete")
    expect(migration).toContain("jsonb_each")
  })

  it("keeps general file selection and limits drag-and-drop to individual slots", () => {
    const route = readSource(
      "src/app/api/account/organization-document-files/route.ts"
    )
    const menu = readSource(
      "src/components/organization/org-profile-card/tabs/documents-tab/components/documents-new-menu.tsx"
    )
    const banner = readSource(
      "src/components/organization/org-profile-card/tabs/documents-tab/components/documents-banner.tsx"
    )
    const storageUsage = readSource(
      "src/components/organization/org-profile-card/tabs/documents-tab/components/documents-storage-usage.tsx"
    )

    expect(route).toContain("@/lib/organization/document-storage")
    expect(route).toContain('file.type || "application/octet-stream"')
    expect(route).not.toContain("Only PDF files are supported")
    expect(route).toContain("{ download: data.name || true }")
    expect(menu).toContain("multiple")
    expect(menu).not.toContain('accept="application/pdf"')
    const slot = readSource(
      "src/components/organization/org-profile-card/tabs/documents-tab/hooks/use-document-slot-drop.ts"
    )
    expect(slot).toContain("onDragEnter")
    expect(slot).toContain("stopPropagation")
    expect(banner).toContain("onDragOver")
    expect(banner).toContain("onDrop")
    expect(banner).not.toContain("Drop files to upload")
    expect(storageUsage).toContain('usedBytes === 0 ? "0"')
    expect(storageUsage).not.toContain('usedBytes === 0 ? "0 B"')
  })

  it("keeps deleted files for 30 days with restore and permanent-delete actions", () => {
    const route = readSource(
      "src/app/api/account/organization-document-files/route.ts"
    )
    const hook = readSource(
      "src/components/organization/org-profile-card/tabs/documents-tab/hooks/use-organization-document-files.ts"
    )
    const grid = readSource(
      "src/components/organization/org-profile-card/tabs/documents-tab/components/documents-library-grid.tsx"
    )

    expect(readSource("src/app/api/account/organization-document-files/file-cleanup.ts")).toContain("const RETENTION_DAYS = 30")
    expect(route).toContain('payload?.action === "trash"')
    expect(route).toContain('payload?.action === "restore"')
    expect(route).toContain("Move the file to Recently Deleted first.")
    expect(route).toContain("await purgeExpiredFiles(supabase, orgId)")
    expect(route.indexOf(".remove([current.storage_path])")).toBeLessThan(
      route.lastIndexOf('.from("organization_document_files")')
    )
    expect(hook).toContain('label: "Undo"')
    expect(hook).not.toContain(
      "setUsedBytes((current) => current - file.sizeBytes)"
    )
    expect(grid).toContain("Deleted files remain here for 30 days")
    const card = readSource(
      "src/components/organization/org-profile-card/tabs/documents-tab/components/documents-library-card.tsx"
    )
    expect(card).toContain("Delete permanently")
    expect(card).toContain("window.confirm")
  })
})
