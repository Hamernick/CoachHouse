import { defineConfig } from "@playwright/test"
export default defineConfig({
  testDir: __dirname, testMatch: "prototype.spec.ts", workers: 1, timeout: 30000,
  outputDir: "./results", reporter: "list", use: { baseURL: "http://127.0.0.1:3191", viewport: { width: 1280, height: 900 }, trace: "retain-on-failure" },
})
