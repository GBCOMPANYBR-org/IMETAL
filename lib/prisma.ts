import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

const previewDatabaseUrl =
  process.env.VERCEL_ENV === "preview" ? process.env.DATABASE_URL_TEST : undefined;

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    ...(previewDatabaseUrl
      ? { datasources: { db: { url: previewDatabaseUrl } } }
      : {}),
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
