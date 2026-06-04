import { prisma } from "@/lib/prisma";
import { calcContractAchievement, calcPaymentRate, calcFunnel } from "@/lib/domain/kpi";
import { calcCashflow } from "@/lib/domain/cf";
import { getFiscalMonths } from "@/lib/domain/fiscal";
import { formatCurrency, formatPercent, formatCurrencyFull, toYearMonth } from "@/lib/format";
import { STATUS_LABELS, PROGRESS_LABELS } from "@/lib/types";
import Link from "next/link";

export default async function DashboardPage() {
  const [setting, projects] = await Promise.all([
    prisma.setting.findFirst(),
    prisma.project.findMany({
      include: {
        client: true,
        invoices: { include: { payments: true } },
        costs: true,
      },
    }),
  ]);

  const fiscalYear = 2026;
  const fiscalStartMonth = setting?.fiscalStartMonth ?? 4;
  const targetAmount = setting?.targetContractAmount ?? 100_000_000;
  const annualBudget = setting?.annualBudgetRevenue ?? 120_000_000;
  const months = getFiscalMonths({ startMonth: fiscalStartMonth, year: fiscalYear });
  const thisMonth = "2026-05"; // ダッシュボードの基準月（実機ではDate.now()を使う）

  const achievement = calcContractAchievement({
    projects,
    fiscalYear,
    fiscalStartMonth,
    targetAmount,
  });

  const payment = calcPaymentRate(projects);
  const funnel = calcFunnel(projects);

  const wonCount = projects.filter((p) => p.status === "WON").length;
  const activeProjects = projects.filter((p) => !["LOST", "ON_HOLD"].includes(p.status));

  // CF計算
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

  // 今月の入金予定計算
  const thisMonthCF = cfRows.find((r) => r.yearMonth === thisMonth);
  const thisMonthInflow = thisMonthCF?.inflow ?? 0;

  // 入金遅延（dueDate 過去 かつ 未入金）
  const today = new Date("2026-05-19T00:00:00Z");
  let overdueAmount = 0;
  let overdueCount = 0;
  for (const p of projects) {
    for (const inv of p.invoices) {
      if (!inv.dueDate) continue;
      const paid = inv.payments.reduce((s, x) => s + x.amount, 0);
      const remaining = inv.amount - paid;
      if (remaining > 0 && inv.dueDate < today) {
        overdueAmount += remaining;
        overdueCount += 1;
      }
    }
  }

  const maxAbs = Math.max(...cfRows.map((r) => Math.max(Math.abs(r.inflow), Math.abs(r.outflow))), 1);

  return (
    <div className="p-6 max-w-[1600px]">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-900">ダッシュボード</h1>
        <p className="text-xs text-slate-500 mt-1">
          {fiscalYear}年度（{fiscalStartMonth}月開始） ／ 基準月：{thisMonth}
        </p>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-6">
        <KPICard
          label="受注額（年度）"
          value={formatCurrency(achievement.wonAmount)}
          sub={`目標 ${formatCurrency(achievement.targetAmount)}`}
          color="blue"
        />
        <KPICard
          label="契約達成率"
          value={formatPercent(achievement.rate)}
          sub={`受注 ${wonCount}件 / 目標 ${setting?.targetContractCount ?? 5}件`}
          color="green"
        />
        <KPICard
          label="入金率"
          value={formatPercent(payment.rate)}
          sub={`請求 ${formatCurrency(payment.invoiced)} / 入金 ${formatCurrency(payment.paid)}`}
          color="emerald"
        />
        <KPICard
          label="未入金残高"
          value={formatCurrency(payment.unpaid)}
          sub={overdueCount > 0 ? `うち遅延 ${overdueCount}件 ${formatCurrency(overdueAmount)}` : "請求済 − 入金済"}
          color={overdueCount > 0 ? "red" : "amber"}
        />
      </div>

      <div className="grid grid-cols-4 gap-4 mb-6">
        <KPICard
          label="進行中案件"
          value={`${activeProjects.length}件`}
          sub="失注・保留を除く"
        />
        <KPICard
          label={`今月の入金予定（${thisMonth}）`}
          value={formatCurrency(thisMonthInflow)}
          sub="実績＋請求残額"
          color="emerald"
        />
        <KPICard
          label="年度予算進捗"
          value={formatPercent(payment.invoiced / annualBudget)}
          sub={`売上 ${formatCurrency(payment.invoiced)} / 予算 ${formatCurrency(annualBudget)}`}
        />
        <KPICard
          label="入金遅延"
          value={overdueCount > 0 ? `${overdueCount}件` : "0件"}
          sub={overdueCount > 0 ? formatCurrencyFull(overdueAmount) : "問題なし"}
          color={overdueCount > 0 ? "red" : "slate"}
        />
      </div>

      {/* 年間キャッシュフロー */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 mb-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-sm font-semibold">年間タイムライン（入金予定 vs 出金予定）</h2>
          <Link href="/finance?tab=cf" className="text-xs text-blue-600 hover:underline">
            財務（CF）詳細 →
          </Link>
        </div>
        <div className="flex items-end gap-2 h-40">
          {cfRows.map((r) => {
            const inflowH = (r.inflow / maxAbs) * 100;
            const outflowH = (r.outflow / maxAbs) * 100;
            const isCurrent = r.yearMonth === thisMonth;
            return (
              <div key={r.yearMonth} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full h-32 flex items-end justify-center gap-0.5">
                  <div
                    className="flex-1 bg-emerald-500 rounded-t-sm min-h-[1px]"
                    style={{ height: `${inflowH}%` }}
                    title={`入金予定: ${formatCurrencyFull(r.inflow)}`}
                  />
                  <div
                    className="flex-1 bg-red-400 rounded-t-sm min-h-[1px]"
                    style={{ height: `${outflowH}%` }}
                    title={`出金予定: ${formatCurrencyFull(r.outflow)}`}
                  />
                </div>
                <div className={`text-[10px] ${isCurrent ? "text-blue-600 font-bold" : "text-slate-500"}`}>
                  {r.yearMonth.slice(5)}月
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex gap-4 mt-3 text-[11px] text-slate-500">
          <span><span className="inline-block w-3 h-2 bg-emerald-500 rounded-sm mr-1" />入金予定</span>
          <span><span className="inline-block w-3 h-2 bg-red-400 rounded-sm mr-1" />出金予定</span>
        </div>
      </div>

      {/* 契約ファネル + 案件サマリ */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="text-sm font-semibold mb-4">契約ファネル</h2>
          <div className="flex flex-col gap-2">
            {Object.entries(funnel).map(([status, { count, amount }]) => {
              const max = Math.max(...Object.values(funnel).map((f) => f.amount), 1);
              const pct = (amount / max) * 100;
              const colors: Record<string, string> = {
                LEAD: "bg-slate-300",
                NEGOTIATING: "bg-blue-300",
                WON: "bg-emerald-400",
                LOST: "bg-red-300",
                ON_HOLD: "bg-amber-300",
              };
              return (
                <div key={status} className="flex items-center gap-2">
                  <span className="w-14 text-[11px]">{STATUS_LABELS[status]}</span>
                  <div className="flex-1 h-5 bg-slate-100 rounded relative overflow-hidden">
                    <div
                      className={`absolute left-0 top-0 h-full ${colors[status]} rounded`}
                      style={{ width: `${Math.max(pct, 2)}%` }}
                    />
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] font-semibold">
                      {count}件 {formatCurrency(amount)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="col-span-2 bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-sm font-semibold">最新の案件</h2>
            <Link href="/projects" className="text-xs text-blue-600 hover:underline">
              すべての案件 →
            </Link>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500 border-b border-slate-200">
                <th className="py-2">案件名</th>
                <th>取引先</th>
                <th>状況</th>
                <th>進捗</th>
                <th className="text-right">金額</th>
              </tr>
            </thead>
            <tbody>
              {projects.slice(0, 5).map((p) => {
                return (
                  <tr key={p.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="py-2 font-medium">
                      <Link href={`/projects/${p.id}`} className="text-blue-600 hover:underline">
                        {p.title}
                      </Link>
                    </td>
                    <td className="text-xs text-slate-600">{p.client.name}</td>
                    <td>
                      <span className="px-2 py-0.5 rounded text-[10px] bg-slate-100">
                        {STATUS_LABELS[p.status]}
                      </span>
                    </td>
                    <td className="text-xs">{PROGRESS_LABELS[p.progress]}</td>
                    <td className="text-right text-xs">{formatCurrencyFull(p.contractAmount)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function KPICard({
  label,
  value,
  sub,
  color = "slate",
}: {
  label: string;
  value: string;
  sub?: string;
  color?: "blue" | "green" | "emerald" | "amber" | "red" | "slate";
}) {
  const colorMap: Record<string, string> = {
    blue: "text-blue-600",
    green: "text-emerald-600",
    emerald: "text-emerald-500",
    amber: "text-amber-600",
    red: "text-red-600",
    slate: "text-slate-900",
  };
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <div className="text-xs text-slate-500 mb-1">{label}</div>
      <div className={`text-2xl font-bold ${colorMap[color]}`}>{value}</div>
      {sub && <div className="text-[11px] text-slate-400 mt-1">{sub}</div>}
    </div>
  );
}
