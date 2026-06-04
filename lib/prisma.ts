import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createPrisma(): PrismaClient {
  const url = process.env.DATABASE_URL ?? "";

  if (!url) {
    throw new Error("DATABASE_URL environment variable is not set");
  }

  // PostgreSQL（本番・Supabase）
  if (url.startsWith("postgres://") || url.startsWith("postgresql://")) {
    const adapter = new PrismaPg({ connectionString: url });
    return new PrismaClient({ adapter, log: ["error", "warn"] });
  }

  // SQLite（ローカル開発のみ）
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { PrismaBetterSqlite3 } = require("@prisma/adapter-better-sqlite3");
  const adapter = new PrismaBetterSqlite3({ url });
  return new PrismaClient({ adapter, log: ["error", "warn"] });
}

export const prisma = globalForPrisma.prisma ?? createPrisma();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
