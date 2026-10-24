#!/usr/bin/env node

import { readFile, readdir } from "node:fs/promises"
import path from "node:path"

// Keep the existing CI entry point, guarding the stock integration instead of
// requiring the custom ownership layer removed at the user's request.
const root = process.cwd()
const layout = await readFile(path.join(root, "src/app/layout.tsx"), "utf8")
const errors = []
for (const fragment of [
  'process.env.NODE_ENV === "development"',
  'strategy="beforeInteractive"',
  'crossOrigin="anonymous"',
  'https://unpkg.com/react-grab@${reactGrabPackage.version}/dist/index.global.js',
]) {
  if (!layout.includes(fragment)) errors.push(`Missing stock development setup: ${fragment}`)
}
async function check(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name)
    if (entry.isDirectory()) await check(file)
    else if (/\.(tsx?|jsx?)$/.test(file)) {
      const source = await readFile(file, "utf8")
      if (/data-react-grab-|__REACT_GRAB_SURFACES__|coachhouse-semantic-targeting|react-grab-loader|react-grab-surface/.test(source)) {
        errors.push(`${path.relative(root, file)}: custom React Grab integration must stay removed`)
      }
    }
  }
}
await check(path.join(root, "src"))
if (errors.length) {
  console.error(errors.join("\n"))
  process.exitCode = 1
} else console.log("React Grab stock development integration check passed")
