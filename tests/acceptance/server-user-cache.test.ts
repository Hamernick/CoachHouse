import { execFileSync } from "node:child_process"
import { describe, expect, it } from "vitest"

// Use Next's installed RSC renderer in a react-server process: ordinary Vitest
// React calls do not establish the request cache and cannot prove its isolation.
describe("server user request cache", () => {
  it("deduplicates a render, isolates concurrent clients and requests, and stays fresh outside RSC", () => {
    const output = execFileSync(process.execPath, ["--conditions=react-server", "-e", `
      const { readFileSync } = require("node:fs");
      const ts = require("typescript");
      const React = require("react");
      const { renderToReadableStream } = require("next/dist/compiled/react-server-dom-webpack/server.node");
      const source = ts.transpileModule(readFileSync("src/server/auth/server-user.ts", "utf8"), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
      }).outputText;
      const loaded = { exports: {} };
      new Function("require", "exports", "module", source)(require, loaded.exports, loaded);
      const { getServerUser } = loaded.exports;
      let calls = 0;
      let identity = "alice";
      const alice = { auth: { getUser: async () => {
        calls++;
        const id = identity;
        await new Promise(resolve => setImmediate(resolve));
        return { data: { user: id ? { id } : null }, error: null };
      } } };
      const bob = { auth: { getUser: async () => {
        calls++;
        return { data: { user: { id: "bob" } }, error: null };
      } } };
      async function Probe({ client }) {
        const [a, b] = await Promise.all([getServerUser(client), getServerUser(client)]);
        return [a.data.user?.id ?? "anonymous", b.data.user?.id ?? "anonymous"];
      }
      async function render(clients) {
        const stream = await renderToReadableStream(React.createElement(React.Fragment, null,
          ...clients.map((client, key) => React.createElement(Probe, { client, key }))), {});
        return new Response(stream).text();
      }
      (async () => {
        const first = await render([alice, alice, bob]);
        const afterFirst = calls;
        identity = "carol";
        const next = await render([alice, alice]);
        const afterNext = calls;
        identity = null;
        const loggedOut = await render([alice]);
        const afterLogout = calls;
        identity = "dana";
        const concurrent = await Promise.all([render([alice]), render([bob])]);
        const afterConcurrent = calls;
        await getServerUser(alice);
        identity = "erin";
        const outside = await getServerUser(alice);
        const error = { message: "Auth unavailable" };
        const failed = await getServerUser({ auth: { getUser: async () => ({ data: { user: null }, error }) } });
        console.log(JSON.stringify({ first, afterFirst, next, afterNext, loggedOut,
          afterLogout, concurrent, afterConcurrent, calls, outside: outside.data.user.id,
          errorPreserved: failed.error === error }));
      })().catch(error => { console.error(error); process.exitCode = 1; });
    `], {
      cwd: process.cwd(),
      env: { ...process.env, NODE_ENV: "production" },
      encoding: "utf8",
      timeout: 20_000,
    })
    const result = JSON.parse(output)
    expect(result.afterFirst).toBe(2) // Six calls, two distinct clients.
    expect(result.first).toContain("alice")
    expect(result.first).toContain("bob")
    expect(result.afterNext).toBe(3)
    expect(result.next).toContain("carol")
    expect(result.next).not.toContain("alice")
    expect(result.afterLogout).toBe(4)
    expect(result.loggedOut).toContain("anonymous")
    expect(result.afterConcurrent).toBe(6)
    expect(result.concurrent[0]).toContain("dana")
    expect(result.concurrent[0]).not.toContain("bob")
    expect(result.concurrent[1]).toContain("bob")
    expect(result.concurrent[1]).not.toContain("dana")
    expect(result.calls).toBe(8)
    expect(result.outside).toBe("erin")
    expect(result.errorPreserved).toBe(true)
  })
})
