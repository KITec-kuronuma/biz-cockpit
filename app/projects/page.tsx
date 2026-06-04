import { prisma } from "@/lib/prisma";
import { formatCurrencyFull, formatDate, formatPercent } from "@/lib/format";
import { STATUS_LABELS, PROGRESS_LABELS } from "@/lib/types";
import Link from "next/link";

export default async function ProjectsPage() {
  const projects = await prisma.project.findMany({
    include: { client: true, invoices: { include: { payments: true } } },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-xl font-bold">案件一覧</h1>
        <Link href="/projects/new" className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">＋ 案件追加</Link>
      </div>
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-slate-500 border-b border-slate-200 bg-slate-50">
              <th className="px-3 py-2">案件名</th>
              <th className="px-3">取引先</th>
              <th className="px-3 text-right">契約金額</th>
              <th className="px-3">契約状況</th>
              <th className="px-3">進捗</th>
              <th className="px-3">契約日</th>
              <th className="px-3">納品日</th>
              <th className="px-3 text-right">入金率</th>
            </tr>
          </thead>
          <tbody>
            {projects.map((p) => {
              const inv = p.invoices.reduce((s, i) => s + i.amount, 0);
              const paid = p.invoices.reduce(
                (s, i) => s + i.payments.reduce((ss, x) => ss + x.amount, 0),
                0
              );
              const rate = inv > 0 ? paid / inv : null;
              return (
                <tr key={p.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-3 py-2.5 font-medium">
                    <Link href={`/projects/${p.id}`} className="text-blue-600 hover:underline">
                      {p.title}
                    </Link>
                  </td>
                  <td className="px-3 text-slate-600">{p.client.name}</td>
                  <td className="px-3 text-right">{formatCurrencyFull(p.contractAmount)}</td>
                  <td className="px-3">
                    <span className="inline-block px-2 py-0.5 rounded bg-slate-100 text-[11px]">
                      {STATUS_LABELS[p.status]}
                    </span>
                  </td>
                  <td className="px-3 text-xs">{PROGRESS_LABELS[p.progress]}</td>
                  <td className="px-3 text-xs">{formatDate(p.contractDate)}</td>
                  <td className="px-3 text-xs">{formatDate(p.deliveryDate)}</td>
                  <td className="px-3 text-right text-xs">
                    {rate === null ? "—" : formatPercent(rate)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
