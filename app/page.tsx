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
import { ensureMigrations } from "@/lib/migrations";
import Link from "next/link";

export default async function DashboardPage() {
  await ensureMigrations();

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

        // ===== 受託開発 / ライセンス 別集計 =====
        type TypeBreakdown = { actual: number; forecast: number; budget: number };
        const projectByMonth: Record<string, TypeBreakdown> = {};
        const licenseByMonth: Record<string, TypeBreakdown> = {};
        months.forEach((m) => {
          projectByMonth[m] = { actual: 0, forecast: 0, budget: 0 };
          licenseByMonth[m] = { actual: 0, forecast: 0, budget: 0 };
        });

        // 予算：取引先×月別予算の合計
        for (const b of clientBudgets) {
          if (byMonth[b.yearMonth]) byMonth[b.yearMonth].budget += b.amount;
        }
        // 実績：請求月で計上 / 売上予定：案件フォーキャスト（実績化済み分を差し引き二重計上防止）
        for (const p of projects) {
          // 案件ごとの月別実績を先に集計（フォーキャスト調整に使う）
          const pActualByMonth: Record<string, number> = {};
          for (const inv of p.invoices) {
            const ym = `${inv.invoiceDate.getUTCFullYear()}-${String(
              inv.invoiceDate.getUTCMonth() + 1
            ).padStart(2, "0")}`;
            if (byMonth[ym]) byMonth[ym].actual += inv.amount;
            if (projectByMonth[ym]) projectByMonth[ym].actual += inv.amount;
            pActualByMonth[ym] = (pActualByMonth[ym] || 0) + inv.amount;
          }
          // 売上予定：過去・当月は実績化済み分を差し引く（ライセンスと同じロジック）
          for (const f of p.forecasts) {
            if (!byMonth[f.yearMonth]) continue;
            const pActual = pActualByMonth[f.yearMonth] || 0;
            const adj = f.yearMonth <= thisMonth ? Math.max(0, f.amount - pActual) : f.amount;
            byMonth[f.yearMonth].forecast += adj;
            projectByMonth[f.yearMonth].forecast += adj;
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
            const pending = Math.max(0, scheduled - actual);
            const licInitial = getInitialAmount(l, m);
            // 実績（年額：契約期間内、月額：過去月＋当月請求済、一括：契約開始月）
            byMonth[m].actual += actual;
            licenseByMonth[m].actual += actual;
            // 売上予定 = 計上予定のうちまだ実績化されていない分（年額：契約終了後の更新分など）
            byMonth[m].forecast += pending;
            licenseByMonth[m].forecast += pending;
            // 期初予算（ライセンス分）
            licenseByMonth[m].budget += licInitial;
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
        // 時期未定見込み（区分別に集計）
        const thisFYProjects  = projects.filter((p) => p.forecastTiming === "THIS_FY"  && (p.undatedForecast ?? 0) > 0);
        const nextFYProjects  = projects.filter((p) => p.forecastTiming === "NEXT_FY"  && (p.undatedForecast ?? 0) > 0);
        const undecidedProjects = projects.filter((p) => (p.forecastTiming ?? "UNDECIDED") === "UNDECIDED" && (p.undatedForecast ?? 0) > 0);
        const totalThisFY   = thisFYProjects.reduce((s, p)  => s + p.undatedForecast, 0);
        const totalNextFY   = nextFYProjects.reduce((s, p)  => s + p.undatedForecast, 0);
        const totalUndecided = undecidedProjects.reduce((s, p) => s + p.undatedForecast, 0);
        // 着地見込み = 実績 + 月別予定 + 当期・時期未定（THIS_FY のみ）
        const totalLanding = totalActual + totalCurrentMonthForecast + totalFutureForecast + totalThisFY;

        const achievementRate = totalBudget > 0 ? totalActual / totalBudget : 0;
        const landingRate = totalBudget > 0 ? totalLanding / totalBudget : 0;
        const diffActual = totalActual - totalBudget;
        const diffLanding = totalLanding - totalBudget;

        // ===== 顧客別売上構成の集計 =====
        const byClient: Record<string, { name: string; clientId: string; actual: number; forecast: number }> = {};

        for (const p of projects) {
          if (!byClient[p.clientId]) byClient[p.clientId] = { name: p.client.name, clientId: p.clientId, actual: 0, forecast: 0 };
          const pActualByYM: Record<string, number> = {};
          for (const inv of p.invoices) {
            const ym = `${inv.invoiceDate.getUTCFullYear()}-${String(inv.invoiceDate.getUTCMonth() + 1).padStart(2, "0")}`;
            if (months.includes(ym)) {
              byClient[p.clientId].actual += inv.amount;
              pActualByYM[ym] = (pActualByYM[ym] || 0) + inv.amount;
            }
          }
          for (const f of p.forecasts) {
            if (!months.includes(f.yearMonth)) continue;
            const pActual = pActualByYM[f.yearMonth] || 0;
            byClient[p.clientId].forecast += f.yearMonth <= thisMonth
              ? Math.max(0, f.amount - pActual)
              : f.amount;
          }
        }

        for (const l of licenses) {
          if (!byClient[l.clientId]) byClient[l.clientId] = { name: l.client.name, clientId: l.clientId, actual: 0, forecast: 0 };
          for (const m of months) {
            const lActual = getEffectiveActualAmount(l, m, thisMonth);
            const lScheduled = getScheduledAmount(l, m);
            byClient[l.clientId].actual += lActual;
            byClient[l.clientId].forecast += Math.max(0, lScheduled - lActual);
          }
        }

        const clientRows = Object.values(byClient)
          .filter((c) => c.actual + c.forecast > 0)
          .sort((a, b) => (b.actual + b.forecast) - (a.actual + a.forecast));

        const totalClientRevenue = clientRows.reduce((s, c) => s + c.actual + c.forecast, 0);

        return (
          <>
            {/* 予算進捗 KPI */}
            <div className="grid grid-cols-3 gap-4 mb-3">
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
                label="当期内・時期未定"
                value={formatCurrency(totalThisFY)}
                sub={totalThisFY > 0 ? `${thisFYProjects.length}案件（着地見込みに含む）` : "登録なし"}
                color={totalThisFY > 0 ? "amber" : "slate"}
              />
            </div>
            <div className="grid grid-cols-3 gap-4 mb-6">
              <KPICard
                label="着地見込み（実績＋月別予定＋当期未定）"
                value={formatCurrency(totalLanding)}
                sub={`予算比 ${formatPercent(landingRate)}`}
                color={landingRate >= 1 ? "green" : "amber"}
              />
              <KPICard
                label="達成差異（着地 − 予算）"
                value={`${diffLanding >= 0 ? "+" : ""}${formatCurrency(diffLanding)}`}
                sub={
                  diffLanding >= 0
                    ? "予算達成見込み"
                    : `予算未達 ${formatPercent(Math.abs(diffLanding) / Math.max(totalBudget, 1))}`
                }
                color={diffLanding >= 0 ? "green" : "red"}
              />
              <KPICard
                label="来期以降・時期未定"
                value={formatCurrency(totalNextFY)}
                sub={
                  totalNextFY > 0 || totalUndecided > 0
                    ? `来期${nextFYProjects.length}件 / 完全未定${undecidedProjects.length}件`
                    : "登録なし"
                }
                color={totalNextFY > 0 ? "slate" : "slate"}
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
                  ...Object.values(byMonth).map((v) => Math.max(v.budget, v.actual + v.forecast)),
                  1
                );
                return (
                  <div className="flex items-end gap-2 h-44">
                    {months.map((m) => {
                      const { budget, actual, forecast } = byMonth[m];
                      const bH = (budget / max) * 100;
                      const stackH = ((actual + forecast) / max) * 100;
                      const aRatio = actual / Math.max(actual + forecast, 1) * 100;
                      const fRatio = forecast / Math.max(actual + forecast, 1) * 100;
                      const isCurrent = m === thisMonth;
                      return (
                        <div key={m} className="flex-1 flex flex-col items-center gap-1">
                          <div className="w-full h-36 flex items-end justify-center gap-1">
                            {/* 予算バー */}
                            <div
                              className="flex-1 bg-slate-300 rounded-t-sm min-h-[1px]"
                              style={{ height: `${bH}%` }}
                              title={`予算: ${formatCurrencyFull(budget)}`}
                            />
                            {/* 積み上げバー（実績 + 売上予定） */}
                            <div
                              className="flex-1 flex flex-col rounded-t-sm overflow-hidden min-h-[1px]"
                              style={{ height: `${stackH}%` }}
                            >
                              <div
                                className="w-full bg-amber-400"
                                style={{ height: `${fRatio}%` }}
                                title={`売上予定: ${formatCurrencyFull(forecast)}`}
                              />
                              <div
                                className="w-full bg-blue-500"
                                style={{ height: `${aRatio}%` }}
                                title={`実績: ${formatCurrencyFull(actual)}`}
                              />
                            </div>
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

                // 売上予定内訳：案件月別予定（過去・当月は実績差引後の金額）
                for (const p of projects) {
                  const pActualThisMonth = p.invoices
                    .filter((inv) => {
                      const ym = `${inv.invoiceDate.getUTCFullYear()}-${String(inv.invoiceDate.getUTCMonth() + 1).padStart(2, "0")}`;
                      return ym === m;
                    })
                    .reduce((s, inv) => s + inv.amount, 0);
                  for (const f of p.forecasts) {
                    if (f.yearMonth === m) {
                      const adj = m <= thisMonth ? Math.max(0, f.amount - pActualThisMonth) : f.amount;
                      if (adj > 0) {
                        forecastBreakdown.push({
                          source: "project_forecast",
                          description: p.client.name,
                          subDescription: `${p.title}${f.note ? " — " + f.note : ""}`,
                          amount: adj,
                        });
                      }
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

            {/* 受託開発 / ライセンス 月別・累計内訳 */}
            {(() => {
              const totalProjectActual = months.reduce((s, m) => s + projectByMonth[m].actual, 0);
              const totalProjectForecast = months.reduce((s, m) => s + projectByMonth[m].forecast, 0);
              const totalLicenseActual = months.reduce((s, m) => s + licenseByMonth[m].actual, 0);
              const totalLicenseForecast = months.reduce((s, m) => s + licenseByMonth[m].forecast, 0);

              let cumProject = 0;
              let cumLicense = 0;

              return (
                <div className="bg-white rounded-xl border border-slate-300 p-5 mb-6 overflow-x-auto">
                  <h2 className="text-base font-bold mb-1 text-slate-900">受託開発 / ライセンス 月別内訳</h2>
                  <p className="text-xs text-slate-500 mb-3">実績＋売上予定の合計を種別ごとに表示</p>
                  <table className="w-full text-sm">
                    <thead className="bg-slate-100">
                      <tr className="border-b-2 border-slate-300">
                        <th className="px-3 py-2 text-left text-slate-700 font-bold">月</th>
                        <th className="px-3 text-right text-indigo-800 font-bold bg-indigo-50">受託開発 実績</th>
                        <th className="px-3 text-right text-indigo-700 font-bold bg-indigo-50">受託開発 予定</th>
                        <th className="px-3 text-right text-indigo-900 font-bold bg-indigo-100">受託開発 計</th>
                        <th className="px-3 text-right text-purple-800 font-bold bg-purple-50">ライセンス 実績</th>
                        <th className="px-3 text-right text-purple-700 font-bold bg-purple-50">ライセンス 予定</th>
                        <th className="px-3 text-right text-purple-900 font-bold bg-purple-100">ライセンス 計</th>
                        <th className="px-3 text-right text-slate-800 font-bold">月計</th>
                        <th className="px-3 text-right text-emerald-800 font-bold bg-emerald-50">累計</th>
                      </tr>
                    </thead>
                    <tbody>
                      {months.map((m) => {
                        const pActual = projectByMonth[m].actual;
                        const pForecast = projectByMonth[m].forecast;
                        const lActual = licenseByMonth[m].actual;
                        const lForecast = licenseByMonth[m].forecast;
                        const pTotal = pActual + pForecast;
                        const lTotal = lActual + lForecast;
                        const monthTotal = pTotal + lTotal;
                        cumProject += pTotal;
                        cumLicense += lTotal;
                        const isCurrent = m === thisMonth;
                        return (
                          <tr
                            key={m}
                            className={`border-b border-slate-200 ${isCurrent ? "bg-blue-50 font-bold" : "hover:bg-slate-50"}`}
                          >
                            <td className="px-3 py-2 text-slate-900 font-semibold">
                              {m.slice(5)}月{isCurrent && " (当月)"}
                            </td>
                            <td className="px-3 text-right text-indigo-700 bg-indigo-50/60">{formatCurrencyFull(pActual)}</td>
                            <td className="px-3 text-right text-indigo-600 bg-indigo-50/60">{formatCurrencyFull(pForecast)}</td>
                            <td className="px-3 text-right font-bold text-indigo-900 bg-indigo-100/60">{formatCurrencyFull(pTotal)}</td>
                            <td className="px-3 text-right text-purple-700 bg-purple-50/60">{formatCurrencyFull(lActual)}</td>
                            <td className="px-3 text-right text-purple-600 bg-purple-50/60">{formatCurrencyFull(lForecast)}</td>
                            <td className="px-3 text-right font-bold text-purple-900 bg-purple-100/60">{formatCurrencyFull(lTotal)}</td>
                            <td className="px-3 text-right font-semibold text-slate-900">{formatCurrencyFull(monthTotal)}</td>
                            <td className="px-3 text-right font-bold text-emerald-700 bg-emerald-50/60">{formatCurrencyFull(cumProject + cumLicense)}</td>
                          </tr>
                        );
                      })}
                      <tr className="bg-slate-200 font-bold border-t-2 border-slate-400">
                        <td className="px-3 py-2.5 text-slate-900">年間累計</td>
                        <td className="px-3 text-right text-indigo-800 bg-indigo-100">{formatCurrencyFull(totalProjectActual)}</td>
                        <td className="px-3 text-right text-indigo-700 bg-indigo-100">{formatCurrencyFull(totalProjectForecast)}</td>
                        <td className="px-3 text-right text-indigo-900 bg-indigo-200">{formatCurrencyFull(totalProjectActual + totalProjectForecast)}</td>
                        <td className="px-3 text-right text-purple-800 bg-purple-100">{formatCurrencyFull(totalLicenseActual)}</td>
                        <td className="px-3 text-right text-purple-700 bg-purple-100">{formatCurrencyFull(totalLicenseForecast)}</td>
                        <td className="px-3 text-right text-purple-900 bg-purple-200">{formatCurrencyFull(totalLicenseActual + totalLicenseForecast)}</td>
                        <td className="px-3 text-right text-slate-900">{formatCurrencyFull(totalProjectActual + totalProjectForecast + totalLicenseActual + totalLicenseForecast)}</td>
                        <td className="px-3 text-right text-emerald-800 bg-emerald-100">{formatCurrencyFull(totalProjectActual + totalProjectForecast + totalLicenseActual + totalLicenseForecast)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              );
            })()}

            {/* ① 受託開発 / ライセンス 予算対比テーブル */}
            {(() => {
              // 受託開発予算 = 全体予算 - ライセンス期初予算
              let cumProjBudget = 0, cumProjLanding = 0;
              let cumLicBudget = 0, cumLicLanding = 0;
              return (
                <div className="bg-white rounded-xl border border-slate-300 p-5 mb-6 overflow-x-auto">
                  <h2 className="text-base font-bold mb-1 text-slate-900">受託開発 / ライセンス 予算対比</h2>
                  <p className="text-xs text-slate-500 mb-3">期初予算と着地見込み（実績＋予定）の差異を種別ごとに表示</p>
                  <table className="w-full text-sm">
                    <thead className="bg-slate-100">
                      <tr className="border-b-2 border-slate-300">
                        <th className="px-3 py-2 text-left text-slate-700 font-bold">月</th>
                        <th className="px-3 text-right text-indigo-800 font-bold bg-indigo-50">受託開発 予算</th>
                        <th className="px-3 text-right text-indigo-700 font-bold bg-indigo-50">受託開発 着地</th>
                        <th className="px-3 text-right text-indigo-900 font-bold bg-indigo-100">受託 差異</th>
                        <th className="px-3 text-right text-purple-800 font-bold bg-purple-50">ライセンス 予算</th>
                        <th className="px-3 text-right text-purple-700 font-bold bg-purple-50">ライセンス 着地</th>
                        <th className="px-3 text-right text-purple-900 font-bold bg-purple-100">ライセンス 差異</th>
                        <th className="px-3 text-right text-slate-700 font-bold">合計 差異</th>
                      </tr>
                    </thead>
                    <tbody>
                      {months.map((m) => {
                        const licBudget = licenseByMonth[m].budget;
                        const projBudget = byMonth[m].budget - licBudget;
                        const projLanding = projectByMonth[m].actual + projectByMonth[m].forecast;
                        const licLanding = licenseByMonth[m].actual + licenseByMonth[m].forecast;
                        const projDiff = projLanding - projBudget;
                        const licDiff = licLanding - licBudget;
                        cumProjBudget += projBudget; cumProjLanding += projLanding;
                        cumLicBudget += licBudget; cumLicLanding += licLanding;
                        const isCurrent = m === thisMonth;
                        const diffColor = (d: number) => d >= 0 ? "text-emerald-700" : "text-red-600";
                        return (
                          <tr key={m} className={`border-b border-slate-200 ${isCurrent ? "bg-blue-50 font-bold" : "hover:bg-slate-50"}`}>
                            <td className="px-3 py-2 text-slate-900 font-semibold">{m.slice(5)}月{isCurrent && " (当月)"}</td>
                            <td className="px-3 text-right text-indigo-800 bg-indigo-50/60">{formatCurrencyFull(projBudget)}</td>
                            <td className="px-3 text-right text-indigo-700 bg-indigo-50/60">{formatCurrencyFull(projLanding)}</td>
                            <td className={`px-3 text-right font-bold bg-indigo-100/60 ${diffColor(projDiff)}`}>{projDiff >= 0 ? "+" : ""}{formatCurrencyFull(projDiff)}</td>
                            <td className="px-3 text-right text-purple-800 bg-purple-50/60">{formatCurrencyFull(licBudget)}</td>
                            <td className="px-3 text-right text-purple-700 bg-purple-50/60">{formatCurrencyFull(licLanding)}</td>
                            <td className={`px-3 text-right font-bold bg-purple-100/60 ${diffColor(licDiff)}`}>{licDiff >= 0 ? "+" : ""}{formatCurrencyFull(licDiff)}</td>
                            <td className={`px-3 text-right font-semibold ${diffColor(projDiff + licDiff)}`}>{(projDiff + licDiff) >= 0 ? "+" : ""}{formatCurrencyFull(projDiff + licDiff)}</td>
                          </tr>
                        );
                      })}
                      <tr className="bg-slate-200 font-bold border-t-2 border-slate-400">
                        <td className="px-3 py-2.5 text-slate-900">年間累計</td>
                        <td className="px-3 text-right text-indigo-800 bg-indigo-100">{formatCurrencyFull(cumProjBudget)}</td>
                        <td className="px-3 text-right text-indigo-700 bg-indigo-100">{formatCurrencyFull(cumProjLanding)}</td>
                        <td className={`px-3 text-right bg-indigo-200 ${(cumProjLanding - cumProjBudget) >= 0 ? "text-emerald-800" : "text-red-700"}`}>{(cumProjLanding - cumProjBudget) >= 0 ? "+" : ""}{formatCurrencyFull(cumProjLanding - cumProjBudget)}</td>
                        <td className="px-3 text-right text-purple-800 bg-purple-100">{formatCurrencyFull(cumLicBudget)}</td>
                        <td className="px-3 text-right text-purple-700 bg-purple-100">{formatCurrencyFull(cumLicLanding)}</td>
                        <td className={`px-3 text-right bg-purple-200 ${(cumLicLanding - cumLicBudget) >= 0 ? "text-emerald-800" : "text-red-700"}`}>{(cumLicLanding - cumLicBudget) >= 0 ? "+" : ""}{formatCurrencyFull(cumLicLanding - cumLicBudget)}</td>
                        <td className={`px-3 text-right ${((cumProjLanding + cumLicLanding) - (cumProjBudget + cumLicBudget)) >= 0 ? "text-emerald-800" : "text-red-700"}`}>{((cumProjLanding + cumLicLanding) - (cumProjBudget + cumLicBudget)) >= 0 ? "+" : ""}{formatCurrencyFull((cumProjLanding + cumLicLanding) - (cumProjBudget + cumLicBudget))}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              );
            })()}

            {/* ② 期初計画 vs 期中発生 分析テーブル */}
            {(() => {
              type PRow = { p: typeof projects[0]; fyActual: number; fyForecast: number };
              const initialProjects: PRow[] = [];
              const midYearProjects: PRow[] = [];
              const unclassified: PRow[] = [];

              for (const p of projects) {
                const fyInvoices = p.invoices.filter((inv) => {
                  const ym = `${inv.invoiceDate.getUTCFullYear()}-${String(inv.invoiceDate.getUTCMonth() + 1).padStart(2, "0")}`;
                  return months.includes(ym);
                });
                const fyForecasts = p.forecasts.filter((f) => months.includes(f.yearMonth));
                const fyActual = fyInvoices.reduce((s, inv) => s + inv.amount, 0);
                const pActualByYM: Record<string, number> = {};
                fyInvoices.forEach((inv) => {
                  const ym = `${inv.invoiceDate.getUTCFullYear()}-${String(inv.invoiceDate.getUTCMonth() + 1).padStart(2, "0")}`;
                  pActualByYM[ym] = (pActualByYM[ym] || 0) + inv.amount;
                });
                const fyForecast = fyForecasts.reduce((s, f) => {
                  const adj = f.yearMonth <= thisMonth ? Math.max(0, f.amount - (pActualByYM[f.yearMonth] || 0)) : f.amount;
                  return s + adj;
                }, 0);
                if (fyActual === 0 && fyForecast === 0) continue;
                const row: PRow = { p, fyActual, fyForecast };
                if (p.fyOrigin === "INITIAL") initialProjects.push(row);
                else if (p.fyOrigin === "MID_YEAR") midYearProjects.push(row);
                else unclassified.push(row);
              }

              const sum = (rows: PRow[], key: "fyActual" | "fyForecast") => rows.reduce((s, r) => s + r[key], 0);
              const totalInitialPlan = initialProjects.reduce((s, { p }) => s + (p.initialPlannedAmount ?? p.contractAmount), 0);
              const totalInitialLanding = sum(initialProjects, "fyActual") + sum(initialProjects, "fyForecast");
              const totalMidYear = sum(midYearProjects, "fyActual") + sum(midYearProjects, "fyForecast");

              const hasData = initialProjects.length + midYearProjects.length + unclassified.length > 0;
              if (!hasData) return null;

              const renderRows = (rows: PRow[], bgHover: string) => rows
                .sort((a, b) => (b.fyActual + b.fyForecast) - (a.fyActual + a.fyForecast))
                .map(({ p, fyActual, fyForecast }) => {
                  const landing = fyActual + fyForecast;
                  const plan = p.initialPlannedAmount ?? null;
                  const diff = plan !== null ? landing - plan : null;
                  return (
                    <tr key={p.id} className={`border-b border-slate-200 ${bgHover}`}>
                      <td className="px-3 py-2">
                        <Link href={`/projects/${p.id}`} className="text-blue-600 hover:underline font-medium text-xs">{p.title}</Link>
                      </td>
                      <td className="px-3 text-xs text-slate-600">{p.client.name}</td>
                      <td className="px-3"><span className="px-2 py-0.5 rounded text-[10px] bg-slate-100">{STATUS_LABELS[p.status]}</span></td>
                      <td className="px-3 text-right text-xs text-slate-500">{plan !== null ? formatCurrencyFull(plan) : "—"}</td>
                      <td className="px-3 text-right text-xs text-blue-700">{formatCurrencyFull(fyActual)}</td>
                      <td className="px-3 text-right text-xs text-amber-700">{formatCurrencyFull(fyForecast)}</td>
                      <td className="px-3 text-right text-xs font-bold text-slate-900">{formatCurrencyFull(landing)}</td>
                      <td className={`px-3 text-right text-xs font-bold ${diff === null ? "text-slate-400" : diff >= 0 ? "text-emerald-700" : "text-red-600"}`}>
                        {diff === null ? "—" : `${diff >= 0 ? "+" : ""}${formatCurrencyFull(diff)}`}
                      </td>
                    </tr>
                  );
                });

              const colHead = "px-3 py-2 text-slate-700 font-bold text-xs";
              return (
                <div className="bg-white rounded-xl border border-slate-300 p-5 mb-6 overflow-x-auto">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h2 className="text-base font-bold text-slate-900">期初計画 vs 期中発生 分析</h2>
                      <p className="text-xs text-slate-500 mt-0.5">案件編集画面で「案件区分」を設定すると表示されます</p>
                    </div>
                    <div className="text-right text-xs text-slate-600 space-y-0.5">
                      <div>期初計画合計 <strong className="text-slate-900">{formatCurrencyFull(totalInitialPlan)}</strong> → 着地 <strong className={totalInitialLanding >= totalInitialPlan ? "text-emerald-700" : "text-red-600"}>{formatCurrencyFull(totalInitialLanding)}</strong>（{totalInitialLanding >= totalInitialPlan ? "+" : ""}{formatCurrencyFull(totalInitialLanding - totalInitialPlan)}）</div>
                      <div>期中発生 上積み <strong className="text-indigo-700">{formatCurrencyFull(totalMidYear)}</strong>（{midYearProjects.length}件）</div>
                    </div>
                  </div>
                  <table className="w-full text-sm">
                    <thead className="bg-slate-100">
                      <tr className="border-b-2 border-slate-300 text-left">
                        <th className={colHead}>案件名</th>
                        <th className={colHead}>取引先</th>
                        <th className={colHead}>状況</th>
                        <th className={`${colHead} text-right`}>期初見込み</th>
                        <th className={`${colHead} text-right text-blue-700`}>当期実績</th>
                        <th className={`${colHead} text-right text-amber-700`}>当期予定</th>
                        <th className={`${colHead} text-right`}>着地合計</th>
                        <th className={`${colHead} text-right`}>増減</th>
                      </tr>
                    </thead>
                    <tbody>
                      {initialProjects.length > 0 && (
                        <tr className="bg-blue-50"><td colSpan={8} className="px-3 py-1.5 text-xs font-bold text-blue-800">🏁 期初からあった案件（{initialProjects.length}件）</td></tr>
                      )}
                      {renderRows(initialProjects, "hover:bg-blue-50/40")}
                      {initialProjects.length > 0 && (
                        <tr className="bg-blue-100 font-bold border-t border-blue-300 text-xs">
                          <td colSpan={3} className="px-3 py-2 text-blue-900">小計</td>
                          <td className="px-3 text-right text-slate-700">{formatCurrencyFull(totalInitialPlan)}</td>
                          <td className="px-3 text-right text-blue-800">{formatCurrencyFull(sum(initialProjects, "fyActual"))}</td>
                          <td className="px-3 text-right text-amber-800">{formatCurrencyFull(sum(initialProjects, "fyForecast"))}</td>
                          <td className="px-3 text-right text-slate-900">{formatCurrencyFull(totalInitialLanding)}</td>
                          <td className={`px-3 text-right ${(totalInitialLanding - totalInitialPlan) >= 0 ? "text-emerald-700" : "text-red-600"}`}>{(totalInitialLanding - totalInitialPlan) >= 0 ? "+" : ""}{formatCurrencyFull(totalInitialLanding - totalInitialPlan)}</td>
                        </tr>
                      )}
                      {midYearProjects.length > 0 && (
                        <tr className="bg-indigo-50"><td colSpan={8} className="px-3 py-1.5 text-xs font-bold text-indigo-800">📈 期中に発生した案件（{midYearProjects.length}件）</td></tr>
                      )}
                      {renderRows(midYearProjects, "hover:bg-indigo-50/40")}
                      {midYearProjects.length > 0 && (
                        <tr className="bg-indigo-100 font-bold border-t border-indigo-300 text-xs">
                          <td colSpan={3} className="px-3 py-2 text-indigo-900">小計（計画外上積み）</td>
                          <td className="px-3 text-right text-slate-400">—</td>
                          <td className="px-3 text-right text-blue-800">{formatCurrencyFull(sum(midYearProjects, "fyActual"))}</td>
                          <td className="px-3 text-right text-amber-800">{formatCurrencyFull(sum(midYearProjects, "fyForecast"))}</td>
                          <td className="px-3 text-right text-indigo-900">{formatCurrencyFull(totalMidYear)}</td>
                          <td className="px-3 text-right text-indigo-700">+{formatCurrencyFull(totalMidYear)}</td>
                        </tr>
                      )}
                      {unclassified.length > 0 && (
                        <>
                          <tr className="bg-slate-50"><td colSpan={8} className="px-3 py-1.5 text-xs text-slate-500">⚠️ 未分類（案件編集画面で区分を設定してください）{unclassified.length}件</td></tr>
                          {renderRows(unclassified, "hover:bg-slate-50")}
                        </>
                      )}
                    </tbody>
                  </table>
                </div>
              );
            })()}

            {/* ③ 解釈B：請求月に取引先月別予算が未登録だった案件 */}
            {(() => {
              type OutsideRow = { projectId: string; title: string; clientName: string; yearMonth: string; invoiceAmount: number };
              const outsideRows: OutsideRow[] = [];
              for (const p of projects) {
                for (const inv of p.invoices) {
                  const ym = `${inv.invoiceDate.getUTCFullYear()}-${String(inv.invoiceDate.getUTCMonth() + 1).padStart(2, "0")}`;
                  if (!months.includes(ym)) continue;
                  const hasBudget = clientBudgets.some((b) => b.clientId === p.clientId && b.yearMonth === ym && b.amount > 0);
                  if (!hasBudget) {
                    outsideRows.push({ projectId: p.id, title: p.title, clientName: p.client.name, yearMonth: ym, invoiceAmount: inv.amount });
                  }
                }
              }
              outsideRows.sort((a, b) => a.yearMonth.localeCompare(b.yearMonth));

              if (outsideRows.length === 0) return null;

              // 案件単位に集約（複数請求が同月にある場合も）
              const byProject: Record<string, { title: string; clientName: string; months: string[]; total: number }> = {};
              for (const r of outsideRows) {
                if (!byProject[r.projectId]) byProject[r.projectId] = { title: r.title, clientName: r.clientName, months: [], total: 0 };
                if (!byProject[r.projectId].months.includes(r.yearMonth)) byProject[r.projectId].months.push(r.yearMonth);
                byProject[r.projectId].total += r.invoiceAmount;
              }
              const byProjectRows = Object.entries(byProject).sort((a, b) => b[1].total - a[1].total);
              const grandTotal = byProjectRows.reduce((s, [, v]) => s + v.total, 0);

              return (
                <div className="bg-white rounded-xl border border-orange-300 p-5 mb-6 overflow-x-auto">
                  <h2 className="text-base font-bold mb-1 text-slate-900">
                    取引先予算外請求案件
                    <span className="ml-2 text-sm font-normal text-orange-700">（{byProjectRows.length}件）</span>
                  </h2>
                  <p className="text-xs text-slate-500 mb-3">請求が発生した月に、その取引先の月別予算が未登録だった案件</p>
                  <table className="w-full text-sm">
                    <thead className="bg-orange-50">
                      <tr className="border-b-2 border-orange-200 text-left">
                        <th className="px-3 py-2 text-slate-700 font-bold">案件名</th>
                        <th className="px-3 text-slate-700 font-bold">取引先</th>
                        <th className="px-3 text-slate-700 font-bold">予算未設定の請求月</th>
                        <th className="px-3 text-right text-slate-800 font-bold">請求合計</th>
                      </tr>
                    </thead>
                    <tbody>
                      {byProjectRows.map(([id, v]) => (
                        <tr key={id} className="border-b border-slate-200 hover:bg-orange-50/40">
                          <td className="px-3 py-2">
                            <Link href={`/projects/${id}`} className="text-blue-600 hover:underline font-medium">
                              {v.title}
                            </Link>
                          </td>
                          <td className="px-3 text-xs text-slate-600">{v.clientName}</td>
                          <td className="px-3 text-xs text-slate-600">{v.months.sort().join("、")}</td>
                          <td className="px-3 text-right font-bold text-slate-900">{formatCurrencyFull(v.total)}</td>
                        </tr>
                      ))}
                      <tr className="bg-orange-100 font-bold border-t-2 border-orange-300">
                        <td colSpan={3} className="px-3 py-2.5 text-slate-900">合計（{byProjectRows.length}件）</td>
                        <td className="px-3 text-right text-slate-900">{formatCurrencyFull(grandTotal)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              );
            })()}

            {/* 顧客別売上構成 */}
            {clientRows.length > 0 && (
              <div className="bg-white rounded-xl border border-slate-200 p-5 mb-6">
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <h2 className="text-base font-bold text-slate-900">顧客別売上構成</h2>
                    <p className="text-xs text-slate-600 mt-0.5">
                      当期の実績・着地見込みを顧客ごとに集計（実績＋売上予定）
                    </p>
                  </div>
                  <div className="text-right text-xs text-slate-500">
                    合計 {formatCurrencyFull(totalClientRevenue)}
                  </div>
                </div>
                <div className="space-y-2.5">
                  {clientRows.map((c) => {
                    const total = c.actual + c.forecast;
                    const pct = totalClientRevenue > 0 ? (total / totalClientRevenue) * 100 : 0;
                    const aRatio = total > 0 ? (c.actual / total) * 100 : 0;
                    const fRatio = total > 0 ? (c.forecast / total) * 100 : 0;
                    return (
                      <div key={c.clientId} className="flex items-center gap-3">
                        <Link
                          href={`/clients/${c.clientId}`}
                          className="w-36 text-xs text-slate-700 hover:text-blue-600 hover:underline truncate shrink-0"
                        >
                          {c.name}
                        </Link>
                        <div className="flex-1 h-5 bg-slate-100 rounded relative overflow-hidden">
                          <div
                            className="absolute left-0 top-0 h-full flex rounded overflow-hidden"
                            style={{ width: `${Math.max(pct, 0.4)}%` }}
                          >
                            <div
                              className="bg-blue-500"
                              style={{ width: `${aRatio}%` }}
                              title={`実績: ${formatCurrencyFull(c.actual)}`}
                            />
                            <div
                              className="bg-amber-400"
                              style={{ width: `${fRatio}%` }}
                              title={`売上予定: ${formatCurrencyFull(c.forecast)}`}
                            />
                          </div>
                        </div>
                        <div className="w-14 text-right text-xs font-semibold text-slate-700 shrink-0">
                          {pct.toFixed(1)}%
                        </div>
                        <div className="w-28 text-right text-xs text-slate-500 shrink-0">
                          {formatCurrencyFull(total)}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="flex gap-4 mt-3 text-xs text-slate-700 font-medium">
                  <span>
                    <span className="inline-block w-3 h-2 bg-blue-500 rounded-sm mr-1" />
                    実績（請求済）
                  </span>
                  <span>
                    <span className="inline-block w-3 h-2 bg-amber-400 rounded-sm mr-1" />
                    売上予定（未請求分）
                  </span>
                </div>
              </div>
            )}

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
