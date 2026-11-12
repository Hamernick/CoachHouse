import { defineConfig } from "@playwright/test"
import base from "./playwright.config"

export default defineConfig({
  ...base,
  testIgnore: [],
  testMatch: "fullscreen-document.spec.ts",
  globalSetup: "./fullscreen-document-setup.ts",
})
