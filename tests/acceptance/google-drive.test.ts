import { readFileSync } from "node:fs"
import { join } from "node:path"
import { afterEach, describe, expect, it, vi } from "vitest"
import {
  canReuseGoogleDriveRefreshToken,
  normalizeGoogleDriveFileIds,
  normalizeGoogleDriveOAuthCallbackInput,
  normalizeGoogleDriveReturnPath,
  normalizeGoogleDriveWebViewLink,
} from "@/features/google-drive/lib"

const ROOT = process.cwd()
const readSource = (path: string) => readFileSync(join(ROOT, path), "utf8")
const migration = readSource(
  "supabase/migrations/20260831203000_add_google_drive_documents.sql"
)
const toolsReturnPathMigration = readSource(
  "supabase/migrations/20260902224500_allow_google_drive_tools_return_path.sql"
)

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.resetModules()
})

function stubGoogleDriveServerConfig() {
  vi.stubEnv("GOOGLE_DRIVE_ENABLED", "true")
  vi.stubEnv("GOOGLE_DRIVE_CLIENT_ID", "client-id")
  vi.stubEnv("GOOGLE_DRIVE_CLIENT_SECRET", "client-secret")
  vi.stubEnv(
    "GOOGLE_DRIVE_REDIRECT_URI",
    "https://coachhouse.app/api/integrations/google-drive/callback"
  )
  vi.stubEnv("GOOGLE_DRIVE_PICKER_API_KEY", "picker-developer-key")
  vi.stubEnv("GOOGLE_DRIVE_PICKER_APP_ID", "74627119265")
}

describe("Google Drive Picker failures", () => {
  it.each([
    ["not_configured", 503, "unavailable in this environment", false],
    ["unauthorized", 401, "session expired", false],
    ["forbidden", 403, "permission", false],
    ["google_revoked", 409, "Reconnect in Workspace Tools", true],
    ["missing_refresh_token", 409, "Reconnect in Workspace Tools", true],
    ["scope_denied", 403, "selected-file access", true],
    ["rate_limited", 429, "busy", false],
    ["provider_unavailable", 503, "could not load", false],
    ["refresh-token=secret-value", 500, "could not load", false],
  ])(
    "explains %s without confusing setup with connection state",
    async (code, status, message, requiresReconnect) => {
      const fetchMock = vi
        .fn()
        .mockResolvedValue(Response.json({ ok: false, code }, { status }))
      vi.stubGlobal("fetch", fetchMock)
      const { pickGoogleDriveFiles } =
        await import("@/features/google-drive/client")
      await expect(pickGoogleDriveFiles()).rejects.toMatchObject({
        name: "GoogleDrivePickerError",
        message: expect.stringContaining(message),
        requiresReconnect,
      })
      expect(fetchMock).toHaveBeenCalledExactlyOnceWith(
        "/api/integrations/google-drive/picker-token",
        { method: "POST", cache: "no-store", signal: expect.any(AbortSignal) }
      )
    }
  )

  it.each([
    () => new Response("Unavailable", { status: 502 }),
    () => Response.json(null),
    () => Response.json({ ok: true }),
    () => Response.json({ accessToken: {}, developerKey: 42, appId: [] }),
  ])(
    "handles malformed token responses without asking for reconnection",
    async (response) => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response()))
      const { pickGoogleDriveFiles } =
        await import("@/features/google-drive/client")
      await expect(pickGoogleDriveFiles()).rejects.toMatchObject({
        message: "Google Drive file selection could not load. Try again.",
        requiresReconnect: false,
      })
    }
  )

  it("handles network failures without displaying internal error details", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("private network detail"))
    )
    const { pickGoogleDriveFiles } =
      await import("@/features/google-drive/client")
    await expect(pickGoogleDriveFiles()).rejects.toMatchObject({
      message: "Google Drive file selection could not load. Try again.",
      requiresReconnect: false,
    })
  })
})

