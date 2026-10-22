import "server-only"
import { createHash } from "node:crypto"
import { reserveAiRun, claimAiRun, settleAiRun, reconcileAiRun, readAiRun } from "@/features/ai-credits"
import { sanitizeHtml } from "@/lib/markdown/sanitize"
import { stripHtml } from "@/lib/markdown/convert"
import { aiDocumentRequestSchema, aiRunProposal } from "../lib"
import { loadAiDocument } from "./document-context"
import { workspaceAiConfig } from "./config"
import { documentInstructions, streamDocumentDraft } from "./provider"
import type { AiStreamPart } from "../types"
import { readAiRequestBody } from "./request-body"

export async function handleWorkspaceAiDocument(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin)
    return Response.json({ error: "Request origin not allowed." }, { status: 403 })
  let reservedId: string | null = null
  try {
    const config = workspaceAiConfig()
    const input = aiDocumentRequestSchema.parse(await readAiRequestBody(request))
    if (input.tariffVersion !== config.tariff.version || input.maximumCredits < config.maxCredits)
      throw new Error("The AI price changed. Review the current maximum before continuing.")
    const actor = await loadAiDocument(input.target)
    const target = { ...input.target, title: actor.section.title, content: actor.section.content }
    const context = JSON.stringify({ document: { title: target.title, content: target.content }, request: input.prompt })
    if (Buffer.byteLength(context + documentInstructions) + 1024 > config.maxInputBytes) throw new Error("This request exceeds the current context limit.")
    const hash = createHash("sha256").update(JSON.stringify({ target, prompt: input.prompt, tariff: config.tariff })).digest("hex")
    const reserved = await reserveAiRun({ id: input.id, organizationId: actor.organizationId,
      actorId: actor.userId, hash, target, prompt: input.prompt, tariff: config.tariff,
      maxCredits: config.maxCredits, maxCost: config.maxCost })
    if (!reserved.created) return Response.json({ proposal: aiRunProposal(reserved.run) })
    reservedId = input.id
    if (!(await claimAiRun(input.id,actor.userId))) {
      const settled = await settleAiRun({ id: input.id, status: "failed", usage: { input: 0,cachedInput: 0,output: 0 },
        tariff: config.tariff, maxCredits: config.maxCredits, proposal: null,responseId: null })
      return Response.json({ proposal: aiRunProposal(settled) })
    }
    const encoder = new TextEncoder()
    // Finish the bounded provider request after a client disconnect so usage can
    // be settled. Stop is a durable command; SQL releases its customer charge.
    const signal = AbortSignal.timeout(90000)
    const stream = new ReadableStream<Uint8Array>({
      async start(output) {
        const send = (part: AiStreamPart) => { try { output.enqueue(encoder.encode(JSON.stringify(part) + "\n")) } catch { /* client disconnected; accounting still completes */ } }
        let responseId: string | null = null
        send({ type: "start", id: input.id })
        try {
          const result = await streamDocumentDraft({ model: config.tariff.model, context,
            maxOutputTokens: config.maxOutputTokens, signal,
            onText: text => send({ type: "text", text }), onResponse: id => { responseId=id },
          })
          if (!result.usage) throw new Error("The provider has not confirmed usage.")
          const proposal = sanitizeHtml(result.text).trim()
          const status = signal.aborted ? "canceled" : result.completed && stripHtml(proposal).trim() ? "succeeded" : "failed"
          const saved = await settleAiRun({ id: input.id, status, usage: result.usage, tariff: config.tariff,
            maxCredits: config.maxCredits, proposal: status === "succeeded" ? proposal : null, responseId })
          // Revoked members cannot receive the final private document.
          const readable = await readAiRun(input.id,actor.organizationId,actor.userId)
          if (!readable) throw new Error("Your document access changed.")
          send({ type: "proposal", proposal: aiRunProposal(saved) })
        } catch {
          // A disconnected stream is not proof of zero provider cost. Durable
          // reconciliation holds the budget instead of blindly retrying.
          await reconcileAiRun(input.id,responseId).catch(() => undefined)
          send({ type: "error", id: input.id, message: "Request interrupted. Check its status before retrying; credits remain reserved until usage is confirmed." })
        } finally { try { output.close() } catch { /* canceled reader */ } }
      },
    })
    return new Response(stream, { headers: { "Content-Type": "application/x-ndjson", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } })
  } catch (error) {
    if (reservedId) await reconcileAiRun(reservedId,null).catch(() => undefined)
    return Response.json({ error: error instanceof Error ? error.message : "AI assistance is unavailable." }, { status: 400 })
  }
}
