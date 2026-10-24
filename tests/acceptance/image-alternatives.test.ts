import { readFileSync, readdirSync } from "node:fs"
import path from "node:path"
import ts from "typescript"
import { expect, it } from "vitest"

it("requires an explicit alternative on every owned image callsite", () => {
  function files(root: string): string[] {
    return readdirSync(root, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? files(path.join(root, entry.name)) : [path.join(root, entry.name)])
  }
  const missing: string[] = []
  for (const file of files("src").filter(file => /\.[jt]sx?$/.test(file))) {
    const source = readFileSync(file, "utf8")
    if (!/<(?:img|[\w.]*Image)\b/.test(source)) continue
    const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
    function visit(node: ts.Node) {
      if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
        const tag = node.tagName.getText(ast)
        const forwardingAvatar = tag === "AvatarPrimitive.Image" && ["src/components/ui/avatar.tsx", "src/features/platform-admin-dashboard/upstream/components/ui/avatar.tsx"].includes(file)
        if (!forwardingAvatar && (tag === "img" || /Image$/.test(tag)) && !node.attributes.properties.some(attribute => ts.isJsxAttribute(attribute) && attribute.name.getText(ast) === "alt" && attribute.initializer)) {
          missing.push(`${file}:${ast.getLineAndCharacterOfPosition(node.getStart()).line + 1}`)
        }
      }
      ts.forEachChild(node, visit)
    }
    visit(ast)
  }
  expect(missing).toEqual([])
})