describe("Google Drive backend contract", () => {
  it("accepts only bounded, unique Picker file IDs", () => {
    expect(normalizeGoogleDriveFileIds(["abcdefghij", "ABC_123-xyz"])).toEqual([
      "abcdefghij",
      "ABC_123-xyz",
    ])
    expect(normalizeGoogleDriveFileIds(["abcdefghij", "abcdefghij"])).toBeNull()
    expect(normalizeGoogleDriveFileIds(["short"])).toBeNull()
    expect(
      normalizeGoogleDriveFileIds(
        Array.from({ length: 21 }, (_, index) => `drive-file-${index}`)
      )
    ).toBeNull()
  })

  it("stores only safe Google HTTPS view links", () => {
    expect(
      normalizeGoogleDriveWebViewLink("https://docs.google.com/document/d/abc")
    ).toBe("https://docs.google.com/document/d/abc")
    expect(
      normalizeGoogleDriveWebViewLink("http://docs.google.com/document/d/abc")
    ).toBeNull()
    expect(
      normalizeGoogleDriveWebViewLink("https://google.com.evil.example/file")
    ).toBeNull()
  })

  it("bounds callback inputs and redirects only to approved app routes", () => {
    const state = "a".repeat(43)
    expect(
      normalizeGoogleDriveOAuthCallbackInput(state, "4/authorization-code")
    ).toEqual({
      state,
      code: "4/authorization-code",
    })
    expect(normalizeGoogleDriveOAuthCallbackInput("short", "code")).toBeNull()
    expect(
      normalizeGoogleDriveOAuthCallbackInput(state, "code\nvalue")
    ).toBeNull()
    expect(
      normalizeGoogleDriveOAuthCallbackInput(state, "x".repeat(4097))
    ).toBeNull()
    expect(normalizeGoogleDriveReturnPath("/workspace/documents")).toBe(
      "/workspace/documents"
    )
    expect(normalizeGoogleDriveReturnPath("/workspace?drawer=tools")).toBe(
      "/workspace?drawer=tools"
    )
    expect(normalizeGoogleDriveReturnPath("/api/account/delete")).toBe(
      "/organization/documents"
    )
    expect(normalizeGoogleDriveReturnPath("//evil.example")).toBe(
      "/organization/documents"
    )
    expect(toolsReturnPathMigration).toContain("'/workspace?drawer=tools'")
  })

  it("keeps OAuth credentials service-only and forces RLS", () => {
    for (const table of [
      "google_drive_oauth_intents",
      "google_drive_connections",
      "organization_external_documents",
    ]) {
      expect(migration).toContain(
        `alter table public.${table} force row level security`
      )
    }
    expect(migration).toContain(
      "revoke all on public.google_drive_oauth_intents from anon, authenticated"
    )
    expect(migration).toContain(
      "revoke all on public.google_drive_connections from anon, authenticated"
    )
    expect(migration).toContain(
      "grant select on public.organization_external_documents to authenticated"
    )
    expect(migration).not.toContain(
      "grant select on public.google_drive_connections to authenticated"
    )
  })

  it("limits metadata reads to owners and organization members", () => {
    expect(migration).toContain("org_id = (select auth.uid())")
    expect(migration).toContain("membership.member_id = (select auth.uid())")
    expect(migration).toContain("unique (org_id, provider, provider_file_id)")
  })

  it("uses selected-file scope, PKCE, and encrypted refresh-token storage", () => {
    const config = readSource("src/features/google-drive/server/config.ts")
    const service = readSource("src/features/google-drive/server/service.ts")
    const googleApi = readSource(
      "src/features/google-drive/server/google-api.ts"
    )
    const crypto = readSource(
      "src/features/google-drive/server/token-crypto.ts"
    )
    expect(config).toContain("https://www.googleapis.com/auth/drive.file")
    expect(service).toContain('code_challenge_method: "S256"')
    expect(service).not.toContain(
      "https://www.googleapis.com/auth/drive.readonly"
    )
    expect(googleApi).toContain("payload.email_verified !== true")
    expect(crypto).toContain('createCipheriv("aes-256-gcm"')
    expect(crypto).toContain("cipher.setAAD")
    expect(migration).not.toMatch(/\baccess_token\b/)
  })

  it("reuses a stored refresh token only for the same Google subject", () => {
    expect(canReuseGoogleDriveRefreshToken("subject-a", "subject-a")).toBe(true)
    expect(canReuseGoogleDriveRefreshToken("subject-a", "subject-b")).toBe(
      false
    )
    expect(canReuseGoogleDriveRefreshToken(null, "subject-b")).toBe(false)
  })

  it("round-trips secrets only with the matching authenticated context", async () => {
    vi.stubEnv(
      "GOOGLE_DRIVE_TOKEN_ENCRYPTION_KEYS",
      JSON.stringify({ v1: Buffer.alloc(32, 7).toString("base64") })
    )
    vi.stubEnv("GOOGLE_DRIVE_TOKEN_ENCRYPTION_CURRENT_VERSION", "v1")
    const { decryptGoogleDriveSecret, encryptGoogleDriveSecret } =
      await import("@/features/google-drive/server/token-crypto")
    const encrypted = encryptGoogleDriveSecret("refresh-token", "user-1")
    expect(encrypted.ciphertext).not.toContain("refresh-token")
    expect(decryptGoogleDriveSecret(encrypted, "user-1")).toBe("refresh-token")
    expect(() => decryptGoogleDriveSecret(encrypted, "user-2")).toThrow(
      "provider_unavailable"
    )
  })

  it("bounds provider requests and maps revoked refresh tokens", async () => {
    stubGoogleDriveServerConfig()
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: "invalid_grant" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      })
    )
    vi.stubGlobal("fetch", fetchMock)
    const { refreshGoogleDriveAccessToken } =
      await import("@/features/google-drive/server/google-api")

    await expect(
      refreshGoogleDriveAccessToken("refresh-token")
    ).rejects.toMatchObject({
      code: "google_revoked",
      status: 409,
    })
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe("https://oauth2.googleapis.com/token")
    expect(init.signal).toBeInstanceOf(AbortSignal)
    expect(String(init.body)).toContain("grant_type=refresh_token")
  })

  it("rejects unsafe or incorrectly scoped OAuth redirect configuration", async () => {
    stubGoogleDriveServerConfig()
    vi.stubEnv("GOOGLE_DRIVE_REDIRECT_URI", "http://evil.example/callback")
    let config = await import("@/features/google-drive/server/config")
    expect(() => config.getGoogleDriveConfig()).toThrow("not_configured")

    vi.resetModules()
    vi.stubEnv(
      "GOOGLE_DRIVE_REDIRECT_URI",
      "http://localhost:3000/api/integrations/google-drive/callback"
    )
    config = await import("@/features/google-drive/server/config")
    expect(config.getGoogleDriveConfig().redirectUri).toBe(
      "http://localhost:3000/api/integrations/google-drive/callback"
    )
  })

  it("keeps Picker configuration server-owned and validates the App ID", async () => {
    stubGoogleDriveServerConfig()
    let config = await import("@/features/google-drive/server/config")
    expect(config.getGoogleDrivePickerConfig()).toEqual({
      developerKey: "picker-developer-key",
      appId: "74627119265",
    })

    vi.resetModules()
    vi.stubEnv("GOOGLE_DRIVE_PICKER_APP_ID", "not-a-project-number")
    config = await import("@/features/google-drive/server/config")
    expect(() => config.getGoogleDrivePickerConfig()).toThrow("not_configured")
  })

  it("rejects inaccessible files and Drive folders", async () => {
    stubGoogleDriveServerConfig()
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 403 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: "drive-file-folder",
            name: "Folder",
            mimeType: "application/vnd.google-apps.folder",
            webViewLink: "https://drive.google.com/drive/folders/test",
          }),
          { status: 200 }
        )
      )
    vi.stubGlobal("fetch", fetchMock)
    const { getGoogleDriveFile } =
      await import("@/features/google-drive/server/google-api")

    await expect(
      getGoogleDriveFile("access-token", "drive-file-denied")
    ).rejects.toMatchObject({ code: "file_not_authorized", status: 403 })
    await expect(
      getGoogleDriveFile("access-token", "drive-file-folder")
    ).rejects.toMatchObject({ code: "file_not_authorized", status: 403 })
  })

  it("limits UI scope to connection management", () => {
    const connection = readSource(
      "src/features/workspace-tools/components/google-drive-connection.tsx"
    )
    expect(connection).toContain("Google Drive connected")
    expect(connection).toContain("Disconnect Google Drive?")
    expect(connection).not.toContain("picker-token")
    expect(connection).not.toContain("GooglePicker")
  })
  it("exports only the selected Google Doc and keeps its token server-side", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({
          id: "selected-file",
          name: "Board strategy",
          mimeType: "application/vnd.google-apps.document",
          webViewLink: "https://docs.google.com/document/d/selected-file/edit",
        })
      )
      .mockResolvedValueOnce(new Response("fixture document bytes"))
    vi.stubGlobal("fetch", fetchMock)
    const { downloadGoogleDriveDocument } =
      await import("@/features/google-drive/server/file-content")
    const file = await downloadGoogleDriveDocument(
      "private-fixture-token",
      "selected-file"
    )
    expect(file.name).toBe("Board strategy.docx")
    expect(file.bytes.toString()).toBe("fixture document bytes")
    const [url, options] = fetchMock.mock.calls[1]
    expect(url.pathname).toBe("/drive/v3/files/selected-file/export")
    expect(url.searchParams.get("mimeType")).toContain(
      "wordprocessingml.document"
    )
    expect(options).toMatchObject({
      cache: "no-store",
      redirect: "error",
      headers: { authorization: "Bearer private-fixture-token" },
    })
    expect(file).not.toHaveProperty("accessToken")
  })

  it("proxies a bounded Drive thumbnail without exposing its token", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({
          id: "selected-file",
          name: "Board strategy",
          mimeType: "application/vnd.google-apps.document",
          webViewLink: "https://docs.google.com/document/d/selected-file/edit",
          thumbnailLink:
            "https://lh3.googleusercontent.com/drive-thumbnail=s220",
        })
      )
      .mockResolvedValueOnce(
        new Response("thumbnail bytes", {
          headers: { "content-type": "image/png" },
        })
      )
    vi.stubGlobal("fetch", fetchMock)
    const { downloadGoogleDriveThumbnail } =
      await import("@/features/google-drive/server/file-content")
    const preview = await downloadGoogleDriveThumbnail(
      "private-fixture-token",
      "selected-file"
    )

    expect(preview.contentType).toBe("image/png")
    expect(preview.bytes.toString()).toBe("thumbnail bytes")
    expect(fetchMock.mock.calls[1][1]).toMatchObject({
      cache: "no-store",
      redirect: "error",
      headers: { authorization: "Bearer private-fixture-token" },
    })
    expect(preview).not.toHaveProperty("accessToken")
  })

  it("reads selected Word/Markdown blobs and rejects inaccessible or unsupported Google files", async () => {
    const { downloadGoogleDriveDocument } =
      await import("@/features/google-drive/server/file-content")
    let fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({
          id: "selected-file",
          name: "strategy.md",
          mimeType: "text/markdown",
          webViewLink: "https://drive.google.com/file/d/selected-file/view",
        })
      )
      .mockResolvedValueOnce(new Response("# Strategy"))
    vi.stubGlobal("fetch", fetchMock)
    expect(
      (
        await downloadGoogleDriveDocument("token", "selected-file")
      ).bytes.toString()
    ).toBe("# Strategy")
    expect(fetchMock.mock.calls[1][0].searchParams.get("alt")).toBe("media")
    fetchMock = vi.fn().mockResolvedValue(
      Response.json({
        id: "selected-file",
        name: "Budget",
        mimeType: "application/vnd.google-apps.spreadsheet",
        webViewLink:
          "https://docs.google.com/spreadsheets/d/selected-file/edit",
      })
    )
    vi.stubGlobal("fetch", fetchMock)
    await expect(
      downloadGoogleDriveDocument("token", "selected-file")
    ).rejects.toMatchObject({ code: "invalid" })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(null, { status: 403 }))
    )
    await expect(
      downloadGoogleDriveDocument("token", "selected-file")
    ).rejects.toMatchObject({ code: "file_not_authorized" })
  })

  it("bounds streamed Drive content even when Content-Length is absent", async () => {
    const cancel = vi.fn()
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array(15 * 1024 * 1024 + 1))
      },
      cancel,
    })
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({
          id: "selected-file",
          name: "large.docx",
          mimeType: "application/octet-stream",
          webViewLink: "https://drive.google.com/file/d/selected-file/view",
        })
      )
      .mockResolvedValueOnce(new Response(stream))
    vi.stubGlobal("fetch", fetchMock)
    const { downloadGoogleDriveDocument } =
      await import("@/features/google-drive/server/file-content")
    await expect(
      downloadGoogleDriveDocument("token", "selected-file")
    ).rejects.toMatchObject({ status: 413 })
    expect(cancel).toHaveBeenCalled()
  })
})

