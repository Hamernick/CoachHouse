import { createRequire } from "node:module"
import { createServer } from "node:http"
import { fileURLToPath } from "node:url"

const require = createRequire(import.meta.url)
const { build } = require("esbuild")
const { outputFiles } = await build({
  entryPoints: [fileURLToPath(new URL("./fixture.tsx", import.meta.url))],
  bundle: true,
  write: false,
  jsx: "automatic",
  define: { "process.env.NODE_ENV": '"production"', "process.env": "{}" },
  minify: true,
  plugins: [
    {
      name: "fixture-server-boundary",
      setup(build) {
        build.onResolve({ filter: /^server-only$/ }, () => ({
          path: "server-only",
          namespace: "fixture",
        }))
        build.onLoad({ filter: /.*/, namespace: "fixture" }, () => ({
          contents: "export {}",
        }))
      },
    },
  ],
})
const html = `<!doctype html><meta name="viewport" content="width=device-width, initial-scale=1"><title>About us tabs fixture</title>
<style>body{font:14px system-ui;margin:24px}main{max-width:740px;margin:auto}nav{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:28px}button{font:inherit;cursor:pointer;padding:8px 12px}[role=tablist]{display:flex;flex-wrap:wrap;gap:4px;margin:12px 0}[role=tab]{border:1px solid #ccc;border-radius:999px;background:white}[role=tab][aria-selected=true]{background:#ddd}[hidden]{display:none!important}.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}[contenteditable]{min-height:160px;border:1px solid #888;padding:12px}svg{width:16px;height:16px}h1{font-size:20px}</style>
<div id="root"></div><script>window.addEventListener("error", event => { const error = document.createElement("pre"); error.textContent = event.message; document.body.append(error) })</script><script src="fixture.js"></script>`
const server = createServer((request, response) => {
  response.setHeader("Cache-Control", "no-store")
  response.setHeader(
    "Content-Type",
    request.url === "/fixture.js" ? "text/javascript" : "text/html"
  )
  response.end(request.url === "/fixture.js" ? outputFiles[0].contents : html)
})
server.listen(3043, "127.0.0.1", () =>
  console.log("Fixture: http://127.0.0.1:3043/ (Ctrl-C stops)")
)
