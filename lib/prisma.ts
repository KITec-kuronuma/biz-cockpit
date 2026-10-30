import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";

const globalForPrisma = globalThis as unknown as { _prismaClient?: PrismaClient };

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

function getClient(): PrismaClient {
  if (!globalForPrisma._prismaClient) {
    globalForPrisma._prismaClient = createPrisma();
  }
  return globalForPrisma._prismaClient;
}

// Proxy で遅延初期化：import 時ではなくクエリ実行時に初めて DB 接続を確立する
export const prisma = new Proxy({} as PrismaClient, {
  get(_, prop) {
    return Reflect.get(getClient(), prop);
  },
});
