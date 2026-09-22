import { createRequire } from "node:module"
import { createServer } from "node:http"
import { fileURLToPath } from "node:url"

const require = createRequire(import.meta.url)
const { buildSync } = require("esbuild")
const { outputFiles } = buildSync({
  entryPoints: [fileURLToPath(new URL("./mount-fixture.tsx", import.meta.url))],
  bundle: true,
  write: false,
  define: { "process.env.NODE_ENV": '"production"' },
  minify: true,
})
const html = `<!doctype html><title>Workspace drawer mount regression</title>
<style>body{font:14px system-ui}#root{display:grid;grid-template-columns:1fr 1fr;gap:20px}.canvas{position:relative;height:220px;overflow:hidden;background:#ddd}.drawer{position:absolute;bottom:0;left:0;right:0;height:100%;background:#eee;border:1px solid #555;box-sizing:border-box;margin:0}h2{font-size:16px}button{margin:8px}</style>
<div id="root"></div><script src="fixture.js"></script>`
const server = createServer((request, response) => {
  response.setHeader("Cache-Control", "no-store")
  response.setHeader("Content-Type", request.url === "/fixture.js" ? "text/javascript" : "text/html")
  response.end(request.url === "/fixture.js" ? outputFiles[0].contents : html)
})
server.listen(3043, "127.0.0.1", () => console.log("Fixture: http://127.0.0.1:3043/ (Ctrl-C stops)"))
