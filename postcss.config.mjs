import { resolve } from "node:path";

const config = {
  // Turbopack loads plugin names from its generated worker, not this directory.
  plugins: { [resolve(process.cwd(), "src/components/ui/particle-ui/postcss.cjs")]: {}, "@tailwindcss/postcss": {} },
};

export default config;
