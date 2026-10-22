import type { Plugin } from "vite"
import type { AiDocumentProposal, AiDocumentRequest, AiDocumentTarget } from "../../../src/features/workspace-ai/types"
import { initialSection, additionalSection, scope } from "./fixture-data"

// Deterministic UI simulator only. Real authorization, CAS, accounting and atomic
// application SQL are exercised separately by acceptance and disposable-PG tests.
export function fixtureServer(): Plugin {
  let section = structuredClone(initialSection)
  let secondSection=structuredClone(additionalSection)
  const getSection=(id:string)=>id === "mission" ? section : id === "vision" ? secondSection : null
  let runs = new Map<string, AiDocumentProposal>()
  let saves = 0
  let generations = 0
  let control = { delaySave: 0, delayGeneration: 0, dropSaveReply: false, failGeneration: false, omitTerminal: false }
  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
  return { name: "workspace-ai-isolated-fixture", configureServer(server) {
    server.middlewares.use(async (req, res, next) => {
      const path = req.url?.split("?")[0]
      if (!path?.startsWith("/__fixture/") && path !== "/api/workspace/ai/document") {
        if (path?.startsWith("/api/")) { res.statusCode = 404; res.end("Unavailable in fixture"); return }
        next(); return
      }
      res.setHeader("Cache-Control", "no-store")
      const json = (value: unknown, status = 200) => {
        res.statusCode = status; res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify(value))
      }
      try {
        const chunks: Buffer[] = []
        for await (const chunk of req) chunks.push(Buffer.from(chunk))
        const body = JSON.parse(Buffer.concat(chunks).toString() || "{}")
        const sameScope = (target: AiDocumentTarget) => target?.userId === scope.userId && target?.organizationId === scope.organizationId
        if (path === "/__fixture/reset") {
          section = structuredClone(initialSection); secondSection=structuredClone(additionalSection); runs = new Map(); saves = 0; generations = 0
          control = { delaySave: 0, delayGeneration: 0, dropSaveReply: false, failGeneration: false, omitTerminal: false }
          json({ ok: true }); return
        }
        if (path === "/__fixture/control") { control = { ...control, ...body }; json({ ok: true }); return }
        if (path === "/__fixture/collaborator") {
          section = { ...section, content: "<p>A collaborator saved a newer mission.</p>", lastUpdated: new Date().toISOString() }
          json({ ok: true }); return
        }
        if (path === "/__fixture/state") { json({ section, secondSection, saves, generations, runs: [...runs.values()] }); return }
        if (path === "/__fixture/quote") {
          if (!sameScope(body)) { json({ error: "Unavailable organization" }, 403); return }
          const chosen=getSection(body.sectionId)
          if (!chosen || body.revision !== chosen.lastUpdated) { json({ error: "This document changed. Reopen it before asking for a draft." }, 409); return }
          json({ maximumCredits: 25, tariffVersion: "fixture-only", account: { enabled: true,
            lots: [{ kind: "included", credits: 500, spent: generations * 5, reserved: 0, expiresAt: null }], history: [] } }); return
        }
        if (path === "/__fixture/read" || path === "/__fixture/stop") {
          const run = runs.get(body.id)
          if (!run || (body.target && !sameScope(body.target))) { json({ error: "Request unavailable" }, 404); return }
          if (path.endsWith("stop")) { run.status = "canceled"; run.credits = 0; run.content = "" }
          json(run); return
        }
        if (path === "/api/workspace/ai/document") {
          const request = body as AiDocumentRequest
          const chosen=getSection(request.target.sectionId)
          if (!sameScope(request.target) || !chosen || request.target.revision !== chosen.lastUpdated) {
            json({ error: "Document changed before generation.", reserved: false }, 409); return
          }
          generations++
          const run: AiDocumentProposal = { id: request.id, target: request.target, original: chosen.content,
            content: "", status: "running", credits: null, maxCredits: 25, revisionSourceRunId: request.reviseRunId }
          runs.set(run.id, run)
          res.setHeader("Content-Type", "application/x-ndjson")
          res.write(JSON.stringify({ type: "start", id: run.id }) + "\n")
          await sleep(control.delayGeneration)
          if (run.status !== "canceled") {
            run.status = control.failGeneration ? "failed" : "succeeded"
            run.content = control.failGeneration ? "" : request.reviseRunId
              ? "<p>We help neighbors grow thriving community gardens together.</p>"
              : "<p>We equip neighbors to create welcoming community gardens.</p>"
            run.credits = control.failGeneration ? 0 : 5
          }
          res.write(JSON.stringify({ type: "text", text: run.content }) + "\n")
          res.end(control.omitTerminal ? "" : JSON.stringify({ type: "proposal", proposal: run }) + "\n"); return
        }
        if (path === "/__fixture/save") {
          await sleep(control.delaySave)
          const run = runs.get(body.aiRunId)
          const chosen=getSection(body.sectionId)
          if (!chosen) {json({error:"Unknown document"});return}
          if (run?.application?.saved_revision === chosen.lastUpdated) {
            json({ section:chosen, aiApplication: run.application, aiReplay: true }); return
          }
          if (run?.application || body.expectedLastUpdated !== chosen.lastUpdated ||
            (run && run.target.revision !== body.expectedLastUpdated && body.reviewedAiRevision !== body.expectedLastUpdated)) {
            json({error:"This document changed. Review before saving.",code:"conflict",currentSection:chosen,aiApplication:run?.application}); return
          }
          saves++
          const saved = { ...chosen, content: body.content, lastUpdated: new Date().toISOString(),
            status: body.status ?? chosen.status, isPublic: body.isPublic ?? (body.status === "complete" ? true : chosen.isPublic) }
          if (body.sectionId === "mission") section=saved;else secondSection=saved
          if (run) run.application = { run_id: run.id, section_id: saved.id, saved_revision: saved.lastUpdated!,
            content_hash: "a".repeat(64), saved_at: saved.lastUpdated! }
          if (control.dropSaveReply) {
            control.dropSaveReply = false; json({ error: "Fixture lost save reply after commit." }, 503); return
          }
          json({ section:saved, ...(run ? { aiApplication: run.application } : {}) }); return
        }
        json({ error: "Unknown fixture request" }, 404)
      } catch { json({ error: "Invalid fixture request" }, 400) }
    })
  } }
}
