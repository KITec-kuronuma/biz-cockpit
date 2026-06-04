import { prisma } from "@/lib/prisma";
import { calcMonthlyPL } from "@/lib/domain/pl";
import { calcCashflow } from "@/lib/domain/cf";
import { getFiscalMonths } from "@/lib/domain/fiscal";
import { formatCurrencyFull, formatPercent } from "@/lib/format";
import { REVENUE_BASIS_LABELS } from "@/lib/types";
import Link from "next/link";

type SearchParams = Promise<{ basis?: string; year?: string; tab?: string }>;

export default async function FinancePage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const setting = await prisma.setting.findFirst();
  const fiscalStartMonth = setting?.fiscalStartMonth ?? 4;
  const year = params.year ? parseInt(params.year) : 2026;
  const basis = (params.basis ?? setting?.defaultRevenueBasis ?? "DELIVERY") as
    | "DELIVERY"
    | "INVOICE"
    | "CONTRACT";
  const tab = (params.tab ?? "pl") as "pl" | "cf";

  const months = getFiscalMonths({ startMonth: fiscalStartMonth, year });
  const projects = await prisma.project.findMany({
    include: {
      invoices: { include: { payments: true } },
      costs: true,
    },
  });

  const plRows = calcMonthlyPL({
    projects: projects.map((p) => ({
      id: p.id,
      status: p.status,
      contractDate: p.contractDate,
      deliveryDate: p.deliveryDate,
      contractAmount: p.contractAmount,
      invoices: p.invoices.map((i) => ({ invoiceDate: i.invoiceDate, amount: i.amount })),
      costs: p.costs.map((c) => ({ yearMonth: c.yearMonth, amount: c.amount })),
    })),
    months,
    basis,
  });

  const cfRows = calcCashflow({
    projects: projects.map((p) => ({
      invoices: p.invoices.map((i) => ({
        amount: i.amount,
        dueDate: i.dueDate,
        payments: i.payments.map((x) => ({ paymentDate: x.paymentDate, amount: x.amount })),
      })),
      costs: p.costs.map((c) => ({ yearMonth: c.yearMonth, amount: c.amount })),
    })),
    months,
  });

  const plTotal = plRows.reduce(
    (acc, r) => ({
      revenue: acc.revenue + r.revenue,
      cost: acc.cost + r.cost,
      grossProfit: acc.grossProfit + r.grossProfit,
    }),
    { revenue: 0, cost: 0, grossProfit: 0 }
  );

  const cfTotal = cfRows.reduce(
    (acc, r) => ({
      inflow: acc.inflow + r.inflow,
      outflow: acc.outflow + r.outflow,
      balance: acc.balance + r.balance,
    }),
    { inflow: 0, outflow: 0, balance: 0 }
  );

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h1 className="text-xl font-bold">財務（PL / CF）</h1>
          <p className="text-xs text-slate-500 mt-1">
            {year}年度（{fiscalStartMonth}月開始）
          </p>
        </div>
        <div className="flex gap-2">
          {(["DELIVERY", "INVOICE", "CONTRACT"] as const).map((b) => (
            <Link
              key={b}
              href={`/finance?basis=${b}&year=${year}&tab=${tab}`}
              className={`px-3 py-1.5 rounded-lg text-xs ${
                basis === b
                  ? "bg-blue-600 text-white"
                  : "bg-white border border-slate-200 text-slate-600"
              }`}
            >
              {REVENUE_BASIS_LABELS[b]}
            </Link>
          ))}
        </div>
      </div>

      {/* タブ */}
      <div className="flex gap-0 border-b-2 border-slate-200 mb-4">
        <Link
          href={`/finance?basis=${basis}&year=${year}&tab=pl`}
          className={`px-4 py-2 text-sm ${
            tab === "pl"
              ? "text-blue-600 border-b-2 border-blue-600 -mb-0.5 font-semibold"
              : "text-slate-500"
          }`}
        >
          📊 月次PL（損益）
        </Link>
        <Link
          href={`/finance?basis=${basis}&year=${year}&tab=cf`}
          className={`px-4 py-2 text-sm ${
            tab === "cf"
              ? "text-blue-600 border-b-2 border-blue-600 -mb-0.5 font-semibold"
              : "text-slate-500"
          }`}
        >
          💵 月次キャッシュフロー
        </Link>
      </div>

      {tab === "pl" ? (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr className="text-left text-xs text-slate-500">
                <th className="px-3 py-2">月</th>
                <th className="px-3 text-right">売上</th>
                <th className="px-3 text-right">原価</th>
                <th className="px-3 text-right">粗利</th>
                <th className="px-3 text-right">粗利率</th>
              </tr>
            </thead>
            <tbody>
              {plRows.map((r) => (
                <tr key={r.yearMonth} className="border-b border-slate-100">
                  <td className="px-3 py-2 text-xs">{r.yearMonth}</td>
                  <td className="px-3 text-right">{formatCurrencyFull(r.revenue)}</td>
                  <td className="px-3 text-right">{formatCurrencyFull(r.cost)}</td>
                  <td
                    className={`px-3 text-right font-medium ${
                      r.grossProfit < 0 ? "text-red-600" : ""
                    }`}
                  >
                    {formatCurrencyFull(r.grossProfit)}
                  </td>
                  <td className="px-3 text-right text-xs">{formatPercent(r.grossMargin)}</td>
                </tr>
              ))}
              <tr className="bg-slate-50 font-bold">
                <td className="px-3 py-2.5">合計</td>
                <td className="px-3 text-right">{formatCurrencyFull(plTotal.revenue)}</td>
                <td className="px-3 text-right">{formatCurrencyFull(plTotal.cost)}</td>
                <td className="px-3 text-right">{formatCurrencyFull(plTotal.grossProfit)}</td>
                <td className="px-3 text-right">
                  {formatPercent(plTotal.revenue > 0 ? plTotal.grossProfit / plTotal.revenue : 0)}
                </td>
              </tr>
            </tbody>
          </table>
          <div className="px-4 py-2 bg-blue-50 text-xs text-slate-600">
            💡 「{REVENUE_BASIS_LABELS[basis]}」で計上。失注案件は売上に計上しませんが原価は計上されます。
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr className="text-left text-xs text-slate-500">
                <th className="px-3 py-2">月</th>
                <th className="px-3 text-right">入金予定</th>
                <th className="px-3 text-right">出金予定</th>
                <th className="px-3 text-right">月次収支</th>
                <th className="px-3 text-right">累計残高見込み</th>
              </tr>
            </thead>
            <tbody>
              {cfRows.map((r) => (
                <tr key={r.yearMonth} className="border-b border-slate-100">
                  <td className="px-3 py-2 text-xs">{r.yearMonth}</td>
                  <td className="px-3 text-right text-emerald-600">
                    {formatCurrencyFull(r.inflow)}
                  </td>
                  <td className="px-3 text-right">{formatCurrencyFull(r.outflow)}</td>
                  <td
                    className={`px-3 text-right font-medium ${
                      r.balance < 0 ? "text-red-600" : "text-emerald-600"
                    }`}
                  >
                    {r.balance >= 0 ? "+" : ""}
                    {formatCurrencyFull(r.balance)}
                  </td>
                  <td className="px-3 text-right">{formatCurrencyFull(r.cumulativeBalance)}</td>
                </tr>
              ))}
              <tr className="bg-slate-50 font-bold">
                <td className="px-3 py-2.5">合計</td>
                <td className="px-3 text-right">{formatCurrencyFull(cfTotal.inflow)}</td>
                <td className="px-3 text-right">{formatCurrencyFull(cfTotal.outflow)}</td>
                <td
                  className={`px-3 text-right ${
                    cfTotal.balance < 0 ? "text-red-600" : "text-emerald-600"
                  }`}
                >
                  {cfTotal.balance >= 0 ? "+" : ""}
                  {formatCurrencyFull(cfTotal.balance)}
                </td>
                <td className="px-3 text-right">—</td>
              </tr>
            </tbody>
          </table>
          <div className="px-4 py-2 bg-blue-50 text-xs text-slate-600">
            💡 入金予定：実績がある場合は実績月、なければ請求の予定月。出金予定：月次原価。
          </div>
        </div>
      )}
    </div>
  );
}
