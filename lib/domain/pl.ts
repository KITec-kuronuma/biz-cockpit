// 月次PL（損益）計算（上長仕様 v1.0 準拠）

import { toYearMonth } from "@/lib/format";

type RevenueBasis = "DELIVERY" | "INVOICE" | "CONTRACT";

export interface PLProject {
  id: string;
  status: string;
  contractDate: Date | null;
  deliveryDate: Date | null;
  contractAmount: number;
  invoices: { invoiceDate: Date; amount: number }[];
  costs: { yearMonth: string; amount: number }[];
}

export interface PLRow {
  yearMonth: string;
  revenue: number;
  cost: number;
  grossProfit: number;
  grossMargin: number;
}

export function calcMonthlyPL({
  projects,
  months,
  basis,
}: {
  projects: PLProject[];
  months: string[];
  basis: RevenueBasis;
}): PLRow[] {
  const monthSet = new Set(months);
  const map: Record<string, { revenue: number; cost: number }> = {};
  months.forEach((m) => (map[m] = { revenue: 0, cost: 0 }));

  for (const p of projects) {
    // 失注は売上計上しないが、原価は計上
    if (p.status !== "LOST") {
      if (basis === "DELIVERY" && p.deliveryDate) {
        const ym = toYearMonth(p.deliveryDate);
        if (monthSet.has(ym)) map[ym].revenue += p.contractAmount;
      } else if (basis === "CONTRACT" && p.contractDate) {
        const ym = toYearMonth(p.contractDate);
        if (monthSet.has(ym)) map[ym].revenue += p.contractAmount;
      } else if (basis === "INVOICE") {
        for (const inv of p.invoices) {
          const ym = toYearMonth(inv.invoiceDate);
          if (monthSet.has(ym)) map[ym].revenue += inv.amount;
        }
      }
    }
    // 原価は失注関係なく計上
    for (const c of p.costs) {
      if (monthSet.has(c.yearMonth)) map[c.yearMonth].cost += c.amount;
    }
  }

  return months.map((m) => {
    const { revenue, cost } = map[m];
    const grossProfit = revenue - cost;
    const grossMargin = revenue > 0 ? grossProfit / revenue : 0;
    return { yearMonth: m, revenue, cost, grossProfit, grossMargin };
  });
}
