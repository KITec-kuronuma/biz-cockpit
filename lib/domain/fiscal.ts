// 会計年度ユーティリティ（変則期間にも対応）

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

/**
 * YYYY-MM 形式の開始/終了月から、その間の全ての年月配列を返す（両端含む）
 * 例：2026-04 〜 2026-12 → ["2026-04", "2026-05", ..., "2026-12"]
 */
export function getMonthsBetween(startYM: string, endYM: string): string[] {
  const [sy, sm] = startYM.split("-").map(Number);
  const [ey, em] = endYM.split("-").map(Number);
  if (!sy || !sm || !ey || !em) return [];
  const result: string[] = [];
  let y = sy;
  let m = sm;
  while (y < ey || (y === ey && m <= em)) {
    result.push(`${y}-${String(m).padStart(2, "0")}`);
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
    if (result.length > 60) break; // 安全装置（5年以上は弾く）
  }
  return result;
}

/**
 * Date を YYYY-MM 文字列に変換
 */
export function dateToYM(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}
