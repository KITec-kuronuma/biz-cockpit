// KPI計算（上長仕様 v1.0 準拠）

import { fiscalYearOf } from "./fiscal";

export interface KPIProject {
  status: string;
  contractDate: Date | null;
  contractAmount: number;
  invoices: {
    amount: number;
    payments: { amount: number }[];
  }[];
}

export function calcContractAchievement({
  projects,
  fiscalYear,
  fiscalStartMonth,
  targetAmount,
}: {
  projects: KPIProject[];
  fiscalYear: number;
  fiscalStartMonth: number;
  targetAmount: number;
}): { wonAmount: number; targetAmount: number; rate: number } {
  const wonAmount = projects
    .filter(
      (p) =>
        p.status === "WON" &&
        p.contractDate &&
        fiscalYearOf(p.contractDate, fiscalStartMonth) === fiscalYear
    )
    .reduce((s, p) => s + p.contractAmount, 0);

  const rate = targetAmount > 0 ? wonAmount / targetAmount : 0;
  return { wonAmount, targetAmount, rate };
}

export function calcWonCount({
  projects,
  fiscalYear,
  fiscalStartMonth,
}: {
  projects: KPIProject[];
  fiscalYear: number;
  fiscalStartMonth: number;
}): number {
  return projects.filter(
    (p) =>
      p.status === "WON" &&
      p.contractDate &&
      fiscalYearOf(p.contractDate, fiscalStartMonth) === fiscalYear
  ).length;
}

export function calcPaymentRate(projects: KPIProject[]): {
  invoiced: number;
  paid: number;
  unpaid: number;
  rate: number;
} {
  let invoiced = 0;
  let paid = 0;
  for (const p of projects) {
    for (const inv of p.invoices) {
      invoiced += inv.amount;
      paid += inv.payments.reduce((s, x) => s + x.amount, 0);
    }
  }
  return {
    invoiced,
    paid,
    unpaid: invoiced - paid,
    rate: invoiced > 0 ? paid / invoiced : 0,
  };
}

export function calcFunnel(projects: { status: string; contractAmount: number }[]): Record<
  string,
  { count: number; amount: number }
> {
  const result: Record<string, { count: number; amount: number }> = {
    LEAD: { count: 0, amount: 0 },
    NEGOTIATING: { count: 0, amount: 0 },
    WON: { count: 0, amount: 0 },
    LOST: { count: 0, amount: 0 },
    ON_HOLD: { count: 0, amount: 0 },
  };
  for (const p of projects) {
    if (result[p.status]) {
      result[p.status].count += 1;
      result[p.status].amount += p.contractAmount;
    }
  }
  return result;
}
