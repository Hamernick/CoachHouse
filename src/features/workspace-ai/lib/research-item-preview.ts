import { generatedResearchSchema } from "../research-types"
import { z } from "zod"

const itemSchema = generatedResearchSchema.shape.items.element
// Presentation cannot carry bindings, links, executable relationships or sources.
export const researchItemPreviewSchema = itemSchema.pick({ key: true, title: true, kind: true, description: true })
export type ResearchItemPreview = z.infer<typeof researchItemPreviewSchema>

/** Frame only closed objects inside the root items array. JSON/schema validation
 * happens before disclosure; this is not a partial-JSON parser or repair path. */
export function createResearchItemParser() {
  let buffer = "", bytes = 0, quoted = false, escaped = false, itemStart = -1
  let inItems = false, foundItems = false, invalid = false
  const stack: string[] = [], keys = new Set<string>()
  return (delta: string) => {
    const items: z.infer<typeof itemSchema>[] = []
    if (invalid) return { items, invalid }
    bytes += new TextEncoder().encode(delta).byteLength
    if (bytes > 32768) { invalid = true; buffer = ""; return { items, invalid } }
    const offset = buffer.length
    buffer += delta
    try {
      for (let index = offset; index < buffer.length; index++) {
        const char = buffer[index]
        if (quoted) {
          if (escaped) escaped = false
          else if (char === "\\") escaped = true
          else if (char === '"') quoted = false
          continue
        }
        if (char === '"') { quoted = true; continue }
        if (char === "{" || char === "[") {
          if (char === "[" && stack.length === 1 && stack[0] === "{") {
            // A complete root prefix establishes the actual property, including
            // escaped names, without matching text inside descriptions.
            const prefix = JSON.parse(buffer.slice(0, index) + "[]}")
            if (Object.keys(prefix).at(-1) === "items") {
              if (foundItems) throw new Error("Repeated items.")
              foundItems = inItems = true
            }
          }
          if (inItems && stack.length === 2 && char === "{") itemStart = index
          stack.push(char)
        } else if (char === "}" || char === "]") {
          if (stack.at(-1) !== (char === "}" ? "{" : "[")) throw new Error("Invalid JSON frame.")
          if (inItems && stack.length === 3 && char === "}" && itemStart >= 0) {
            const item = itemSchema.parse(JSON.parse(buffer.slice(itemStart, index + 1)))
            if (keys.has(item.key) || keys.size >= 12) throw new Error("Invalid preview items.")
            keys.add(item.key); items.push(item); itemStart = -1
          }
          if (inItems && stack.length === 2 && char === "]") inItems = false
          stack.pop()
        }
      }
    } catch { invalid = true; buffer = ""; items.length = 0 }
    return { items, invalid }
  }
}
