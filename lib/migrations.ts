import { prisma } from "@/lib/prisma";

export async function ensureMigrations() {
  await Promise.all([
    prisma.$executeRawUnsafe(`ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "projectNo" INTEGER;`).catch(() => {}),
    prisma.$executeRawUnsafe(`ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "occurredAt" TIMESTAMP(3);`).catch(() => {}),
    prisma.$executeRawUnsafe(`ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "quotedAt" TIMESTAMP(3);`).catch(() => {}),
    prisma.$executeRawUnsafe(`ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "undatedForecast" INTEGER NOT NULL DEFAULT 0;`).catch(() => {}),
    prisma.$executeRawUnsafe(`ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "forecastTiming" TEXT NOT NULL DEFAULT 'UNDECIDED';`).catch(() => {}),
  ]);
  // TEXT型で作られたprojectNoをINTEGERに変換（冪等）
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "Project" ALTER COLUMN "projectNo" TYPE INTEGER USING "projectNo"::INTEGER;`
  ).catch(() => {});
}
