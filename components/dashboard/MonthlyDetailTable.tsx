"use client";

import { useState } from "react";

export interface BreakdownItem {
  source: "client_budget" | "license_initial" | "invoice" | "license_actual" | "project_forecast" | "license_scheduled";
  description: string;
  subDescription?: string;
  amount: number;
}

export interface MonthlyData {
  yearMonth: string;
  budget: number;
  actual: number;
  forecast: number;
  budgetBreakdown: BreakdownItem[];
  actualBreakdown: BreakdownItem[];
  forecastBreakdown: BreakdownItem[];
}

export interface MonthlyDetailTableProps {
  months: MonthlyData[];
  thisMonth: string;
  totals: {
    budget: number;
    actual: number;
    forecast: number;
    diffActual: number;
    diffLanding: number;
    achievementRate: number;
    landingRate: number;
  };
}

function formatCurrencyFull(n: number): string {
  return "¥" + n.toLocaleString();
}

function formatPercent(n: number): string {
  return (n * 100).toFixed(1) + "%";
}

const SOURCE_LABEL: Record<BreakdownItem["source"], { label: string; color: string }> = {
  client_budget: { label: "取引先予算", color: "bg-slate-200 text-slate-800" },
  license_initial: { label: "ライセンス期初", color: "bg-amber-100 text-amber-800" },
  invoice: { label: "案件請求", color: "bg-blue-100 text-blue-800" },
  license_actual: { label: "ライセンス実績", color: "bg-emerald-100 text-emerald-800" },
  project_forecast: { label: "案件予定", color: "bg-orange-100 text-orange-800" },
  license_scheduled: { label: "ライセンス予定", color: "bg-purple-100 text-purple-800" },
};

interface ModalState {
  yearMonth: string;
  type: "budget" | "actual" | "forecast";
  items: BreakdownItem[];
  total: number;
}

