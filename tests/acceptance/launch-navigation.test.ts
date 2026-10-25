import { existsSync, readFileSync, readdirSync, statSync } from "node:fs"
import path from "node:path"
import ts from "typescript"
import { describe, expect, it } from "vitest"

function files(root: string): string[] {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(root, entry.name)
    return entry.isDirectory() ? files(file) : [file]
  })
}

const routes = files("src/app")
  .filter((file) => /(?:page\.tsx|route\.ts)$/.test(file) && !file.includes("/@"))
  .map((file) => "/" + path.dirname(file).split(path.sep).slice(2).filter((part) => !part.startsWith("(")).join("/"))
  // An unknown literal route must not pass just because the public-handle route exists.
  .filter((route) => route !== "/[org]")
  .map((route) => new RegExp("^" + route.replace(/[.*+?^${}()|\\]/g, "\\$&")
    .replace(/\[\.\.\.[^\]]+\]/g, ".+").replace(/\[[^\]]+\]/g, "[^/]+") + "/?$"))

const links: Array<{ file: string; href: string }> = []
for (const file of files("src").filter((file) => /\.(ts|tsx)$/.test(file) && !file.includes("/visual-regression/"))) {
  const ast = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  function visit(node: ts.Node) {
    if ((ts.isJsxAttribute(node) || ts.isPropertyAssignment(node)) && ["href", "to", "ctaHref"].includes(node.name.getText(ast))) {
      let value: ts.Node | undefined = node.initializer
      if (value && ts.isJsxExpression(value)) value = value.expression
      if (value && (ts.isStringLiteral(value) || ts.isNoSubstitutionTemplateLiteral(value))) links.push({ file, href: value.text })
    }
    ts.forEachChild(node, visit)
  }
  visit(ast)
}

describe("owned literal navigation destinations", () => {
  it.each(links)("resolves $href in $file", ({ file, href }) => {
    expect(href, file).not.toBe("")
    expect(href, file).not.toBe("#")
    expect(href, file).not.toMatch(/^javascript:/i)
    if (!href.startsWith("/") || href.startsWith("//")) return
    const pathname = href.split(/[?#]/)[0]
    const asset = path.join("public", decodeURIComponent(pathname))
    expect((existsSync(asset) && statSync(asset).isFile()) || routes.some((route) => route.test(pathname)), `${file}: ${href}`).toBe(true)
  })
})
