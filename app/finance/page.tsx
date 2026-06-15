import { prisma } from "@/lib/prisma";
import { calcMonthlyPL } from "@/lib/domain/pl";
import { calcCashflow } from "@/lib/domain/cf";
import { getMonthsBetween, getFiscalMonths } from "@/lib/domain/fiscal";
import { getEffectiveActualAmount } from "@/lib/domain/license";
import { formatCurrencyFull, formatPercent } from "@/lib/format";
import { REVENUE_BASIS_LABELS } from "@/lib/types";
import Link from "next/link";

type SearchParams = Promise<{ basis?: string; fy?: string; tab?: string }>;

export default async function FinancePage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const [setting, fiscalYears, projects, licenses] = await Promise.all([
    prisma.setting.findFirst(),
    prisma.fiscalYear.findMany({ orderBy: { startYM: "asc" } }),
    prisma.project.findMany({
      include: {
        invoices: { include: { payments: true } },
        costs: true,
      },
    }),
    prisma.licenseContract.findMany({
      include: { schedules: true, actuals: true, initialSchedules: true },
    }),
  ]);

  const basis = (params.basis ?? setting?.defaultRevenueBasis ?? "DELIVERY") as
    | "DELIVERY"
    | "INVOICE"
    | "CONTRACT";
  const tab = (params.tab ?? "pl") as "pl" | "cf";

  // 表示する会計年度を決定（URLパラメータ or 現在年度）
  const selectedFY =
    fiscalYears.find((fy) => fy.id === params.fy) ??
    fiscalYears.find((fy) => fy.isCurrent) ??
    fiscalYears[0];

  const months = selectedFY
    ? getMonthsBetween(selectedFY.startYM, selectedFY.endYM)
    : getFiscalMonths({ startMonth: setting?.fiscalStartMonth ?? 4, year: 2026 });

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

  // 当月（基準月）を決定
  const today = new Date();
  const todayYM = `${today.getUTCFullYear()}-${String(today.getUTCMonth() + 1).padStart(2, "0")}`;
  const thisMonth = months.includes(todayYM) ? todayYM : months[0] ?? todayYM;

  // ライセンス売上を月別に加算（年額：契約期間内、月額：過去月＋請求済当月）
  for (const l of licenses) {
    for (const r of plRows) {
      r.revenue += getEffectiveActualAmount(l, r.yearMonth, thisMonth);
    }
    for (const r of cfRows) {
      r.inflow += getEffectiveActualAmount(l, r.yearMonth, thisMonth);
    }
  }
  // 粗利再計算
  for (const r of plRows) {
    r.grossProfit = r.revenue - r.cost;
    r.grossMargin = r.revenue > 0 ? r.grossProfit / r.revenue : 0;
  }
  // CF累計再計算
  {
    let cum = 0;
    for (const r of cfRows) {
      r.balance = r.inflow - r.outflow;
      cum += r.balance;
      r.cumulativeBalance = cum;
    }
  }

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
      <div className="flex justify-between items-start mb-4 flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold">財務（PL / CF）</h1>
          <p className="text-xs text-slate-700 mt-1">
            {selectedFY
              ? `${selectedFY.label}（${selectedFY.startYM} 〜 ${selectedFY.endYM}・${months.length}ヶ月）`
              : "—"}
          </p>
        </div>
        <div className="flex flex-col gap-2 items-end">
          {/* 会計年度切替 */}
          {fiscalYears.length > 0 && (
            <div className="flex gap-1">
              <span className="text-[10px] text-slate-700 font-semibold mr-1 self-center">
                会計年度:
              </span>
              {fiscalYears.map((fy) => (
                <Link
                  key={fy.id}
                  href={`/finance?basis=${basis}&fy=${fy.id}&tab=${tab}`}
                  className={`px-2 py-1 rounded text-[11px] ${
                    selectedFY?.id === fy.id
                      ? "bg-blue-600 text-white font-semibold"
                      : "bg-white border border-slate-300 text-slate-700"
                  }`}
                >
                  {fy.label}
                  {fy.isCurrent && " ★"}
                </Link>
              ))}
            </div>
          )}
          {/* 売上計上基準 */}
          <div className="flex gap-2">
            {(["DELIVERY", "INVOICE", "CONTRACT"] as const).map((b) => (
              <Link
                key={b}
                href={`/finance?basis=${b}&fy=${selectedFY?.id ?? ""}&tab=${tab}`}
                className={`px-3 py-1.5 rounded-lg text-xs ${
                  basis === b
                    ? "bg-blue-600 text-white font-semibold"
                    : "bg-white border border-slate-300 text-slate-700"
                }`}
              >
                {REVENUE_BASIS_LABELS[b]}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* タブ */}
      <div className="flex gap-0 border-b-2 border-slate-200 mb-4">
        <Link
          href={`/finance?basis=${basis}&fy=${selectedFY?.id ?? ""}&tab=pl`}
          className={`px-4 py-2 text-sm ${
            tab === "pl"
              ? "text-blue-600 border-b-2 border-blue-600 -mb-0.5 font-semibold"
              : "text-slate-500"
          }`}
        >
          📊 月次PL（損益）
        </Link>
        <Link
          href={`/finance?basis=${basis}&fy=${selectedFY?.id ?? ""}&tab=cf`}
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
