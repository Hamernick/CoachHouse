import "server-only"
import { Worker } from "node:worker_threads"
import { pathToFileURL } from "node:url"
import { z } from "zod"

export const MAX_KNOWLEDGE_PDF_BYTES = 15 * 1024 * 1024
export const PDF_LIMITS = { pages: 40, characters: 200000, itemsPerPage: 20000, timeoutMs: 10000, heapMb: 128 } as const
const resultSchema = z.strictObject({ startPage: z.number().int().positive(), content: z.string().max(PDF_LIMITS.characters), totalPages: z.number().int().positive(),
  pages: z.array(z.strictObject({ page: z.number().int().positive(), start: z.number().int().nonnegative(), end: z.number().int().nonnegative() })).max(PDF_LIMITS.pages) }).refine(value => value.pages.length === Math.min(value.totalPages-value.startPage+1,PDF_LIMITS.pages) &&
  value.pages.every((page,index) => page.page === value.startPage+index && page.end >= page.start && page.end <= value.content.length && page.start >= (value.pages[index-1]?.end ?? 0)) &&
  value.pages.at(-1)?.end === value.content.length, "Invalid PDF page offsets")
export type PdfText = z.infer<typeof resultSchema>
export class KnowledgePdfError extends Error {
  constructor(readonly reason: "unsupported" | "limit") { super(reason === "limit" ? "PDF parsing exceeded its limits." : "PDF text is encrypted, malformed or unsupported.") }
}

// Trusted worker program only; PDF JavaScript is never evaluated. The parser
// receives bytes, no source URL/path/credentials. Termination interrupts parser
// CPU work as well as async reads; resourceLimits bounds V8 heap, not total RSS.
const workerProgram = String.raw`
const { parentPort, workerData } = require("node:worker_threads");
(async () => {
  globalThis.fetch = async () => { throw Error("External PDF reads disabled"); };
  const { getDocument } = await import(workerData.moduleUrl);
  class NoAssets { async fetch() { throw Error("External PDF assets unsupported"); } }
  const task = getDocument({ data: workerData.bytes, isEvalSupported: false, useSystemFonts: false,
    disableFontFace: true, useWorkerFetch: false, enableXfa: false, stopAtErrors: true,
    isOffscreenCanvasSupported: false, isImageDecoderSupported: false, maxImageSize: 0,
    CMapReaderFactory: NoAssets, StandardFontDataFactory: NoAssets, WasmFactory: NoAssets, verbosity: 0 });
  try {
    const pdf = await task.promise;
    const { info } = await pdf.getMetadata();
    if (info.EncryptFilterName || info.IsXFAPresent) throw Error("Unsupported PDF");
    let content = "";
    const pages = [];
    if (workerData.startPage > pdf.numPages) throw Error("Unsupported window");
    for (let pageNumber = workerData.startPage; pageNumber <= Math.min(pdf.numPages, workerData.startPage + workerData.limits.pages - 1); pageNumber++) {
      const page = await pdf.getPage(pageNumber);
      const reader = page.streamTextContent({ disableNormalization: false, includeMarkedContent: false }).getReader();
      let text = "", items = 0;
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          for (const item of value.items) {
            if (++items > workerData.limits.itemsPerPage) throw Error("limit");
            if (typeof item.str !== "string") continue;
            text += item.str.replace(/\r\n?/g, "\n") + (item.hasEOL ? "\n" : " ");
            if (content.length + text.length > workerData.limits.characters) throw Error("limit");
          }
        }
      } finally { await reader.cancel(); page.cleanup(); }
      text = text.trim();
      // Two LF characters delimit pages, never fabricated page labels/headings.
      if (text && content) content += "\n\n";
      const start = content.length;
      content += text;
      if (content.length > workerData.limits.characters) throw Error("limit");
      pages.push({ page: pageNumber, start, end: content.length });
    }
    parentPort.postMessage({ result: { startPage: workerData.startPage, content, totalPages: pdf.numPages, pages } });
  } finally { await task.destroy(); }
})().catch(error => parentPort.postMessage({ error: error.message === "limit" ? "limit" : "unsupported" }));
`

export async function extractKnowledgePdf(input: Buffer, signal?: AbortSignal, startPage = 1): Promise<PdfText> {
  signal?.throwIfAborted()
  if (!Number.isSafeInteger(startPage) || startPage < 1) throw new KnowledgePdfError("unsupported")
  if (!input.length || input.length > MAX_KNOWLEDGE_PDF_BYTES) throw new KnowledgePdfError("limit")
  if (!input.subarray(0,8).toString("ascii").startsWith("%PDF-")) throw new KnowledgePdfError("unsupported")
  // Static native resolution lets Next trace the parser and its DOMMatrix
  // runtime without importing either native/parser module into the app thread.
  // getBuiltinModule preserves native resolution (bundlers rewrite require.resolve).
  require.resolve("@napi-rs/canvas")
  const moduleUrl = pathToFileURL(process.getBuiltinModule("module").createRequire(`${process.cwd()}/package.json`).resolve("pdfjs-dist/legacy/build/pdf.mjs")).href
  // Transfer an owned copy; never detach or alter the canonical source bytes.
  const workerBytes = new Uint8Array(input)
  const worker = new Worker(workerProgram, { eval: true, env: {}, stdout: true, stderr: true,
    workerData: { startPage, bytes: workerBytes, moduleUrl, limits: PDF_LIMITS },
    transferList: [workerBytes.buffer],
    resourceLimits: { maxOldGenerationSizeMb: PDF_LIMITS.heapMb, maxYoungGenerationSizeMb: 16, stackSizeMb: 4 } })
  // Parser diagnostics may contain private text/paths; never forward them.
  worker.stdout.resume(); worker.stderr.resume()
  let timer: ReturnType<typeof setTimeout> | undefined
  let abort: (() => void) | undefined
  try {
    return await new Promise<PdfText>((resolve,reject) => {
      abort = () => reject(signal?.reason ?? new Error("PDF read canceled"))
      signal?.addEventListener("abort",abort,{once:true})
      if (signal?.aborted) { abort(); return }
      timer = setTimeout(() => reject(new KnowledgePdfError("limit")),PDF_LIMITS.timeoutMs)
      worker.once("error",(error: Error & { code?: string }) => reject(new KnowledgePdfError(error.code === "ERR_WORKER_OUT_OF_MEMORY" ? "limit" : "unsupported")))
      worker.once("exit",() => reject(new KnowledgePdfError("unsupported")))
      worker.once("message",message => {
        if (message.error) reject(new KnowledgePdfError(message.error === "limit" ? "limit" : "unsupported"))
        else { const parsed = resultSchema.safeParse(message.result); if (parsed.success) resolve(parsed.data); else reject(new KnowledgePdfError("unsupported")) }
      })
    })
  } finally {
    if (timer) clearTimeout(timer)
    if (abort) signal?.removeEventListener("abort",abort)
    await worker.terminate()
  }
}
