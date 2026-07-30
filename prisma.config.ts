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
    // Migrate/introspection need a direct (non-pgbouncer) connection — the pooler's
    // transaction-pooling mode kills the session-level features (advisory locks) Migrate
    // needs, causing P1017 "Server has closed the connection". The pooled DATABASE_URL is
    // still what the running app uses at runtime, via the adapter built in lib/prisma.ts.
    url: env("DIRECT_URL"),
  },
});