export function MonthlyDetailTable({ months, thisMonth, totals }: MonthlyDetailTableProps) {
  const [modal, setModal] = useState<ModalState | null>(null);

  function openModal(m: MonthlyData, type: "budget" | "actual" | "forecast") {
    const items =
      type === "budget"
        ? m.budgetBreakdown
        : type === "actual"
        ? m.actualBreakdown
        : m.forecastBreakdown;
    const total = type === "budget" ? m.budget : type === "actual" ? m.actual : m.forecast;
    setModal({ yearMonth: m.yearMonth, type, items, total });
  }

  const typeLabel = {
    budget: { name: "予算", color: "text-slate-900" },
    actual: { name: "実績", color: "text-blue-700" },
    forecast: { name: "売上予定", color: "text-amber-700" },
  };

  return (
    <>
      <div className="bg-white rounded-xl border border-slate-300 p-5 mb-6 overflow-x-auto">
        <h2 className="text-base font-bold mb-3 text-slate-900">月次明細</h2>
        <p className="text-xs text-slate-600 mb-3">
          💡 各セルの金額をクリックすると内訳が表示されます
        </p>
        <table className="w-full text-sm">
          <thead className="bg-slate-100">
            <tr className="border-b-2 border-slate-300">
              <th className="px-3 py-2.5 text-left text-slate-800 font-bold">月</th>
              <th className="px-3 text-right text-slate-800 font-bold">予算</th>
              <th className="px-3 text-right text-slate-800 font-bold">実績</th>
              <th className="px-3 text-right text-slate-800 font-bold">売上予定</th>
              <th className="px-3 text-right text-slate-800 font-bold">予算 − 実績</th>
              <th className="px-3 text-right text-slate-800 font-bold">実績達成率</th>
              <th className="px-3 text-right text-slate-800 font-bold">予算 − (実績+予定)</th>
              <th className="px-3 text-right text-slate-800 font-bold">着地達成率</th>
            </tr>
          </thead>
          <tbody>
            {months.map((m) => {
              // forecast は実績差引済み（過去月は max(0, 予定-実績)）のため単純加算で正しい
              const landingAdj = m.actual + m.forecast;
              const diffA = m.budget - m.actual;
              const diffL = m.budget - landingAdj;
              const rateA = m.budget > 0 ? m.actual / m.budget : 0;
              const rateL = m.budget > 0 ? landingAdj / m.budget : 0;
              const isCurrent = m.yearMonth === thisMonth;
              return (
                <tr
                  key={m.yearMonth}
                  className={`border-b border-slate-200 ${
                    isCurrent ? "bg-blue-50 font-bold" : "hover:bg-slate-50"
                  }`}
                >
                  <td className="px-3 py-2 text-slate-900 font-semibold">
                    {m.yearMonth}
                    {isCurrent && " (当月)"}
                  </td>
                  <td className="px-3 text-right">
                    <button
                      onClick={() => openModal(m, "budget")}
                      className="text-slate-900 font-semibold hover:underline cursor-pointer disabled:cursor-default disabled:no-underline"
                      disabled={m.budget === 0}
                    >
                      {formatCurrencyFull(m.budget)}
                    </button>
                  </td>
                  <td className="px-3 text-right">
                    <button
                      onClick={() => openModal(m, "actual")}
                      className="text-blue-700 font-semibold hover:underline cursor-pointer disabled:cursor-default disabled:no-underline"
                      disabled={m.actual === 0}
                    >
                      {formatCurrencyFull(m.actual)}
                    </button>
                  </td>
                  <td className="px-3 text-right">
                    <button
                      onClick={() => openModal(m, "forecast")}
                      className="text-amber-700 font-semibold hover:underline cursor-pointer disabled:cursor-default disabled:no-underline"
                      disabled={m.forecast === 0}
                    >
                      {formatCurrencyFull(m.forecast)}
                    </button>
                  </td>
                  <td
                    className={`px-3 text-right font-semibold ${
                      diffA > 0 ? "text-red-700" : "text-emerald-700"
                    }`}
                  >
                    {diffA >= 0 ? "+" : ""}
                    {formatCurrencyFull(-diffA)}
                  </td>
                  <td className="px-3 text-right text-slate-900 font-semibold">
                    {m.budget > 0 ? formatPercent(rateA) : "—"}
                  </td>
                  <td
                    className={`px-3 text-right font-semibold ${
                      diffL > 0 ? "text-red-700" : "text-emerald-700"
                    }`}
                  >
                    {diffL >= 0 ? "+" : ""}
                    {formatCurrencyFull(-diffL)}
                  </td>
                  <td
                    className={`px-3 text-right font-bold ${
                      rateL >= 1 ? "text-emerald-700" : "text-amber-700"
                    }`}
                  >
                    {m.budget > 0 ? formatPercent(rateL) : "—"}
                  </td>
                </tr>
              );
            })}
            <tr className="bg-slate-200 font-bold border-t-2 border-slate-400">
              <td className="px-3 py-2.5 text-slate-900">年間合計</td>
              <td className="px-3 text-right text-slate-900">
                {formatCurrencyFull(totals.budget)}
              </td>
              <td className="px-3 text-right text-blue-800">
                {formatCurrencyFull(totals.actual)}
              </td>
              <td className="px-3 text-right text-amber-800">
                {formatCurrencyFull(totals.forecast)}
              </td>
              <td
                className={`px-3 text-right ${
                  totals.diffActual < 0 ? "text-red-700" : "text-emerald-700"
                }`}
              >
                {totals.diffActual >= 0 ? "+" : ""}
                {formatCurrencyFull(totals.diffActual)}
              </td>
              <td className="px-3 text-right text-slate-900">
                {formatPercent(totals.achievementRate)}
              </td>
              <td
                className={`px-3 text-right ${
                  totals.diffLanding < 0 ? "text-red-700" : "text-emerald-700"
                }`}
              >
                {totals.diffLanding >= 0 ? "+" : ""}
                {formatCurrencyFull(totals.diffLanding)}
              </td>
              <td
                className={`px-3 text-right ${
                  totals.landingRate >= 1 ? "text-emerald-700" : "text-amber-700"
                }`}
              >
                {formatPercent(totals.landingRate)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* 内訳モーダル */}
      {modal && (
        <div
          className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
          onClick={() => setModal(null)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-3 border-b border-slate-200 flex justify-between items-center">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {modal.yearMonth} の
                  <span className={`ml-2 ${typeLabel[modal.type].color}`}>
                    {typeLabel[modal.type].name}内訳
                  </span>
                </h3>
                <p className="text-xs text-slate-600 mt-0.5">{modal.items.length}件</p>
              </div>
              <button
                onClick={() => setModal(null)}
                className="text-slate-500 hover:text-slate-800 text-xl leading-none"
              >
                ×
              </button>
            </div>

            <div className="p-5">
              {modal.items.length === 0 ? (
                <p className="text-center text-sm text-slate-500 py-8">内訳データはありません</p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-slate-100">
                    <tr className="border-b-2 border-slate-300 text-left">
                      <th className="px-3 py-2 text-slate-800 font-bold">区分</th>
                      <th className="px-3 text-slate-800 font-bold">内容</th>
                      <th className="px-3 text-right text-slate-800 font-bold">金額</th>
                    </tr>
                  </thead>
                  <tbody>
                    {modal.items.map((item, idx) => {
                      const src = SOURCE_LABEL[item.source];
                      return (
                        <tr key={idx} className="border-b border-slate-200 hover:bg-slate-50">
                          <td className="px-3 py-2">
                            <span
                              className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold ${src.color}`}
                            >
                              {src.label}
                            </span>
                          </td>
                          <td className="px-3">
                            <div className="text-slate-900 font-medium">{item.description}</div>
                            {item.subDescription && (
                              <div className="text-xs text-slate-600 mt-0.5">
                                {item.subDescription}
                              </div>
                            )}
                          </td>
                          <td className="px-3 text-right font-semibold text-slate-900">
                            {formatCurrencyFull(item.amount)}
                          </td>
                        </tr>
                      );
                    })}
                    <tr className="bg-slate-200 font-bold border-t-2 border-slate-400">
                      <td colSpan={2} className="px-3 py-2.5 text-slate-900">
                        合計
                      </td>
                      <td className="px-3 text-right text-slate-900">
                        {formatCurrencyFull(modal.total)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
