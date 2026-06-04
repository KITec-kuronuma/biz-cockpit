// 月次キャッシュフロー計算（上長仕様 v1.0 準拠）

import { toYearMonth } from "@/lib/format";

export interface CFProject {
  invoices: {
    amount: number;
    dueDate: Date | null;
    payments: { paymentDate: Date; amount: number }[];
  }[];
  costs: { yearMonth: string; amount: number }[];
}

export interface CFRow {
  yearMonth: string;
  inflow: number;
  outflow: number;
  balance: number;
  cumulativeBalance: number;
}

export function calcCashflow({
  projects,
  months,
}: {
  projects: CFProject[];
  months: string[];
}): CFRow[] {
  const monthSet = new Set(months);
  const map: Record<string, { inflow: number; outflow: number }> = {};
  months.forEach((m) => (map[m] = { inflow: 0, outflow: 0 }));

  for (const p of projects) {
    for (const inv of p.invoices) {
      const paid = inv.payments.reduce((s, x) => s + x.amount, 0);
      // 実績入金がある場合は実績日の月に計上
      for (const pay of inv.payments) {
        const ym = toYearMonth(pay.paymentDate);
        if (monthSet.has(ym)) map[ym].inflow += pay.amount;
      }
      // 残額は予定日（dueDate）の月に計上
      const remaining = inv.amount - paid;
      if (remaining > 0 && inv.dueDate) {
        const ym = toYearMonth(inv.dueDate);
        if (monthSet.has(ym)) map[ym].inflow += remaining;
      }
    }
    for (const c of p.costs) {
      if (monthSet.has(c.yearMonth)) map[c.yearMonth].outflow += c.amount;
    }
  }

  let cumulative = 0;
  return months.map((m) => {
    const { inflow, outflow } = map[m];
    const balance = inflow - outflow;
    cumulative += balance;
    return { yearMonth: m, inflow, outflow, balance, cumulativeBalance: cumulative };
  });
}
