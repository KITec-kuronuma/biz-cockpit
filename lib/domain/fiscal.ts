// 会計年度ユーティリティ（上長仕様準拠・UTC基準）

export function getFiscalMonths({
  startMonth,
  year,
}: {
  startMonth: number;
  year: number;
}): string[] {
  const months: string[] = [];
  for (let i = 0; i < 12; i++) {
    const m = ((startMonth - 1 + i) % 12) + 1;
    const y = startMonth - 1 + i >= 12 ? year + 1 : year;
    months.push(`${y}-${String(m).padStart(2, "0")}`);
  }
  return months;
}

export function fiscalYearOf(date: Date, startMonth: number): number {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth() + 1;
  return m >= startMonth ? y : y - 1;
}

export function getFiscalRange(year: number, startMonth: number): {
  start: Date;
  end: Date;
} {
  const start = new Date(Date.UTC(year, startMonth - 1, 1));
  const end = new Date(Date.UTC(year + 1, startMonth - 1, 1));
  return { start, end };
}
