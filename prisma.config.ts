// Load .env.local first (Next.js convention), then fall back to .env
import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: env("DATABASE_URL"),
    // @ts-expect-error directUrl is a valid datasource option but is missing from Prisma's type definitions
    directUrl: env("DIRECT_URL"),
  },
});