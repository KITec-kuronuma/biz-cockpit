import { prisma } from "@/lib/prisma";
import Link from "next/link";

export default async function ClientsPage() {
  const clients = await prisma.client.findMany({
    include: { _count: { select: { projects: true, contacts: true } } },
    orderBy: { name: "asc" },
  });

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-xl font-bold">取引先</h1>
        <Link
          href="/clients/new"
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
        >
          ＋ 取引先追加
        </Link>
      </div>
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr className="text-left text-xs text-slate-500">
              <th className="px-3 py-2">会社名</th>
              <th className="px-3">業種</th>
              <th className="px-3">代表住所</th>
              <th className="px-3">代表電話</th>
              <th className="px-3 text-right">担当者</th>
              <th className="px-3 text-right">案件</th>
            </tr>
          </thead>
          <tbody>
            {clients.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-xs text-slate-400">
                  取引先はまだ登録されていません
                </td>
              </tr>
            )}
            {clients.map((c) => (
              <tr key={c.id} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="px-3 py-2.5 font-medium">
                  <Link href={`/clients/${c.id}`} className="text-blue-600 hover:underline">
                    {c.name}
                  </Link>
                </td>
                <td className="px-3 text-xs text-slate-600">{c.industry ?? "—"}</td>
                <td className="px-3 text-xs text-slate-600 truncate max-w-xs">
                  {c.address ?? "—"}
                </td>
                <td className="px-3 text-xs">{c.phone ?? "—"}</td>
                <td className="px-3 text-xs text-right">{c._count.contacts}名</td>
                <td className="px-3 text-xs text-right">{c._count.projects}件</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
