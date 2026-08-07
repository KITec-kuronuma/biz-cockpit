import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

/**
 * DDL専用の Prisma クライアントを生成する。
 * Supabase の接続プーラー（pgbouncer / DATABASE_URL）は
 * トランザクションモードで ALTER TABLE などの DDL をサポートしないため、
 * DIRECT_URL（直接接続）を優先して使用する。
 */
function createMigrationPrisma(): PrismaClient {
  // DIRECT_URL があればそちらを優先、なければ DATABASE_URL にフォールバック
  const url =
    process.env.DIRECT_URL ??
    process.env.DATABASE_URL ??
    "";

  if (!url) throw new Error("DATABASE_URL / DIRECT_URL が設定されていません");

  if (url.startsWith("postgres://") || url.startsWith("postgresql://")) {
    const adapter = new PrismaPg({ connectionString: url });
    return new PrismaClient({ adapter, log: ["error"] });
  }

  // ローカル SQLite 環境（DDL 制限なし）
  const { PrismaBetterSqlite3 } = require("@prisma/adapter-better-sqlite3");
  const adapter = new PrismaBetterSqlite3({ url });
  return new PrismaClient({ adapter, log: ["error"] });
}

export async function ensureMigrations() {
  const migPrisma = createMigrationPrisma();

  const stmts = [
    `ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "projectNo" INTEGER;`,
    `ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "occurredAt" TIMESTAMP(3);`,
    `ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "quotedAt" TIMESTAMP(3);`,
    `ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "undatedForecast" INTEGER NOT NULL DEFAULT 0;`,
    `ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "forecastTiming" TEXT NOT NULL DEFAULT 'UNDECIDED';`,
    // TEXT型で追加された projectNo を INTEGER に変換（冪等）
    `ALTER TABLE "Project" ALTER COLUMN "projectNo" TYPE INTEGER USING "projectNo"::INTEGER;`,
  ];

  for (const sql of stmts) {
    await migPrisma.$executeRawUnsafe(sql).catch((e: unknown) => {
      // IF NOT EXISTS を使っているので通常は無害、エラーはログだけ残す
      console.warn("[migrations] skipped:", sql.split(" ").slice(0, 6).join(" "), String(e).slice(0, 80));
    });
  }

  await migPrisma.$disconnect().catch(() => {});
}
