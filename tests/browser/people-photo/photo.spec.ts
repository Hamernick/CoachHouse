import { expect, test } from "@playwright/test"
import { build } from "vite"
import tailwindcss from "@tailwindcss/postcss"
import { resolve } from "node:path"
import { randomBytes } from "node:crypto"
import sharp from "sharp"
import particleUiFoundation from "../../../src/components/ui/particle-ui/postcss.cjs"

let script = "", css = "", photo: Buffer
test.beforeAll(async () => {
  photo = await sharp(randomBytes(1200 * 1200 * 3), { raw: { width: 1200, height: 1200, channels: 3 } }).png().toBuffer()
  expect(photo.byteLength).toBeGreaterThan(1024 * 1024)
  const result = await build({
    configFile: false, logLevel: "error", resolve: { alias: { "@": resolve("src") } },
    plugins: [{ name: "people-photo-actions", enforce: "pre", resolveId(source) {
      if (["@/actions/people", resolve("src/actions/people"), resolve("src/actions/people.ts")].includes(source)) return "\0people-action"
      if (["@/actions/people-roles", resolve("src/actions/people-roles"), resolve("src/actions/people-roles.ts")].includes(source)) return "\0roles-action"
      if (source === "next/navigation") return "\0navigation"
    }, load(id) {
      if (id === "\0roles-action") return 'export async function listPeopleRolesAction(){return {roles:[]}}'
      if (id === "\0navigation") return 'export function useRouter(){return {refresh(){}}}'
      if (id === "\0people-action") return `export async function upsertPersonAction(person){
        localStorage.setItem("submitted", JSON.stringify({bytes:new TextEncoder().encode(JSON.stringify(person)).length,imageLength:person.image?.length,imagePrefix:person.image?.slice(0,30)}));
        if(localStorage.getItem("fail-save")){localStorage.removeItem("fail-save");throw new Error("Body exceeded 1 MB limit.")}
        localStorage.setItem("saved-person",JSON.stringify({...person,id:"saved-person",image:"users/fixture/photo.webp"}));return {ok:true,id:"saved-person"}
      }`
    } }],
    esbuild: { jsx: "automatic" }, css: { postcss: { plugins: [particleUiFoundation(), tailwindcss()] } },
    define: { "process.env.NODE_ENV": JSON.stringify("development") },
    build: { write: false, minify: false, rollupOptions: { input: resolve(__dirname, "fixture.tsx"), output: { inlineDynamicImports: true } } },
  })
  if (Array.isArray(result) || !("output" in result)) throw new Error("Expected fixture bundle")
  for (const entry of result.output) {
    if (entry.type === "chunk") script += entry.code
    else if (entry.fileName.endsWith(".css")) css += entry.source
  }
})
test("large photo stays bounded; failed save preserves draft and successful save survives reload", async ({ page }) => {
  const errors: string[] = []; page.on("pageerror", error => errors.push(error.message))
  await page.route("https://people.test/", route => route.fulfill({ contentType: "text/html", body: '<div id="root"></div>' }))
  const mount = async () => { await page.goto("https://people.test/"); await page.addStyleTag({ content: css }); await page.addScriptTag({ content: script, type: "module" }) }
  await mount()
  await page.getByRole("button", { name: "Add", exact: true }).click()
  await page.getByLabel("Name", { exact: true }).fill("Morgan Photo")
  await page.locator('input[type="file"]').setInputFiles({ name: "large-photo.png", mimeType: "image/png", buffer: photo })
  const save = page.getByRole("button", { name: "Add person", exact: true })
  await expect(save).toBeEnabled()
  await page.evaluate(() => localStorage.setItem("fail-save", "1"))
  await save.click()
  await expect(page.getByRole("alert")).toContainText("Your changes are still here")
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue("Morgan Photo")
  const payload = await page.evaluate(() => JSON.parse(localStorage.getItem("submitted")!))
  expect(payload.bytes).toBeLessThan(768 * 1024)
  expect(payload.imageLength).toBeLessThanOrEqual(384 * 1024)
  expect(payload.imagePrefix).toMatch(/^data:image\/(webp|png);base64,/)
  await save.click()
  await expect(page.getByRole("dialog")).toHaveCount(0)
  await mount()
  await expect(page.getByLabel("Saved person")).toContainText("Morgan Photo")
  await expect(page.getByLabel("Saved person")).toContainText("users/fixture/photo.webp")
  expect(errors).toEqual([])
})
test("invalid photo keeps the editable draft and does not submit", async ({ page }) => {
  await page.route("https://people.test/", route => route.fulfill({ contentType: "text/html", body: '<div id="root"></div>' }))
  await page.goto("https://people.test/"); await page.addStyleTag({ content: css }); await page.addScriptTag({ content: script, type: "module" })
  await page.getByRole("button", { name: "Add", exact: true }).click()
  await page.getByLabel("Name", { exact: true }).fill("Keep me")
  await page.locator('input[type="file"]').setInputFiles({ name: "invalid.png", mimeType: "image/png", buffer: Buffer.from("not an image") })
  await expect(page.getByRole("alert")).toBeVisible()
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue("Keep me")
  expect(await page.evaluate(() => localStorage.getItem("submitted"))).toBeNull()
})
