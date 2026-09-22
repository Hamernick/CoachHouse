import { existsSync } from "node:fs"
import { createRequire } from "node:module"
import path from "node:path"
import { expect, test } from "@playwright/test"

const localRequire = createRequire(path.resolve("package.json"))
const viteRequire = createRequire(
  localRequire.resolve("vite", {
    paths: [localRequire.resolve("vitest/package.json")],
  })
)
const { build } = viteRequire("esbuild") as {
  build: (
    options: Record<string, unknown>
  ) => Promise<{ outputFiles: Array<{ text: string }> }>
}
let script = ""

const mocks: Record<string, string> = {
  "next/navigation": `const router={refresh(){},replace(){}}; export const useRouter=()=>router;`,
  "next/link": `import React from 'react'; export default function Link(props){return React.createElement('a',props)}`,
  "@/lib/toast": `export const toast={error:(message)=>window.fixture.messages.push(message),success(){},info(){}};`,
  "@/hooks/use-supabase-client": `const client={auth:{getUser:async()=>({data:{user:{id:'fixture-user'}},error:null}),updateUser:async(value)=>{window.fixture.metadata.push(value);return {error:null}}},from:(table)=>({upsert:async(value)=>{window.fixture.profiles.push(value);return {error:null}},select:()=>{const query={eq:()=>query,maybeSingle:async()=>({data:table==='public_handles'?{handle:'fixture-person'}:{bio:'',location_label:null,website_url:null,is_public:true},error:window.fixture.failLoad?{message:'unavailable'}:null})};return query}})};export const useSupabaseClient=()=>client;`,
  "@/actions/public-profile-settings": `export const refreshPublicProfileAction=async()=>{};export const setPublicProfileVisibilityAction=async(isPublic)=>{window.fixture.visibility.push(isPublic);return {ok:true}};export const savePublicProfileDetailsAction=async(value)=>{window.fixture.details.push(value);return {ok:true}};`,
  "@/actions/account-email-preferences": `export const saveAccountEmailPreferencesAction=async(value)=>{if(window.fixture.failEmailSave)return {ok:false,error:'Try again'};window.fixture.preferences.push(value);return {ok:true}};`,
  "account-settings-dialog-profile-loader": `import {useEffect} from 'react';export function useAccountSettingsProfileLoader(p){useEffect(()=>{if(!p.open)return;p.setFirstName('Person');p.setLastName('Example');p.initialFirstRef.current='Person';p.initialLastRef.current='Example';p.setPreferencesLoading(false)},[p.open])}`,
}

test.beforeAll(async () => {
  const result = await build({
    stdin: {
      contents: `import React from 'react';import{createRoot}from'react-dom/client';
import{AccountSettingsDraftsProvider}from'@/components/account-settings/account-settings-drafts';
import{useAccountSettingsDialogState}from'@/components/account-settings/account-settings-dialog-state';
import{PublicProfileIdentitySettings}from'@/features/public-profiles/components/public-profile-identity-settings';
import{PublicProfileDetailsFields}from'@/features/public-profiles/components/public-profile-details-fields';
window.fixture={profiles:[],metadata:[],preferences:[],details:[],messages:[],visibility:[],failEmailSave:false,failLoad:false};
function Form(){const [mobile,setMobile]=React.useState(false);const s=useAccountSettingsDialogState({open:true,initialTab:'profile',defaultName:'Person Example',defaultEmail:'person@example.test',defaultMarketingOptIn:true,defaultNewsletterOptIn:true,onOpenChange(){}});return <main>
<button onClick={()=>setMobile(true)}>Mount mobile fields</button>{mobile?<div hidden><PublicProfileDetailsFields profile={null} disabled={false} idPrefix="mobile-fixture"/></div>:null}
<button onClick={()=>s.setTab('profile')}>Profile tab</button><button onClick={()=>s.setTab('communications')}>Communications tab</button>
<label>Name<input aria-label='Name' value={s.firstName} onChange={e=>s.handleFirstNameChange(e.target.value)}/></label>
<label>Product email<input type='checkbox' checked={s.marketingOptIn} onChange={e=>s.handleMarketingOptInChange(e.target.checked)}/></label>
<output>{s.isDirty?'Unsaved':'Clean'}</output><button onClick={s.handleSave} disabled={s.isSaving}>Save everything</button>
<div hidden={s.tab!=='profile'}><PublicProfileIdentitySettings avatarUrl={null} displayName={s.firstName+' '+s.lastName} headline='' idPrefix='fixture' isUploadingAvatar={false} onAvatarFileSelected={()=>{}} profileDetails={null}/></div>
</main>};createRoot(document.getElementById('root')).render(<AccountSettingsDraftsProvider><Form/></AccountSettingsDraftsProvider>);`,
      loader: "tsx",
      resolveDir: process.cwd(),
    },
    bundle: true,
    write: false,
    platform: "browser",
    format: "iife",
    jsx: "automatic",
    define: { "process.env.NODE_ENV": '"development"' },
    plugins: [
      {
        name: "offline-settings-fixture",
        setup(builder: {
          onResolve: (
            options: { filter: RegExp },
            callback: (args: { path: string; kind: string }) => unknown
          ) => void
          onLoad: (
            options: { filter: RegExp; namespace: string },
            callback: (args: { path: string }) => unknown
          ) => void
          resolve: (
            input: string,
            options: { kind: string }
          ) => Promise<unknown>
        }) {
          builder.onResolve({ filter: /.*/ }, (args) => {
            const key = args.path.endsWith(
              "account-settings-dialog-profile-loader"
            )
              ? "account-settings-dialog-profile-loader"
              : args.path
            if (key in mocks) return { path: key, namespace: "fixture" }
            if (args.path.startsWith("@/")) {
              const base = path.resolve("src", args.path.slice(2))
              const file = [".ts", ".tsx", ".js", "/index.ts", "/index.tsx"]
                .map((extension) => base + extension)
                .find(existsSync)
              if (file) return { path: file }
            }
          })
          builder.onLoad({ filter: /.*/, namespace: "fixture" }, (args) => ({
            contents: mocks[args.path],
            loader: "tsx",
            resolveDir: process.cwd(),
          }))
        },
      },
    ],
  })
  script = result.outputFiles[0].text
})

