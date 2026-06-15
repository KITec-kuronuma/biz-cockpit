import { prisma } from "@/lib/prisma";
import { calcPaymentRate, calcFunnel } from "@/lib/domain/kpi";
import { calcCashflow } from "@/lib/domain/cf";
import { getMonthsBetween, getFiscalMonths } from "@/lib/domain/fiscal";
import {
  getScheduledAmount,
  getInitialAmount,
  getEffectiveActualAmount,
} from "@/lib/domain/license";
import {
  MonthlyDetailTable,
  type MonthlyData,
  type BreakdownItem,
} from "@/components/dashboard/MonthlyDetailTable";
import { formatCurrency, formatPercent, formatCurrencyFull } from "@/lib/format";
import { STATUS_LABELS, PROGRESS_LABELS } from "@/lib/types";
import Link from "next/link";

export default async function DashboardPage() {
  const [setting, projects, clientBudgets, licenses, currentFY] = await Promise.all([
    prisma.setting.findFirst(),
    prisma.project.findMany({
      include: {
        client: true,
        invoices: { include: { payments: true } },
        costs: true,
        forecasts: true,
      },
    }),
    prisma.clientMonthlyBudget.findMany({ include: { client: true } }),
    prisma.licenseContract.findMany({
      include: { client: true, schedules: true, actuals: true, initialSchedules: true },
    }),
    prisma.fiscalYear.findFirst({ where: { isCurrent: true } }),
  ]);

  // 会計年度：DBから現在の年度を取得（無ければ 設定の開始月から12ヶ月生成）
  const fiscalLabel = currentFY?.label ?? "—";
  const fiscalStartYM = currentFY?.startYM ?? `2026-${String(setting?.fiscalStartMonth ?? 4).padStart(2, "0")}`;
  const fiscalEndYM = currentFY?.endYM ?? `2027-${String(((setting?.fiscalStartMonth ?? 4) + 11) % 12 || 12).padStart(2, "0")}`;
  const months = currentFY
    ? getMonthsBetween(currentFY.startYM, currentFY.endYM)
    : getFiscalMonths({ startMonth: setting?.fiscalStartMonth ?? 4, year: 2026 });
  // 基準月（今月）：当年度内なら現実の今月、年度外なら年度の先頭月
  const today = new Date();
  const todayYM = `${today.getUTCFullYear()}-${String(today.getUTCMonth() + 1).padStart(2, "0")}`;
  const thisMonth = months.includes(todayYM) ? todayYM : months[0];

  const payment = calcPaymentRate(projects);
  const funnel = calcFunnel(projects);

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
  const nowDate = new Date();
  let overdueAmount = 0;
  let overdueCount = 0;
  for (const p of projects) {
    for (const inv of p.invoices) {
      if (!inv.dueDate) continue;
      const paid = inv.payments.reduce((s, x) => s + x.amount, 0);
      const remaining = inv.amount - paid;
      if (remaining > 0 && inv.dueDate < nowDate) {
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
        <p className="text-xs text-slate-700 mt-1">
          {fiscalLabel}（{fiscalStartYM} 〜 {fiscalEndYM}・{months.length}ヶ月）／ 基準月：
          <strong>{thisMonth}</strong>
        </p>
      </div>

{(() => {
        // ===== 月別 予算 / 実績 / 売上予定（見込み） を集計 =====
        const byMonth: Record<string, { budget: number; actual: number; forecast: number }> = {};
        months.forEach((m) => (byMonth[m] = { budget: 0, actual: 0, forecast: 0 }));

        // 予算：取引先×月別予算の合計
        for (const b of clientBudgets) {
          if (byMonth[b.yearMonth]) byMonth[b.yearMonth].budget += b.amount;
        }
        // 実績：請求月で計上
        // 売上予定：案件月別フォーキャスト
        for (const p of projects) {
          for (const f of p.forecasts) {
            if (byMonth[f.yearMonth]) byMonth[f.yearMonth].forecast += f.amount;
          }
          for (const inv of p.invoices) {
            const ym = `${inv.invoiceDate.getUTCFullYear()}-${String(
              inv.invoiceDate.getUTCMonth() + 1
            ).padStart(2, "0")}`;
            if (byMonth[ym]) byMonth[ym].actual += inv.amount;
          }
        }

        // ライセンス：予算・計上予定・実績を月別加算
        // 売上予定 = scheduled - actual（二重計上回避：実績化された分は予定から除外）
        for (const l of licenses) {
          for (const m of months) {
            // 予算（期初予算）
            byMonth[m].budget += getInitialAmount(l, m);
            const scheduled = getScheduledAmount(l, m);
            const actual = getEffectiveActualAmount(l, m, thisMonth);
            // 実績（年額：契約期間内、月額：過去月＋当月請求済、一括：契約開始月）
            byMonth[m].actual += actual;
            // 売上予定 = 計上予定のうちまだ実績化されていない分（年額：契約終了後の更新分など）
            byMonth[m].forecast += Math.max(0, scheduled - actual);
          }
        }

        // 既請求済みは見込みから差し引いて二重計上を防ぐ（簡易：見込み≥実績のときに調整）
        // ただし運用上、見込みは未請求分の予測なのでそのまま積み上げる選択もある。
        // ここでは「着地見込み = 実績 + 未来の見込み」とする
        const futureMonths = months.filter((m) => m > thisMonth);
        const totalBudget = Object.values(byMonth).reduce((s, v) => s + v.budget, 0);
        const totalActual = Object.values(byMonth).reduce((s, v) => s + v.actual, 0);
        const totalFutureForecast = futureMonths.reduce(
          (s, m) => s + byMonth[m].forecast,
          0
        );
        const totalCurrentMonthForecast = byMonth[thisMonth]?.forecast ?? 0;
        // 着地見込み = 実績合計 + 当月以降の見込み（見込みのほうが実績より大きい分）
        const totalLanding = totalActual + totalFutureForecast +
          Math.max(0, totalCurrentMonthForecast - (byMonth[thisMonth]?.actual ?? 0));

        const achievementRate = totalBudget > 0 ? totalActual / totalBudget : 0;
        const landingRate = totalBudget > 0 ? totalLanding / totalBudget : 0;
        const diffActual = totalActual - totalBudget;
        const diffLanding = totalLanding - totalBudget;

        return (
          <>
            {/* 予算進捗 KPI */}
            <div className="grid grid-cols-4 gap-4 mb-6">
              <KPICard
                label="当期予算（取引先×月の合計）"
                value={formatCurrency(totalBudget)}
                sub={`${clientBudgets.length}件登録`}
                color="slate"
              />
              <KPICard
                label="実績（請求済）"
                value={formatCurrency(totalActual)}
                sub={`予算比 ${formatPercent(achievementRate)}`}
                color="blue"
              />
              <KPICard
                label="着地見込み（実績＋売上予定）"
                value={formatCurrency(totalLanding)}
                sub={`予算比 ${formatPercent(landingRate)}`}
                color={landingRate >= 1 ? "green" : "amber"}
              />
              <KPICard
                label="達成差異（着地 − 予算）"
                value={`${diffLanding >= 0 ? "+" : ""}${formatCurrency(diffLanding)}`}
                sub={
                  diffLanding >= 0
                    ? "予算達成見込み 🎉"
                    : `予算未達 ${formatPercent(Math.abs(diffLanding) / Math.max(totalBudget, 1))}`
                }
                color={diffLanding >= 0 ? "green" : "red"}
              />
            </div>

            {/* 月別比較グラフ */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 mb-6">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h2 className="text-base font-bold text-slate-900">月別：予算 vs 実績 vs 売上予定</h2>
                  <p className="text-xs text-slate-600 mt-0.5">
                    取引先別月別予算の合計 / 案件別月別フォーキャストの合計 / 請求実績
                  </p>
                </div>
                <div className="text-right text-sm space-y-0.5">
                  <div className="text-slate-700">
                    予算 <strong className="text-slate-900">{formatCurrency(totalBudget)}</strong>
                  </div>
                  <div className="text-slate-700">
                    実績 <strong className="text-blue-700">{formatCurrency(totalActual)}</strong>{" "}
                    （達成率 <strong className="text-slate-900">{formatPercent(achievementRate)}</strong>）
                  </div>
                  <div className="text-slate-700">
                    着地見込み{" "}
                    <strong className={landingRate >= 1 ? "text-emerald-700" : "text-amber-700"}>
                      {formatCurrency(totalLanding)}
                    </strong>{" "}
                    （達成率 <strong className="text-slate-900">{formatPercent(landingRate)}</strong>）
                  </div>
                </div>
              </div>

              {(() => {
                const max = Math.max(
                  ...Object.values(byMonth).map((v) => Math.max(v.budget, v.actual, v.forecast)),
                  1
                );
                return (
                  <div className="flex items-end gap-2 h-44">
                    {months.map((m) => {
                      const { budget, actual, forecast } = byMonth[m];
                      const bH = (budget / max) * 100;
                      const aH = (actual / max) * 100;
                      const fH = (forecast / max) * 100;
                      const isCurrent = m === thisMonth;
                      return (
                        <div key={m} className="flex-1 flex flex-col items-center gap-1">
                          <div className="w-full h-36 flex items-end justify-center gap-0.5">
                            <div
                              className="flex-1 bg-slate-300 rounded-t-sm min-h-[1px]"
                              style={{ height: `${bH}%` }}
                              title={`予算: ${formatCurrencyFull(budget)}`}
                            />
                            <div
                              className="flex-1 bg-blue-500 rounded-t-sm min-h-[1px]"
                              style={{ height: `${aH}%` }}
                              title={`実績: ${formatCurrencyFull(actual)}`}
                            />
                            <div
                              className="flex-1 bg-amber-400 rounded-t-sm min-h-[1px]"
                              style={{ height: `${fH}%` }}
                              title={`売上予定: ${formatCurrencyFull(forecast)}`}
                            />
                          </div>
                          <div
                            className={`text-xs font-semibold ${
                              isCurrent ? "text-blue-700" : "text-slate-700"
                            }`}
                          >
                            {m.slice(5)}月
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}

              <div className="flex gap-4 mt-3 text-xs text-slate-700 font-medium">
                <span>
                  <span className="inline-block w-3 h-2 bg-slate-300 rounded-sm mr-1" />
                  予算（取引先別月別）
                </span>
                <span>
                  <span className="inline-block w-3 h-2 bg-blue-500 rounded-sm mr-1" />
                  実績（請求済）
                </span>
                <span>
                  <span className="inline-block w-3 h-2 bg-amber-400 rounded-sm mr-1" />
                  売上予定（案件別月別）
                </span>
              </div>

              {totalBudget === 0 && (
                <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded text-xs text-amber-800">
                  ⚠️ まだ予算が1件も登録されていません。<br />
                  取引先詳細画面の <strong>「💰 月別予算」</strong> セクションで、各取引先の月別売上目標を登録してください。
                </div>
              )}
            </div>

            {/* 月次明細テーブル（クリックで内訳表示） */}
            {(() => {
              const monthlyData: MonthlyData[] = months.map((m) => {
                const { budget, actual, forecast } = byMonth[m];
                const budgetBreakdown: BreakdownItem[] = [];
                const actualBreakdown: BreakdownItem[] = [];
                const forecastBreakdown: BreakdownItem[] = [];

                // 予算内訳：取引先別予算
                for (const b of clientBudgets) {
                  if (b.yearMonth === m && b.amount > 0) {
                    budgetBreakdown.push({
                      source: "client_budget",
                      description: b.client.name,
                      subDescription: b.note ?? undefined,
                      amount: b.amount,
                    });
                  }
                }
                // 予算内訳：ライセンス期初予算
                for (const l of licenses) {
                  const v = getInitialAmount(l, m);
                  if (v > 0) {
                    budgetBreakdown.push({
                      source: "license_initial",
                      description: l.client.name,
                      subDescription: `${l.productName}${l.planName ? " / " + l.planName : ""}`,
                      amount: v,
                    });
                  }
                }

                // 実績内訳：案件請求
                for (const p of projects) {
                  for (const inv of p.invoices) {
                    const ym = `${inv.invoiceDate.getUTCFullYear()}-${String(
                      inv.invoiceDate.getUTCMonth() + 1
                    ).padStart(2, "0")}`;
                    if (ym === m && inv.amount > 0) {
                      actualBreakdown.push({
                        source: "invoice",
                        description: p.client.name,
                        subDescription: `${p.title}（請求日 ${inv.invoiceDate
                          .toISOString()
                          .slice(0, 10)}）`,
                        amount: inv.amount,
                      });
                    }
                  }
                }
                // 実績内訳：ライセンス
                for (const l of licenses) {
                  const v = getEffectiveActualAmount(l, m, thisMonth);
                  if (v > 0) {
                    actualBreakdown.push({
                      source: "license_actual",
                      description: l.client.name,
                      subDescription: `${l.productName}${l.planName ? " / " + l.planName : ""}（${
                        l.billingCycle === "YEARLY" ? "年額均等割" : l.billingCycle === "MONTHLY" ? "月額" : "一括"
                      }）`,
                      amount: v,
                    });
                  }
                }

                // 売上予定内訳：案件月別予定
                for (const p of projects) {
                  for (const f of p.forecasts) {
                    if (f.yearMonth === m && f.amount > 0) {
                      forecastBreakdown.push({
                        source: "project_forecast",
                        description: p.client.name,
                        subDescription: `${p.title}${f.note ? " — " + f.note : ""}`,
                        amount: f.amount,
                      });
                    }
                  }
                }
                // 売上予定内訳：ライセンス（実績化されていない分）
                for (const l of licenses) {
                  const scheduled = getScheduledAmount(l, m);
                  const actualL = getEffectiveActualAmount(l, m, thisMonth);
                  const pending = scheduled - actualL;
                  if (pending > 0) {
                    forecastBreakdown.push({
                      source: "license_scheduled",
                      description: l.client.name,
                      subDescription: `${l.productName}${l.planName ? " / " + l.planName : ""}`,
                      amount: pending,
                    });
                  }
                }

                return {
                  yearMonth: m,
                  budget,
                  actual,
                  forecast,
                  budgetBreakdown,
                  actualBreakdown,
                  forecastBreakdown,
                };
              });

              return (
                <MonthlyDetailTable
                  months={monthlyData}
                  thisMonth={thisMonth}
                  totals={{
                    budget: totalBudget,
                    actual: totalActual,
                    forecast: totalFutureForecast + totalCurrentMonthForecast,
                    diffActual,
                    diffLanding,
                    achievementRate,
                    landingRate,
                  }}
                />
              );
            })()}

          </>
        );
      })()}

      {/* 補助KPI（運用状況） */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <KPICard label="進行中案件" value={`${activeProjects.length}件`} sub="失注・保留を除く" />
        <KPICard
          label={`今月の入金予定（${thisMonth}）`}
          value={formatCurrency(thisMonthInflow)}
          sub="実績＋請求残額"
          color="emerald"
        />
        <KPICard
          label="入金率"
          value={formatPercent(payment.rate)}
          sub={`請求 ${formatCurrency(payment.invoiced)} / 入金 ${formatCurrency(payment.paid)}`}
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
        <div className="flex gap-4 mt-3 text-xs text-slate-700 font-medium">
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
    blue: "text-blue-700",
    green: "text-emerald-700",
    emerald: "text-emerald-600",
    amber: "text-amber-700",
    red: "text-red-700",
    slate: "text-slate-900",
  };
  return (
    <div className="bg-white rounded-xl border border-slate-300 p-4">
      <div className="text-xs text-slate-700 font-semibold mb-1">{label}</div>
      <div className={`text-2xl font-bold ${colorMap[color]}`}>{value}</div>
      {sub && <div className="text-xs text-slate-600 mt-1">{sub}</div>}
    </div>
  );
}
