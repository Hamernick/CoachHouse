import { execFileSync } from "node:child_process"
import { createRequire } from "node:module"
import { describe, expect, it, vi } from "vitest"
import { EditorState } from "@tiptap/pm/state"
import { collab, getVersion, receiveTransaction, sendableSteps } from "@tiptap/pm/collab"
import { history, undo } from "@tiptap/pm/history"
import { Step } from "@tiptap/pm/transform"
import { applyDocumentSteps } from "@/features/organization-document-collaboration/lib"
import { documentSchema, serializeDocument } from "@/features/organization-document-collaboration/lib/schema"
import type { DocumentSession } from "@/features/organization-document-collaboration/types"
import { syncOrganizationDocument } from "@/features/organization-document-collaboration/server/actions"
import { toPlainDocumentJson } from "@/features/organization-document-collaboration/lib/serialization"

vi.mock("@/features/organization-document-collaboration/server/actions", () => ({
  syncOrganizationDocument: vi.fn(), leaveOrganizationDocument: vi.fn(), loadOrganizationDocumentVersions: vi.fn(),
}))

const require = createRequire(import.meta.url)
const flightClient = require("next/dist/compiled/react-server-dom-webpack/client.node") as {
  encodeReply: (input: unknown, options: { temporaryReferences: unknown }) => Promise<string>
  createTemporaryReferenceSet: () => unknown
}
async function throughServerAction(input: unknown) {
  const body = await flightClient.encodeReply([input], { temporaryReferences: flightClient.createTemporaryReferenceSet() })
  // Use Next's actual Flight decoder under React's server condition, not a JSON-only mock.
  const decoded = execFileSync(process.execPath, ["--conditions=react-server", "-e", `
    const { decodeReply, createTemporaryReferenceSet } = require(${JSON.stringify(require.resolve("next/dist/compiled/react-server-dom-webpack/server.node"))});
    Promise.resolve(decodeReply(require('node:fs').readFileSync(0, 'utf8'), {}, {
      temporaryReferences: createTemporaryReferenceSet()
    })).then(([input]) => {
      if (input.initialDocument) input.initialDocument.content[0].attrs.textAlign;
      process.stdout.write(JSON.stringify(input));
    }).catch(error => { process.stderr.write(error.message); process.exitCode = 1; });
  `], { input: body, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] })
  return JSON.parse(decoded)
}

const paragraph = (text: string) => documentSchema.node("doc", null, [documentSchema.node("paragraph", null, text ? documentSchema.text(text) : undefined)])
const client = (id: string) => EditorState.create({ doc: paragraph("Hello"), plugins: [history(), collab({ clientID: id })] })
function state() : DocumentSession {
  return { generation: "test", version: 0, document: paragraph("Hello").toJSON(), steps: [], section_revision: null, section_content: "<p>Hello</p>" }
}
function receive(local: EditorState, remote: DocumentSession) {
  const incoming = remote.steps.slice(getVersion(local) - (remote.version - remote.steps.length))
  return local.apply(receiveTransaction(local, incoming.map(({ step }) => Step.fromJSON(documentSchema, step)), incoming.map(({ clientId }) => clientId)))
}

