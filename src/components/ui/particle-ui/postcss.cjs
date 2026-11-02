const { readFileSync } = require("node:fs")
const { dirname, join } = require("node:path")
const postcss = require("postcss")

const scope = ':where(.particle-ui, [data-radix-popper-content-wrapper]:has(.particle-ui-menu))'

/** Keep the pinned SDK's foundation inside migrated surfaces, including portals.
 * Do not import its global Tailwind resets, breakpoints or utility replacements.
 * Component CSS modules remain supplied by the package, unchanged.
 */
function particleUiFoundation() {
  return {
    postcssPlugin: "coach-house-particle-ui",
    Once(document) {
      document.walkAtRules("particle-ui-foundation", rule => {
        const directory = dirname(require.resolve("@openai/apps-sdk-ui/css"))
        const files = ["base", "variables-primitive", "variables-semantic", "variables-components", "globals"]
        const root = postcss.root()
        for (const file of files) {
          const filename = join(directory, `${file}.css`)
          root.append(postcss.parse(readFileSync(filename, "utf8"), { from: filename }).nodes)
        }
        root.walkAtRules("custom-variant", node => node.remove())
        root.walkAtRules("theme", node => {
          const tokens = postcss.rule({ selector: scope })
          node.walkDecls(declaration => {
            if (!declaration.prop.includes("*")) tokens.append(declaration.clone())
          })
          node.replaceWith(tokens)
        })
        root.walkRules(node => {
          if (node.selector === scope || node.parent?.type === "atrule" && node.parent.name.includes("keyframes")) return
          node.selectors = node.selectors.map(selector => {
            // Application .dark is server/next-themes owned; portals inherit it.
            if (selector.includes('[data-theme="dark"]')) return `.dark ${scope}${selector.replace(':where([data-theme="dark"])', '')}`
            if (selector.includes('[data-theme="light"]')) return `:root:not(.dark) ${scope}${selector.replace(':where([data-theme="light"])', '')}`
            if ([":root", ":where(:root)", ":host", "html", ":where([data-theme])"].includes(selector)) return scope
            return `${scope} ${selector}`
          })
        })
        rule.replaceWith(root.nodes)
      })
    },
  }
}
particleUiFoundation.postcss = true

module.exports = particleUiFoundation
