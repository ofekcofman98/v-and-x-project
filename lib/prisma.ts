import { PrismaClient } from "./generated/prisma";

// Prevent multiple PrismaClient instances in Next.js hot-reload (dev mode).
// In production a single instance is always created.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
