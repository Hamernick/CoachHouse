import {
  boundedDocumentText,
  type DocumentContent,
} from "./particle-document-content"

self.onmessage = async (
  event: MessageEvent<{ format: string; buffer: ArrayBuffer }>
) => {
  try {
    const { format, buffer } = event.data
    let content: DocumentContent
    if (format === "docx") {
      const { extractRawText } = await import("mammoth/mammoth.browser")
      const result = await extractRawText({ arrayBuffer: buffer })
      content = boundedDocumentText(result.value)
    } else {
      const text = new TextDecoder("utf-8", { fatal: true }).decode(buffer)
      if (text.includes("\u0000")) throw new Error("Use a UTF-8 text file.")
      if (format === "csv") {
        const { default: Papa } = await import("papaparse")
        const result = Papa.parse<string[]>(text, {
          preview: 1001,
          skipEmptyLines: true,
        })
        if (result.errors.some((error) => error.type === "Quotes"))
          throw new Error("This CSV has an unclosed quoted field.")
        content = {
          kind: "table",
          rows: result.data
            .slice(0, 1000)
            .map((row) => row.slice(0, 50).map((cell) => cell.slice(0, 2000))),
          truncated:
            Boolean(result.meta.truncated) ||
            result.data.length > 1000 ||
            result.data.some(
              (row) => row.length > 50 || row.some((cell) => cell.length > 2000)
            ),
        }
      } else content = boundedDocumentText(text)
    }
    self.postMessage({ content })
  } catch {
    self.postMessage({
      error:
        "This file could not be previewed. Open the original or upload a UTF-8 text file / valid DOCX.",
    })
  }
}
