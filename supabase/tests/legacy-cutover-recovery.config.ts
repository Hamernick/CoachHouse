import path from "node:path"
const config = {
  resolve: { alias: { "@": path.resolve(process.cwd(), "src") } },
  test: { environment: "node", include: ["supabase/tests/legacy-cutover-recovery.test.ts"], maxWorkers: 1 },
}

export default config
