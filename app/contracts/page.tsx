import { prisma } from "@/lib/prisma";
import { formatCurrencyFull, formatDate } from "@/lib/format";
import { LICENSE_CYCLE_LABELS } from "@/lib/types";

export default async function ContractsPage() {
  const projects = await prisma.project.findMany({
    where: { licenseFee: { not: null } },
    include: { client: true },
  });

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold mb-4">ライセンス契約一覧</h1>
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr className="text-left text-xs text-slate-500">
              <th className="px-3 py-2">取引先</th>
              <th className="px-3">案件名</th>
              <th className="px-3 text-right">月額</th>
              <th className="px-3">課金周期</th>
              <th className="px-3">開始日</th>
            </tr>
          </thead>
          <tbody>
            {projects.length === 0 && (
              <tr><td colSpan={5} className="px-3 py-6 text-center text-slate-400 text-xs">ライセンス契約はありません</td></tr>
            )}
            {projects.map((p) => (
              <tr key={p.id} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="px-3 py-2.5 font-medium">{p.client.name}</td>
                <td className="px-3 text-slate-600 text-xs">{p.title}</td>
                <td className="px-3 text-right">{formatCurrencyFull(p.licenseFee ?? 0)}</td>
                <td className="px-3 text-xs">{p.licenseCycle ? LICENSE_CYCLE_LABELS[p.licenseCycle] : "—"}</td>
                <td className="px-3 text-xs">{formatDate(p.licenseStartDate)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
