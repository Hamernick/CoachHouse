import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

const mocks = vi.hoisted(() => ({
  client: vi.fn(),
  organization: vi.fn(),
  notification: vi.fn(),
}))
vi.mock("@/lib/supabase/route", () => ({
  createSupabaseRouteHandlerClient: mocks.client,
}))
vi.mock("@/lib/organization/active-org", () => ({
  resolveActiveOrganization: mocks.organization,
  canEditOrganization: (role: string) =>
    ["owner", "admin", "staff"].includes(role),
}))
vi.mock("@/lib/notifications", () => ({
  createNotification: mocks.notification,
}))

import {
  DELETE,
  GET,
  PATCH,
  POST,
} from "@/app/api/account/organization-document-files/route"
import { MAX_BYTES } from "@/lib/organization/document-storage"

const row = {
  id: "file-1",
  name: "archive.bin",
  mime_type: "application/octet-stream",
  size_bytes: 3,
  storage_path: "org-1/library/archive.bin",
  deleted_at: null as string | null,
  created_at: "2026-09-04T12:00:00Z",
  updated_at: "2026-09-04T12:00:00Z",
}

function setup(
  options: {
    storagePath?: string
    authenticated?: boolean
    deletedAt?: string | null
    insertError?: string
    storageError?: string
  } = {}
) {
  const current = {
    ...row,
    storage_path: options.storagePath ?? row.storage_path,
    deleted_at: options.deletedAt ?? null,
  }
  const upload = vi.fn().mockResolvedValue({ error: null })
  const remove = vi.fn().mockResolvedValue({
    error: options.storageError ? { message: options.storageError } : null,
  })
  const signed = vi.fn().mockResolvedValue({
    data: { signedUrl: "https://storage.example/file" },
    error: null,
  })
  const eq = vi.fn()
  const deletion = vi.fn()
  const update = vi.fn()
  const from = vi.fn(() => {
    let action = "select"
    let expired = false
    const result = () => ({
      data: current,
      error:
        action === "insert" && options.insertError
          ? { message: options.insertError }
          : null,
    })
    const query = {
      select: vi.fn(() => query),
      eq: vi.fn((...args: unknown[]) => {
        eq(...args)
        return query
      }),
      is: vi.fn(() => query),
      lt: vi.fn(() => {
        expired = true
        return query
      }),
      limit: vi.fn(() => query),
      order: vi.fn(() => query),
      returns: vi.fn(async () => ({
        data: expired ? [] : [current],
        error: null,
      })),
      maybeSingle: vi.fn(async () => result()),
      single: vi.fn(async () => result()),
      insert: vi.fn((values: Partial<typeof current>) => {
        Object.assign(current, values)
        action = "insert"
        return query
      }),
      update: vi.fn((values: Partial<typeof current>) => {
        update(values)
        Object.assign(current, values)
        return query
      }),
      delete: vi.fn(() => {
        deletion()
        return query
      }),
      then: (resolve: (value: unknown) => unknown) =>
        Promise.resolve(result()).then(resolve),
    }
    return query
  })
  mocks.client.mockReturnValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: {
          user: options.authenticated === false ? null : { id: "user-1" },
        },
        error: null,
      }),
    },
    from,
    storage: {
      from: vi.fn(() => ({ upload, remove, createSignedUrl: signed })),
    },
  })
  return { upload, remove, signed, eq, deletion, update }
}

function uploadRequest(
  file = new File(["bin"], "archive.bin"),
  coreSectionId?: string
) {
  const form = new FormData()
  form.set("file", file)
  if (coreSectionId !== undefined) form.set("coreSectionId", coreSectionId)
  const request = new NextRequest(
    "http://localhost/api/account/organization-document-files",
    { method: "POST" }
  )
  vi.spyOn(request, "formData").mockResolvedValue(form)
  return request
}
function actionRequest(method: string, action?: string) {
  return new NextRequest(
    "http://localhost/api/account/organization-document-files",
    {
      method,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: row.id, action }),
    }
  )
}

