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

  it("accepts general files and provides signed downloads", () => {
    const route = readSource(
      "src/app/api/account/organization-document-files/route.ts"
    )
    expect(route).toContain("@/lib/organization/document-storage")
    expect(route).toContain('file.type || "application/octet-stream"')
    expect(route).not.toContain("Only PDF files are supported")
    expect(route).toContain("{ download: data.name || true }")

  })

  it("keeps deleted files for 30 days with restore and permanent-delete actions", () => {
    const route = readSource(
      "src/app/api/account/organization-document-files/route.ts"
    )
    expect(readSource("src/app/api/account/organization-document-files/file-cleanup.ts")).toContain("const RETENTION_DAYS = 30")
    expect(route).toContain('payload?.action === "trash"')
    expect(route).toContain('payload?.action === "restore"')
    expect(route).toContain("Move the file to Recently Deleted first.")
    expect(route).toContain("await purgeExpiredFiles(supabase, orgId,")
    expect(route).toContain("await permanentlyPurgeDocument(orgId, fileId,")
    expect(route).not.toContain(".remove([current.storage_path])")

  })
})
