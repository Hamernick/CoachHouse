import assert from "node:assert/strict"
import { readFile, writeFile } from "node:fs/promises"
import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js"

const url = new URL("http://127.0.0.1:3150/api/companion/mcp")
const token = (await readFile(".tmp/companion/operator-token", "utf8")).trim()
const clients = []
async function connect() {
  const client = new Client({ name: "companion-private-smoke", version: "0.1.0" })
  clients.push(client)
  await client.connect(new StreamableHTTPClientTransport(url, { requestInit: { headers: { authorization: `Bearer ${token}` } } }))
  return client
}
try {
  const challenge = await fetch(url)
  assert.equal(challenge.status, 401)
  const client = await connect()
  const tools = await client.listTools()
  assert.equal(tools.tools.length, 6)
  const read = await client.callTool({ name: "companion_get_session", arguments: {} })
  assert.notEqual(read.isError, true)
  const snapshot = read.structuredContent.snapshot
  assert.equal(snapshot.mode, "sandbox")
  assert.equal(snapshot.lesson.fields.length, 11)
  const resources = await client.listResources()
  const uri = resources.resources.find(resource => resource.uri.includes("review-cards-v1"))?.uri
  assert.ok(uri)
  const resource = await client.readResource({ uri })
  assert.equal(resource.contents[0].mimeType, "text/html;profile=mcp-app")
  assert.ok(resource.contents[0].text.includes("companion-root"))
  const freshClient = await connect()
  const freshRead = await freshClient.callTool({ name: "companion_get_session", arguments: {} })
  assert.equal(freshRead.structuredContent.snapshot.organization.id, snapshot.organization.id)
  const proof = { at: new Date().toISOString(), endpoint: url.href, unauthenticatedStatus: challenge.status,
    tools: tools.tools.map(tool => tool.name), lessonTitle: snapshot.lesson.title, source: snapshot.source.kind,
    answerFields: snapshot.lesson.fields.length, resourceUri: uri, resourceMimeType: resource.contents[0].mimeType,
    resourceBytes: Buffer.byteLength(resource.contents[0].text), freshConnectionResumesSameSandbox: true,
    host: "Local MCP SDK client; not ChatGPT", productionWrites: false }
  await writeFile(".tmp/companion/mcp-network-proof.json", JSON.stringify(proof, null, 2))
  console.log(JSON.stringify(proof, null, 2))
} finally { await Promise.all(clients.map(client => client.close())) }