test.beforeEach(async ({ page }) => {
  await page.setContent('<div id="root"></div>')
  await page.addScriptTag({ content: script })
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue("Person")
})

test("saving another tab preserves and persists both drafts", async ({
  page,
}) => {
  await page.getByLabel("Name", { exact: true }).fill("Updated")
  await page.getByRole("button", { name: "Communications tab" }).click()
  await page.getByLabel("Product email").uncheck()
  await page.getByRole("button", { name: "Save everything" }).click()
  await expect(page.locator("output")).toHaveText("Clean")
  const state = await page.evaluate(() => window.fixture)
  expect(state.profiles[0].full_name).toBe("Updated Example")
  expect(state.preferences[0]).toEqual({
    marketingOptIn: false,
    newsletterOptIn: null,
  })
})

test("failed save retains dirty status and permits retry", async ({ page }) => {
  await page.getByLabel("Product email").uncheck()
  await page.evaluate(() => {
    window.fixture.failEmailSave = true
  })
  await page.getByRole("button", { name: "Save everything" }).click()
  await expect(page.locator("output")).toHaveText("Unsaved")
  await page.evaluate(() => {
    window.fixture.failEmailSave = false
  })
  await page.getByRole("button", { name: "Save everything" }).click()
  await expect(page.locator("output")).toHaveText("Clean")
})

test("public draft survives tab changes and joins the same save", async ({
  page,
}) => {
  await page
    .getByLabel("Public bio", { exact: true })
    .fill("An explicitly public biography")
  await page.getByRole("button", { name: "Communications tab" }).click()
  await page.getByRole("button", { name: "Profile tab" }).click()
  await expect(page.getByLabel("Public bio", { exact: true })).toHaveValue(
    "An explicitly public biography"
  )
  await page.getByRole("link", { name: "View profile" }).click()
  expect(await page.evaluate(() => window.fixture.messages)).toContain(
    "Save your changes before viewing your profile."
  )
  await page.getByRole("button", { name: "Mount mobile fields" }).click()
  await page.getByRole("button", { name: "Save everything" }).click()
  await expect(page.locator("output")).toHaveText("Clean")
  expect(await page.evaluate(() => window.fixture.details)).toHaveLength(1)
  expect(await page.evaluate(() => window.fixture.details[0].bio)).toBe(
    "An explicitly public biography"
  )
})

test("failed identity loading shows retry instead of a private empty account", async ({
  page,
}) => {
  await page.evaluate(() => {
    window.fixture.failLoad = true
  })
  // Remount with failure configured before asynchronous identity loading.
  await page.setContent('<div id="root"></div>')
  await page.addScriptTag({
    content: script.replace(/failLoad:\s*false/, "failLoad: true"),
  })
  await expect(page.getByRole("alert")).toContainText(
    "Unable to load your public profile"
  )
  await expect(page.getByLabel("Username", { exact: true })).toHaveCount(0)
  await page.evaluate(() => {
    window.fixture.failLoad = false
  })
  await page.getByRole("button", { name: "Try again" }).click()
  await expect(page.getByLabel("Username", { exact: true })).toHaveValue(
    "fixture-person"
  )
})

declare global {
  interface Window {
    fixture: {
      profiles: Array<{ full_name: string }>
      metadata: unknown[]
      preferences: unknown[]
      details: Array<{ bio: string }>
      messages: string[]
      visibility: boolean[]
      failEmailSave: boolean
      failLoad: boolean
    }
  }
}
