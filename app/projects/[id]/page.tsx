import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { formatCurrencyFull, formatDate, formatPercent } from "@/lib/format";
import {
  STATUS_LABELS,
  PROGRESS_LABELS,
  INVOICE_STATUS_LABELS,
  DETAIL_PHASE_LABELS,
} from "@/lib/types";
import Link from "next/link";
import { addInvoice, deleteInvoice, addPayment, addCost, deleteCost } from "./actions";

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      client: true,
      invoices: { include: { payments: true }, orderBy: { invoiceDate: "asc" } },
      costs: { orderBy: { yearMonth: "asc" } },
    },
  });
  if (!project) return notFound();

  const totalInvoiced = project.invoices.reduce((s, i) => s + i.amount, 0);
  const totalPaid = project.invoices.reduce(
    (s, i) => s + i.payments.reduce((ss, p) => ss + p.amount, 0),
    0
  );
  const totalCost = project.costs.reduce((s, c) => s + c.amount, 0);
  const paymentRate = totalInvoiced > 0 ? totalPaid / totalInvoiced : null;

  return (
    <div className="p-6 max-w-[1400px]">
      <div className="flex justify-between items-center mb-3">
        <Link href="/projects" className="text-xs text-blue-600 hover:underline">
          ← 案件一覧に戻る
        </Link>
        <Link
          href={`/projects/${project.id}/edit`}
          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium"
        >
          ✏️ 案件を編集
        </Link>
      </div>

      {/* ヘッダー */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 mb-4">
        <div className="flex justify-between items-start mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-2xl font-bold">{project.title}</h1>
              <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-xs">
                {STATUS_LABELS[project.status]}
              </span>
              <span className="px-2 py-0.5 rounded bg-slate-100 text-xs">
                {PROGRESS_LABELS[project.progress]}
              </span>
            </div>
            <div className="text-sm text-slate-500">
              {project.client.name}
              {project.detailPhase && ` ・ 詳細: ${DETAIL_PHASE_LABELS[project.detailPhase] ?? ""}`}
            </div>
          </div>
        </div>
        <div className="grid grid-cols-4 gap-3">
          <Info label="契約金額" value={formatCurrencyFull(project.contractAmount)} highlight />
          <Info label="契約日" value={formatDate(project.contractDate)} />
          <Info label="納品日" value={formatDate(project.deliveryDate)} />
          <Info
            label="入金率"
            value={paymentRate === null ? "—" : formatPercent(paymentRate)}
            highlight
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-4">
        <Stat label="請求合計" value={formatCurrencyFull(totalInvoiced)} color="blue" />
        <Stat label="入金合計" value={formatCurrencyFull(totalPaid)} color="emerald" />
        <Stat label="月次原価合計" value={formatCurrencyFull(totalCost)} color="slate" />
      </div>

      {/* 請求 */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 mb-4">
        <h2 className="text-sm font-semibold mb-3">💰 請求 ({project.invoices.length}件)</h2>
        <table className="w-full text-sm mb-4">
          <thead>
            <tr className="text-left text-xs text-slate-500 border-b border-slate-200">
              <th className="py-2">請求日</th>
              <th>請求額</th>
              <th>入金予定</th>
              <th>状況</th>
              <th>入金額</th>
              <th>残額</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {project.invoices.length === 0 && (
              <tr>
                <td colSpan={7} className="py-4 text-center text-xs text-slate-400">
                  請求はまだ登録されていません
                </td>
              </tr>
            )}
            {project.invoices.map((inv) => {
              const paid = inv.payments.reduce((s, p) => s + p.amount, 0);
              const remaining = inv.amount - paid;
              return (
                <tr key={inv.id} className="border-b border-slate-100">
                  <td className="py-2 text-xs">{formatDate(inv.invoiceDate)}</td>
                  <td>{formatCurrencyFull(inv.amount)}</td>
                  <td className="text-xs">{formatDate(inv.dueDate)}</td>
                  <td>
                    <span
                      className={`px-2 py-0.5 rounded text-[11px] ${
                        inv.status === "PAID"
                          ? "bg-emerald-100 text-emerald-800"
                          : inv.status === "ISSUED"
                          ? "bg-amber-100 text-amber-800"
                          : "bg-slate-100"
                      }`}
                    >
                      {INVOICE_STATUS_LABELS[inv.status]}
                    </span>
                  </td>
                  <td className="text-xs">{formatCurrencyFull(paid)}</td>
                  <td
                    className={`text-xs ${remaining > 0 ? "text-red-600 font-semibold" : "text-slate-400"}`}
                  >
                    {formatCurrencyFull(remaining)}
                  </td>
                  <td>
                    <details className="inline-block">
                      <summary className="text-xs text-blue-600 cursor-pointer">入金追加</summary>
                      <form action={addPayment} className="absolute mt-2 z-10 bg-white border border-slate-200 rounded-lg p-3 shadow-lg flex gap-2 items-end">
                        <input type="hidden" name="invoiceId" value={inv.id} />
                        <input type="hidden" name="projectId" value={project.id} />
                        <div>
                          <label className="text-[10px] text-slate-500 block">入金日</label>
                          <input
                            type="date"
                            name="paymentDate"
                            required
                            className="border border-slate-200 rounded px-2 py-1 text-xs"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-500 block">金額</label>
                          <input
                            type="number"
                            name="amount"
                            defaultValue={remaining}
                            required
                            className="border border-slate-200 rounded px-2 py-1 text-xs w-28"
                          />
                        </div>
                        <button className="px-3 py-1 bg-blue-600 text-white rounded text-xs">
                          登録
                        </button>
                      </form>
                    </details>
                    <DeleteInvoiceButton invoiceId={inv.id} projectId={project.id} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <form action={addInvoice} className="flex gap-2 items-end border-t pt-3">
          <input type="hidden" name="projectId" value={project.id} />
          <div>
            <label className="text-[10px] text-slate-500 block">請求日</label>
            <input
              type="date"
              name="invoiceDate"
              required
              className="border border-slate-200 rounded px-2 py-1 text-xs"
            />
          </div>
          <div>
            <label className="text-[10px] text-slate-500 block">請求額</label>
            <input
              type="number"
              name="amount"
              required
              className="border border-slate-200 rounded px-2 py-1 text-xs w-32"
            />
          </div>
          <div>
            <label className="text-[10px] text-slate-500 block">入金予定日</label>
            <input
              type="date"
              name="dueDate"
              className="border border-slate-200 rounded px-2 py-1 text-xs"
            />
          </div>
          <button className="px-3 py-1 bg-blue-600 text-white rounded text-xs">＋ 請求追加</button>
        </form>
      </div>

      {/* 月次原価 */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h2 className="text-sm font-semibold mb-3">📉 月次原価 ({project.costs.length}件)</h2>
        <table className="w-full text-sm mb-4">
          <thead>
            <tr className="text-left text-xs text-slate-500 border-b border-slate-200">
              <th className="py-2">年月</th>
              <th>金額</th>
              <th>カテゴリ</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {project.costs.length === 0 && (
              <tr>
                <td colSpan={4} className="py-4 text-center text-xs text-slate-400">
                  原価はまだ登録されていません
                </td>
              </tr>
            )}
            {project.costs.map((c) => (
              <tr key={c.id} className="border-b border-slate-100">
                <td className="py-2 text-xs">{c.yearMonth}</td>
                <td>{formatCurrencyFull(c.amount)}</td>
                <td className="text-xs text-slate-600">{c.category ?? "—"}</td>
                <td>
                  <DeleteCostButton costId={c.id} projectId={project.id} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <form action={addCost} className="flex gap-2 items-end border-t pt-3">
          <input type="hidden" name="projectId" value={project.id} />
          <div>
            <label className="text-[10px] text-slate-500 block">年月（YYYY-MM）</label>
            <input
              type="text"
              name="yearMonth"
              placeholder="2026-05"
              pattern="\d{4}-\d{2}"
              required
              className="border border-slate-200 rounded px-2 py-1 text-xs w-24"
            />
          </div>
          <div>
            <label className="text-[10px] text-slate-500 block">金額</label>
            <input
              type="number"
              name="amount"
              required
              className="border border-slate-200 rounded px-2 py-1 text-xs w-28"
            />
          </div>
          <div>
            <label className="text-[10px] text-slate-500 block">カテゴリ</label>
            <input
              type="text"
              name="category"
              placeholder="人件費"
              className="border border-slate-200 rounded px-2 py-1 text-xs w-24"
            />
          </div>
          <button className="px-3 py-1 bg-blue-600 text-white rounded text-xs">＋ 原価追加</button>
        </form>
      </div>
    </div>
  );
}

function Info({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="bg-slate-50 rounded-lg p-3">
      <div className="text-[10px] text-slate-500">{label}</div>
      <div className={`text-sm font-semibold mt-1 ${highlight ? "text-blue-600" : ""}`}>
        {value}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: "blue" | "emerald" | "slate";
}) {
  const m: Record<string, string> = {
    blue: "text-blue-600",
    emerald: "text-emerald-600",
    slate: "text-slate-700",
  };
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <div className="text-xs text-slate-500">{label}</div>
      <div className={`text-xl font-bold mt-1 ${m[color]}`}>{value}</div>
    </div>
  );
}

function DeleteInvoiceButton({ invoiceId, projectId }: { invoiceId: string; projectId: string }) {
  return (
    <form action={deleteInvoice.bind(null, invoiceId, projectId)} className="inline ml-2">
      <button className="text-xs text-red-600 hover:underline">削除</button>
    </form>
  );
}

function DeleteCostButton({ costId, projectId }: { costId: string; projectId: string }) {
  return (
    <form action={deleteCost.bind(null, costId, projectId)} className="inline">
      <button className="text-xs text-red-600 hover:underline">削除</button>
    </form>
  );
}
