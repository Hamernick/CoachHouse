import path from "node:path"
import { build } from "vite"

export async function buildRichTextEditabilityFixture() {
  const entry = path.resolve("virtual-rich-text-editability.js")
  const result = await build({
    configFile: false,
    logLevel: "error",
    define: { "process.env.NODE_ENV": JSON.stringify("production") },
    resolve: { alias: { "@": path.resolve("src") } },
    esbuild: { jsx: "automatic" },
    plugins: [{
      name: "rich-text-editability-regression",
      resolveId: id => id === entry ? entry : undefined,
      load: id => id === entry ? `
        import React from "react";
        import { createRoot } from "react-dom/client";
        import { RichTextEditor } from "@/components/rich-text-editor";
        function App() {
          const [readOnly, setReadOnly] = React.useState(true);
          const [updates, setUpdates] = React.useState(0);
          return React.createElement(React.Fragment, null,
            React.createElement("button", { onClick: () => setReadOnly(value => !value) }, "Toggle access"),
            React.createElement("output", null, String(updates)),
            React.createElement(RichTextEditor, {
              value: "<p>Existing text</p>",
              applyExternalValue: false,
              ariaLabel: "Document",
              readOnly,
              onChange: () => setUpdates(value => value + 1),
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
  return chunk.code
}