describe("core document simultaneous editing", () => {
  it("reproduces the reported textAlign error for raw ProseMirror attributes", async () => {
    const initialDocument = paragraph("Hello").toJSON()
    expect(Object.getPrototypeOf(initialDocument.content[0].attrs)).toBeNull()
    await expect(throughServerAction({ initialDocument })).rejects.toThrow("Cannot access textAlign on the server")
  })
  it("sends initialization and edit steps through the real React action boundary", async () => {
    const link = documentSchema.marks.link.create({ href: "https://example.org/help" })
    const doc = documentSchema.node("doc", null, [documentSchema.node("paragraph", { textAlign: "center" }, documentSchema.text("Hello", [link]))])
    const initialDocument = doc.toJSON()
    const initial = { organizationId: "org", sectionId: "fundraising-strategy", clientId: "coach:tab", version: 0, initialDocument, expectedRevision: null }
    const local = EditorState.create({ doc })
    const steps = local.tr.setNodeMarkup(0, undefined, { textAlign: "right" }).addMark(1, 6, documentSchema.marks.link.create({ href: "https://example.org/new" })).steps.map(step => step.toJSON())
    const update = { ...initial, initialDocument: undefined, generation: "session", steps, selection: { anchor: 1, head: 6, version: 0 } }
    vi.mocked(syncOrganizationDocument).mockImplementation(async input => {
      expect(await throughServerAction(input)).toEqual(JSON.parse(JSON.stringify(input)))
      return { error: "transport verified" }
    })
    await expect(syncOrganizationDocument(toPlainDocumentJson(initial))).resolves.toEqual({ error: "transport verified" })
    await expect(syncOrganizationDocument(toPlainDocumentJson(update))).resolves.toEqual({ error: "transport verified" })
    expect(Object.getPrototypeOf(initialDocument.content[0].attrs)).toBeNull()
    const saved = applyDocumentSteps({ ...state(), document: toPlainDocumentJson(initialDocument) }, toPlainDocumentJson(steps), "coach")
    expect(saved.document.content?.[0].attrs?.textAlign).toBe("right")
    expect(Object.getPrototypeOf(saved.document.content?.[0].attrs)).toBe(Object.prototype)
    expect(serializeDocument(documentSchema.nodeFromJSON(saved.document))).toContain('href="https://example.org/new"')
  })
  it("rebases two same-position edits without losing either contribution", () => {
    let a = client("coach"), b = client("member"), server = state()
    a = a.apply(a.tr.insertText(" coach", 6))
    b = b.apply(b.tr.insertText(" member", 6))
    server = applyDocumentSteps(server, sendableSteps(a)!.steps.map(step => step.toJSON()), "coach")
    a = receive(a, server)
    b = receive(b, server)
    server = applyDocumentSteps(server, sendableSteps(b)!.steps.map(step => step.toJSON()), "member")
    a = receive(a, server); b = receive(b, server)
    expect(a.doc.eq(b.doc)).toBe(true)
    expect(a.doc.textContent).toContain("coach")
    expect(a.doc.textContent).toContain("member")
    expect(sendableSteps(a)).toBeNull()
    expect(sendableSteps(b)).toBeNull()
    expect(getVersion(a)).toBe(2)
  })
  it("local undo preserves another editor's saved contribution", () => {
    let a = client("coach"), b = client("member"), server = state()
    a = a.apply(a.tr.insertText(" coach", 6))
    server = applyDocumentSteps(server, sendableSteps(a)!.steps.map(step => step.toJSON()), "coach")
    a = receive(a, server); b = receive(b, server)
    b = b.apply(b.tr.insertText(" member", b.doc.content.size - 1))
    server = applyDocumentSteps(server, sendableSteps(b)!.steps.map(step => step.toJSON()), "member")
    a = receive(a, server); b = receive(b, server)
    undo(a, transaction => { a = a.apply(transaction) })
    expect(a.doc.textContent).toContain("member")
    expect(a.doc.textContent).not.toContain("coach")
  })
  it("duplicate acknowledgement does not duplicate text", () => {
    let a = client("coach")
    a = a.apply(a.tr.insertText(" once", 6))
    const server = applyDocumentSteps(state(), sendableSteps(a)!.steps.map(step => step.toJSON()), "coach")
    a = receive(a, server); a = receive(a, server)
    expect(a.doc.textContent).toBe("Hello once")
  })
  it("rejects malformed steps and invalid documents", () => {
    expect(() => applyDocumentSteps(state(), [{ stepType: "unknown" }], "coach")).toThrow()
    expect(() => applyDocumentSteps({ ...state(), document: { type: "untrusted" } }, [], "coach")).toThrow()
    expect(() => applyDocumentSteps(state(), Array(201).fill({}), "coach")).toThrow()
  })
  it("serializes nested content and escapes text without a browser DOM", () => {
    const doc = paragraph('<script>"&')
    expect(serializeDocument(doc)).toBe('<p>&lt;script&gt;&quot;&amp;</p>')
  })
})
