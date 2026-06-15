"use client";

import { useState, useTransition } from "react";
import { markLicenseBilled } from "@/app/contracts/actions";

export interface PendingItem {
  id: string;
  clientName: string;
  productName: string;
  planName?: string | null;
  yearMonth: string;
  amount: number;
}

function formatCurrency(n: number): string {
  return "¥" + n.toLocaleString();
}

export function PendingBillingWidget({
  items,
  defaultOpen = false,
}: {
  items: PendingItem[];
  defaultOpen?: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(defaultOpen);

  function handleConfirm(item: PendingItem) {
    if (!confirm(`${item.clientName} / ${item.productName}\n${item.yearMonth} 分 ${formatCurrency(item.amount)} を実績計上しますか？`)) {
      return;
    }
    startTransition(async () => {
      await markLicenseBilled(item.id, item.yearMonth, item.amount);
    });
  }

  async function handleAllConfirm() {
    if (!confirm(`${items.length}件のライセンスを一括で実績計上します。よろしいですか？`)) return;
    startTransition(async () => {
      for (const it of items) {
        await markLicenseBilled(it.id, it.yearMonth, it.amount);
      }
    });
  }

  if (items.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-300 mb-6">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="w-full px-5 py-3 flex justify-between items-center hover:bg-slate-50 rounded-xl"
        >
          <h2 className="text-base font-bold text-slate-900">
            📋 今月のライセンス請求
            <span className="ml-2 text-xs font-normal text-emerald-700">✅ 全件確定済</span>
          </h2>
          <span className="text-slate-500 text-sm">{open ? "▲" : "▼"}</span>
        </button>
        {open && (
          <div className="px-5 pb-4 text-sm text-slate-700">
            当月分の月額ライセンスは全て請求確定済みです
          </div>
        )}
      </div>
    );
  }

  const total = items.reduce((s, it) => s + it.amount, 0);

  return (
    <div className="bg-white rounded-xl border-2 border-amber-300 mb-6">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full px-5 py-3 flex justify-between items-center hover:bg-amber-50 rounded-xl"
      >
        <div className="text-left">
          <h2 className="text-base font-bold text-slate-900">
            📋 今月の請求待ちライセンス（{items.length}件・合計 {formatCurrency(total)}）
          </h2>
          <p className="text-xs text-slate-700 mt-0.5">
            「請求済」ボタンで予定→実績へ反映されます
          </p>
        </div>
        <span className="text-slate-500 text-sm ml-2">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="px-5 pb-5">
          <div className="flex justify-end mb-3">
            <button
              onClick={handleAllConfirm}
              disabled={isPending}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-semibold disabled:opacity-50"
            >
              {isPending ? "処理中..." : "✅ 一括で請求済にする"}
            </button>
          </div>

          <table className="w-full text-sm">
            <thead className="bg-slate-100">
              <tr className="border-b border-slate-300 text-left">
                <th className="px-2 py-1.5 text-slate-800 font-bold">取引先</th>
                <th className="px-2 text-slate-800 font-bold">製品 / プラン</th>
                <th className="px-2 text-right text-slate-800 font-bold">金額</th>
                <th className="px-2 text-slate-800 font-bold">対象月</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={`${it.id}-${it.yearMonth}`} className="border-b border-slate-200">
                  <td className="px-2 py-2 font-medium text-slate-900">{it.clientName}</td>
                  <td className="px-2 text-xs text-slate-800">
                    {it.productName}
                    {it.planName && <span className="text-slate-500"> / {it.planName}</span>}
                  </td>
                  <td className="px-2 text-right font-semibold text-blue-700">
                    {formatCurrency(it.amount)}
                  </td>
                  <td className="px-2 text-xs text-slate-700">{it.yearMonth}</td>
                  <td className="px-2">
                    <button
                      onClick={() => handleConfirm(it)}
                      disabled={isPending}
                      className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[11px] font-semibold disabled:opacity-50"
                    >
                      請求済
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