describe("organization document file routes", () => {
  it("does not sign a file path belonging to another organization", async () => {
    const { signed } = setup({ storagePath: "other-org/library/private.pdf" })
    const result = await GET(
      new NextRequest(
        "http://localhost/api/account/organization-document-files?id=file-1"
      )
    )
    expect(result.status).toBe(404)
    expect(signed).not.toHaveBeenCalled()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    mocks.organization.mockResolvedValue({ orgId: "org-1", role: "admin" })
    mocks.notification.mockResolvedValue({ id: "notification" })
  })

  it("requires authentication before uploading", async () => {
    const calls = setup({ authenticated: false })
    expect((await POST(uploadRequest())).status).toBe(401)
    expect(calls.upload).not.toHaveBeenCalled()
  })
  it("prevents read-only members from uploading", async () => {
    const calls = setup()
    mocks.organization.mockResolvedValue({ orgId: "org-1", role: "board" })
    expect((await POST(uploadRequest())).status).toBe(403)
    expect(calls.upload).not.toHaveBeenCalled()
  })
  it("accepts arbitrary files without a MIME type", async () => {
    const calls = setup()
    const response = await POST(uploadRequest())
    expect(response.status).toBe(200)
    expect((await response.json()).file.name).toBe(row.name)
    expect(calls.upload).toHaveBeenCalledWith(
      expect.stringMatching(/^org-1\/library\//),
      expect.any(Buffer),
      { contentType: "application/octet-stream" }
    )
  })
  it("keeps a core upload attached through listing, trash, and restore", async () => {
    const calls = setup()
    const uploaded = await POST(uploadRequest(undefined, "budget"))
    expect(uploaded.status).toBe(200)
    expect((await uploaded.json()).file.coreSectionId).toBe("budget")
    expect(calls.upload).toHaveBeenCalledWith(
      expect.stringMatching(/^org-1\/library\/core\/budget\//),
      expect.any(Buffer),
      { contentType: "application/octet-stream" }
    )
    const listed = await GET(
      new NextRequest(
        "http://localhost/api/account/organization-document-files"
      )
    )
    expect((await listed.json()).files[0].coreSectionId).toBe("budget")
    for (const action of ["trash", "restore"]) {
      const response = await PATCH(actionRequest("PATCH", action))
      expect(response.status).toBe(200)
      expect((await response.json()).file.coreSectionId).toBe("budget")
    }
    expect(calls.eq).toHaveBeenCalledWith("org_id", "org-1")
  })
  it.each(["unknown", "../budget", "budget/../../other", " budget", ""])(
    "rejects invalid core section %s",
    async (sectionId) => {
      const calls = setup()
      expect((await POST(uploadRequest(undefined, sectionId))).status).toBe(400)
      expect(calls.upload).not.toHaveBeenCalled()
    }
  )
  it("enforces permissions and shared quota for core uploads", async () => {
    let calls = setup()
    mocks.organization.mockResolvedValue({ orgId: "org-1", role: "board" })
    expect(
      (await POST(uploadRequest(undefined, "board_strategy"))).status
    ).toBe(403)
    expect(calls.upload).not.toHaveBeenCalled()
    mocks.organization.mockResolvedValue({ orgId: "org-1", role: "admin" })
    calls = setup({
      insertError: "Organization document storage quota exceeded.",
    })
    expect(
      (await POST(uploadRequest(undefined, "board_strategy"))).status
    ).toBe(413)
    expect(calls.remove).toHaveBeenCalledWith([
      expect.stringMatching(/^org-1\/library\/core\/board_strategy\//),
    ])
  })
  it("preserves the existing per-file cap", async () => {
    const calls = setup()
    const file = new File(["x"], "large.bin")
    Object.defineProperty(file, "size", { value: MAX_BYTES + 1 })
    const response = await POST(uploadRequest(file))
    expect(response.status).toBe(400)
    expect((await response.json()).error).toContain("15 MB")
    expect(calls.upload).not.toHaveBeenCalled()
  })
  it("rejects empty files", async () => {
    setup()
    expect((await POST(uploadRequest(new File([], "empty.bin")))).status).toBe(
      400
    )
  })
  it("rolls back staged storage when the shared quota rejects metadata", async () => {
    const calls = setup({
      insertError: "Organization document storage quota exceeded.",
    })
    expect((await POST(uploadRequest())).status).toBe(413)
    expect(calls.remove).toHaveBeenCalledTimes(1)
    expect(mocks.notification).not.toHaveBeenCalled()
  })
  it("does not remove a committed upload when notifications fail", async () => {
    const calls = setup()
    mocks.notification.mockRejectedValueOnce(
      new Error("Notifications unavailable")
    )
    expect((await POST(uploadRequest())).status).toBe(200)
    expect(calls.remove).not.toHaveBeenCalled()
  })
  it("will not sign a download for a deleted file", async () => {
    const calls = setup({ deletedAt: "2026-09-04T12:00:00Z" })
    const response = await GET(
      new NextRequest(
        "http://localhost/api/account/organization-document-files?id=file-1&download=true"
      )
    )
    expect(response.status).toBe(409)
    expect(calls.signed).not.toHaveBeenCalled()
    expect(calls.eq).toHaveBeenCalledWith("org_id", "org-1")
  })
  it("does not extend retention when an already-trashed file is trashed again", async () => {
    const deletedAt = "2026-09-01T12:00:00Z"
    const calls = setup({ deletedAt })
    expect((await PATCH(actionRequest("PATCH", "trash"))).status).toBe(200)
    expect(calls.update).toHaveBeenCalledWith({ deleted_at: deletedAt })
  })
  it("restores a trashed file", async () => {
    const calls = setup({ deletedAt: "2026-09-04T12:00:00Z" })
    expect((await PATCH(actionRequest("PATCH", "restore"))).status).toBe(200)
    expect(calls.update).toHaveBeenCalledWith({ deleted_at: null })
  })
  it("requires trash before permanent deletion", async () => {
    const calls = setup()
    expect((await DELETE(actionRequest("DELETE"))).status).toBe(409)
    expect(calls.remove).not.toHaveBeenCalled()
  })
  it("retains quota metadata when permanent storage deletion fails", async () => {
    const calls = setup({
      deletedAt: "2026-09-04T12:00:00Z",
      storageError: "Storage unavailable",
    })
    expect((await DELETE(actionRequest("DELETE"))).status).toBe(500)
    expect(calls.deletion).not.toHaveBeenCalled()
  })
})
