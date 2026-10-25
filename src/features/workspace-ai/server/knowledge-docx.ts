import "server-only"
import { inflateRawSync } from "node:zlib"
import { createZipArchive, crc32, type ZipEntry } from "@/lib/files/simple-zip"

export const MAX_KNOWLEDGE_DOCX_BYTES = 2 * 1024 * 1024
const MAX_XML_BYTES = 512 * 1024
const invalid = () => new Error("DOCX contents could not be read within the supported limits.")

/** Repack bounded XML only before handing it to the established document parser.
 * ZIP headers alone are not a decompression limit: inflate also has a hard output cap. */
function boundedDocumentArchive(input: Buffer): Buffer {
  if (input.length < 22 || input.length > MAX_KNOWLEDGE_DOCX_BYTES) throw invalid()
  let end = -1
  for (let i = input.length - 22; i >= Math.max(0, input.length - 65557); i--) {
    if (input.readUInt32LE(i) === 0x06054b50 && i + 22 + input.readUInt16LE(i + 20) === input.length) { end = i; break }
  }
  if (end < 0 || input.readUInt16LE(end + 4) || input.readUInt16LE(end + 6)) throw invalid()
  const count = input.readUInt16LE(end + 10), start = input.readUInt32LE(end + 16), size = input.readUInt32LE(end + 12)
  if (!count || count > 256 || input.readUInt16LE(end + 8) !== count || start + size !== end) throw invalid()
  const entries: ZipEntry[] = [], names = new Set<string>()
  let cursor = start, expanded = 0
  for (let index = 0; index < count; index++) {
    if (cursor + 46 > end || input.readUInt32LE(cursor) !== 0x02014b50) throw invalid()
    const flags = input.readUInt16LE(cursor + 8), method = input.readUInt16LE(cursor + 10)
    const compressedSize = input.readUInt32LE(cursor + 20), expectedSize = input.readUInt32LE(cursor + 24)
    const nameSize = input.readUInt16LE(cursor + 28), extraSize = input.readUInt16LE(cursor + 30), commentSize = input.readUInt16LE(cursor + 32)
    const local = input.readUInt32LE(cursor + 42), next = cursor + 46 + nameSize + extraSize + commentSize
    if (next > end || input.readUInt16LE(cursor + 34) || flags & 1 || ![0, 8].includes(method)) throw invalid()
    const name = new TextDecoder("utf-8", { fatal: true }).decode(input.subarray(cursor + 46, cursor + 46 + nameSize))
    if (!name || names.has(name) || name.startsWith("/") || name.includes("\\") || name.includes("\0") || name.split("/").some(part => part === ".." || part === ".")) throw invalid()
    names.add(name)
    const keep = name === "[Content_Types].xml" || name === "_rels/.rels" || /^word\/[A-Za-z0-9_./-]+\.(?:xml|rels)$/.test(name)
    if (keep) {
      if (local + 30 > start || input.readUInt32LE(local) !== 0x04034b50 || input.readUInt16LE(local + 6) !== flags || input.readUInt16LE(local + 8) !== method) throw invalid()
      const localNameSize = input.readUInt16LE(local + 26), dataStart = local + 30 + localNameSize + input.readUInt16LE(local + 28)
      if (dataStart + compressedSize > start || input.subarray(local + 30, local + 30 + localNameSize).toString("utf8") !== name || !expectedSize || expectedSize > MAX_XML_BYTES) throw invalid()
      const compressed = input.subarray(dataStart, dataStart + compressedSize)
      const data = method === 8 ? inflateRawSync(compressed, { maxOutputLength: MAX_XML_BYTES }) : compressed
      expanded += data.length
      if (data.length !== expectedSize || crc32(data) !== input.readUInt32LE(cursor + 16) || expanded > MAX_KNOWLEDGE_DOCX_BYTES) throw invalid()
      const xml = new TextDecoder("utf-8", { fatal: true }).decode(data)
      if (/<!DOCTYPE|<!ENTITY/i.test(xml)) throw invalid()
      let depth = 0, tags = 0
      for (const tag of xml.matchAll(/<\/?[A-Za-z_][^>]*>/g)) {
        if (++tags > 40000) throw invalid()
        if (tag[0].startsWith("</")) depth--
        else if (!tag[0].endsWith("/>")) depth++
        if (depth > 128 || depth < 0) throw invalid()
      }
      entries.push({ name, data })
    }
    cursor = next
  }
  if (cursor !== end || !names.has("word/document.xml")) throw invalid()
  return createZipArchive(entries)
}

export async function extractKnowledgeDocx(input: Buffer): Promise<string> {
  const buffer = boundedDocumentArchive(input)
  const { extractRawText } = await import("mammoth")
  // Buffer-only input keeps external file access disabled; no URL or local file path is passed.
  const result = await extractRawText({ buffer })
  return result.value
}
