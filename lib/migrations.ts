import { prisma } from "@/lib/prisma";

export async function ensureMigrations() {
  const stmts = [
    `ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "projectNo" INTEGER;`,
    `ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "occurredAt" TIMESTAMP(3);`,
    `ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "quotedAt" TIMESTAMP(3);`,
    `ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "undatedForecast" INTEGER NOT NULL DEFAULT 0;`,
    `ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "forecastTiming" TEXT NOT NULL DEFAULT 'UNDECIDED';`,
    // TEXT型で追加されたprojectNoをINTEGERに変換（冪等）
    `ALTER TABLE "Project" ALTER COLUMN "projectNo" TYPE INTEGER USING "projectNo"::INTEGER;`,
  ];
  for (const sql of stmts) {
    await prisma.$executeRawUnsafe(sql).catch(() => {});
  }
}
