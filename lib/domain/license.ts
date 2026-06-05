// ライセンス契約の月別計算ヘルパー
// 期初予想 / 計上予定（適用月ベース） / 実績 を取得

export interface LicenseScheduleEntry {
  effectiveMonth: string;
  amount: number;
}

export interface LicenseActualEntry {
  yearMonth: string;
  amount: number;
}

export interface LicenseLike {
  initialMonthlyAmount: number;
  monthlyAmount: number;
  billingCycle: string;
  startDate: Date;
  endDate: Date | null;
  status: string;
  schedules: LicenseScheduleEntry[];
  actuals: LicenseActualEntry[];
}

/**
 * 指定月の計上予定額を取得（適用月以降の最新スケジュールを採用）
 * @param license ライセンス（schedules含む）
 * @param yearMonth YYYY-MM
 * @returns 計上予定額（適用外なら0）
 */
export function getScheduledAmount(license: LicenseLike, yearMonth: string): number {
  if (!isActiveInMonth(license, yearMonth)) return 0;

  // effectiveMonth <= yearMonth の中で最新のスケジュールを採用
  const applicable = license.schedules
    .filter((s) => s.effectiveMonth <= yearMonth)
    .sort((a, b) => b.effectiveMonth.localeCompare(a.effectiveMonth));

  if (applicable.length > 0) {
    return normalizeByBillingCycle(applicable[0].amount, license.billingCycle, yearMonth);
  }
  // 履歴がなければ初期値
  return normalizeByBillingCycle(license.initialMonthlyAmount, license.billingCycle, yearMonth);
}

/**
 * 指定月の期初予想額を取得
 */
export function getInitialAmount(license: LicenseLike, yearMonth: string): number {
  if (!isActiveInMonth(license, yearMonth)) return 0;
  return normalizeByBillingCycle(license.initialMonthlyAmount, license.billingCycle, yearMonth);
}

/**
 * 指定月の実績額を取得
 */
export function getActualAmount(license: LicenseLike, yearMonth: string): number {
  const a = license.actuals.find((x) => x.yearMonth === yearMonth);
  return a ? a.amount : 0;
}

/**
 * 月内でライセンスが有効か（解約後/失効/開始前は無効）
 */
function isActiveInMonth(license: LicenseLike, yearMonth: string): boolean {
  if (license.status === "CANCELLED" || license.status === "EXPIRED") return false;
  const startYM = toYearMonth(license.startDate);
  if (yearMonth < startYM) return false;
  if (license.endDate) {
    const endYM = toYearMonth(license.endDate);
    if (yearMonth > endYM) return false;
  }
  return true;
}

/**
 * 課金周期に応じて月額換算
 */
function normalizeByBillingCycle(amount: number, cycle: string, yearMonth: string): number {
  if (cycle === "MONTHLY") return amount;
  if (cycle === "YEARLY") {
    // 年額契約は契約開始月だけに計上する想定（単純化）
    // ※実装簡素化のため、年額の場合は12分割で表示
    return Math.round(amount / 12);
  }
  if (cycle === "ONE_TIME") {
    // 一括契約は契約開始月のみ
    return 0; // 個別計上として扱う場合は別途
  }
  return amount;
}

function toYearMonth(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}
