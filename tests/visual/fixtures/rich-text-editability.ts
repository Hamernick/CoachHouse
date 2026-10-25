import path from "node:path"
import { build } from "vite"
import tailwindcss from "@tailwindcss/postcss"

let fixtureBundle: Promise<string> | undefined

export async function buildRichTextEditabilityFixture(initialValue = "<p>Existing text</p>") {
  fixtureBundle ??= buildFixtureBundle()
  return `document.getElementById("root").dataset.initialValue = ${JSON.stringify(initialValue)};\n${await fixtureBundle}`
}

async function buildFixtureBundle() {
  const entry = path.resolve("virtual-rich-text-editability.js")
  const result = await build({
    configFile: false,
    logLevel: "error",
    define: { "process.env.NODE_ENV": JSON.stringify("production") },
    resolve: { alias: { "@": path.resolve("src") } },
    esbuild: { jsx: "automatic" },
    css: { postcss: { plugins: [tailwindcss()] } },
    plugins: [{
      name: "rich-text-editability-regression",
      resolveId: id => id === entry ? entry : undefined,
      load: id => id === entry ? `
        import "@/app/globals.css";
        import React from "react";
        import { createRoot } from "react-dom/client";
        import { RichTextEditor } from "@/components/rich-text-editor";
        function App() {
          const [readOnly, setReadOnly] = React.useState(true);
          const [updates, setUpdates] = React.useState(0);
          const [value, setValue] = React.useState(document.getElementById("root").dataset.initialValue ?? "");
          const [version, setVersion] = React.useState(0);
          return React.createElement(React.Fragment, null,
            React.createElement("button", { onClick: () => setReadOnly(value => !value) }, "Toggle access"),
            React.createElement("output", null, String(updates)),
            React.createElement("button", { onClick: () => setVersion(value => value + 1) }, "Reload editor"),
            React.createElement("pre", { "data-testid": "saved-html" }, value),
            React.createElement(RichTextEditor, {
              key: version,
              value,
              applyExternalValue: false,
              preserveImages: true,
              onImageUpload: async () => "https://example.org/photo.jpg",
              ariaLabel: "Document",
              readOnly,
              onChange: html => { setValue(html); setUpdates(value => value + 1); },
            })
          );
        }
        createRoot(document.getElementById("root")).render(React.createElement(App));
      ` : undefined,
    }],
    build: { write: false, lib: { entry, name: "RichTextEditability", formats: ["iife"] } },
  })
  const bundle = Array.isArray(result) ? result[0] : result
  if (!("output" in bundle)) throw new Error("Expected an in-memory bundle")
  const chunk = bundle.output.find(file => file.type === "chunk")
  if (!chunk || chunk.type !== "chunk") throw new Error("Missing fixture bundle")
  const css = bundle.output.filter(file => file.type === "asset" && file.fileName.endsWith(".css")).map(file => file.type === "asset" ? String(file.source) : "").join("\n")
  if (!css) throw new Error("Missing application styles in editor fixture")
  return `const style = document.createElement("style"); style.textContent = ${JSON.stringify(css)}; document.head.appendChild(style);\n${chunk.code}`
}
