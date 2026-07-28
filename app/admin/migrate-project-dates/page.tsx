import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

async function runMigration() {
  "use server";
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  // occurredAt / quotedAt カラムを追加（既に存在する場合はエラーを無視）
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "occurredAt" TIMESTAMP(3);`
  );
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "quotedAt" TIMESTAMP(3);`
  );

  redirect("/projects?migrated=1");
}

export default async function MigrateProjectDatesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <div className="max-w-lg mx-auto p-8">
      <h1 className="text-2xl font-bold mb-4">DBマイグレーション</h1>
      <p className="text-slate-600 mb-6">
        案件テーブルに「案件発生日（occurredAt）」と「見積提出日（quotedAt）」の
        カラムを追加します。1回だけ実行してください。
      </p>
      <form action={runMigration}>
        <button
          type="submit"
          className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700"
        >
          マイグレーション実行
        </button>
      </form>
    </div>
  );
}