describe("Google Drive recovery and shared grants", () => {
  it("retries a failed Picker script load without reloading the page", async () => {
    const tokenFetch = vi.fn().mockImplementation(
      async () =>
        new Response(
          JSON.stringify({
            accessToken: "token",
            developerKey: "key",
            appId: "app",
          })
        )
    )
    vi.stubGlobal("fetch", tokenFetch)
    const pickerWindow: Record<string, unknown> = { setTimeout, clearTimeout }
    vi.stubGlobal("window", pickerWindow)
    let attempts = 0
    let removed = 0
    class Script extends EventTarget {
      dataset = {}
      remove() {
        removed++
      }
    }
    class Builder {
      callback = (_: unknown) => {}
      addView() {
        return this
      }
      setAppId() {
        return this
      }
      setDeveloperKey() {
        return this
      }
      setOAuthToken() {
        return this
      }
      setCallback(callback: (data: unknown) => void) {
        this.callback = callback
        return this
      }
      build() {
        return {
          setVisible: () =>
            this.callback({ action: "picked", docs: [{ id: "selected" }] }),
        }
      }
    }
    vi.stubGlobal("document", {
      querySelector: () => null,
      createElement: () => new Script(),
      head: {
        append: (script: Script) => {
          attempts++
          queueMicrotask(() => {
            if (attempts === 1) {
              script.dispatchEvent(new Event("error"))
              return
            }
            pickerWindow.gapi = {
              load: (_: string, options: { callback: () => void }) => {
                pickerWindow.google = {
                  picker: {
                    Action: { PICKED: "picked", CANCEL: "cancel" },
                    ViewId: { DOCS: "docs" },
                    DocsView: class {},
                    PickerBuilder: Builder,
                  },
                }
                options.callback()
              },
            }
            script.dispatchEvent(new Event("load"))
          })
        },
      },
    })
    const { pickGoogleDriveFiles } =
      await import("@/features/google-drive/components/picker")
    await expect(pickGoogleDriveFiles()).rejects.toThrow("could not load")
    await expect(pickGoogleDriveFiles()).resolves.toEqual(["selected"])
    expect(attempts).toBe(2)
    expect(removed).toBe(1)
  })

  it("clears Drive credentials without making a project-wide Google revocation request", async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)
    const update = vi
      .fn()
      .mockReturnValue({ eq: async () => ({ error: null }) })
    const admin = {
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: {
                id: "connection",
                refresh_token_ciphertext: "encrypted",
                refresh_token_iv: "iv",
                refresh_token_auth_tag: "tag",
                key_version: "v1",
              },
              error: null,
            }),
          }),
        }),
        update,
      }),
    }
    const { disconnectGoogleDrive } =
      await import("@/features/google-drive/server/service")
    await disconnectGoogleDrive({ admin: admin as never, userId: "user" })
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        refresh_token_ciphertext: null,
        refresh_token_iv: null,
        refresh_token_auth_tag: null,
        key_version: null,
        status: "disconnected",
      })
    )
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
