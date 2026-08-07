import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function DiagPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const results: { step: string; ok: boolean; msg: string }[] = [];

  // 1. DB接続確認
  try {
    await prisma.$queryRaw`SELECT 1`;
    results.push({ step: "DB接続", ok: true, msg: "OK" });
  } catch (e) {
    results.push({ step: "DB接続", ok: false, msg: String(e) });
  }

  // 2. Projectテーブルのカラム確認
  try {
    const cols = await prisma.$queryRaw<{ column_name: string; data_type: string }[]>`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'Project'
      ORDER BY ordinal_position
    `;
    results.push({ step: "Projectカラム一覧", ok: true, msg: JSON.stringify(cols.map(c => `${c.column_name}(${c.data_type})`)) });
  } catch (e) {
    results.push({ step: "Projectカラム一覧", ok: false, msg: String(e) });
  }

  // 3. project.findMany テスト
  try {
    const ps = await prisma.project.findMany({ take: 1, include: { client: true, forecasts: true, invoices: true } });
    results.push({ step: "project.findMany", ok: true, msg: `${ps.length}件取得` });
  } catch (e) {
    results.push({ step: "project.findMany", ok: false, msg: String(e) });
  }

  // 4. orderBy projectNo テスト
  try {
    await prisma.project.findMany({
      take: 1,
      orderBy: [{ projectNo: { sort: "desc", nulls: "last" } }],
    });
    results.push({ step: "orderBy projectNo", ok: true, msg: "OK" });
  } catch (e) {
    results.push({ step: "orderBy projectNo", ok: false, msg: String(e) });
  }

  return (
    <div className="p-6 max-w-3xl font-mono text-sm">
      <h1 className="text-lg font-bold mb-4">診断結果</h1>
      {results.map((r, i) => (
        <div key={i} className={`mb-3 p-3 rounded border ${r.ok ? "border-green-300 bg-green-50" : "border-red-300 bg-red-50"}`}>
          <div className="font-bold">{r.ok ? "✅" : "❌"} {r.step}</div>
          <div className="text-xs mt-1 break-all">{r.msg}</div>
        </div>
      ))}
    </div>
  );
}
