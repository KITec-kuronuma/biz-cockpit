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
  initialSchedules?: LicenseScheduleEntry[];
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
    return normalizeByBillingCycle(applicable[0].amount, license, yearMonth);
  }
  // 履歴がなければ初期値
  return normalizeByBillingCycle(license.initialMonthlyAmount, license, yearMonth);
}

/**
 * 指定月の期初予想額を取得
 * - initialSchedules があれば適用月ベースで採用
 * - なければ initialMonthlyAmount をフォールバック
 */
export function getInitialAmount(license: LicenseLike, yearMonth: string): number {
  if (!isActiveInMonth(license, yearMonth)) return 0;
  const initSched = license.initialSchedules ?? [];
  if (initSched.length > 0) {
    const applicable = initSched
      .filter((s) => s.effectiveMonth <= yearMonth)
      .sort((a, b) => b.effectiveMonth.localeCompare(a.effectiveMonth));
    if (applicable.length > 0) {
      return normalizeByBillingCycle(applicable[0].amount, license, yearMonth);
    }
  }
  return normalizeByBillingCycle(license.initialMonthlyAmount, license, yearMonth);
}

/**
 * 指定月の実績額を取得（明示的に記録された実績のみ）
 */
export function getActualAmount(license: LicenseLike, yearMonth: string): number {
  const a = license.actuals.find((x) => x.yearMonth === yearMonth);
  return a ? a.amount : 0;
}

/**
 * 指定月の「実績相当額」を計算
 *  - LicenseMonthlyActual に記録があれば最優先（手動入力した請求実績）
 *  - 年額契約：契約期間内なら scheduled をそのまま実績扱い、期間外は0
 *  - 月額契約：過去月は scheduled を実績扱い、当月以降は0（要：請求済ボタン）
 *  - 一括契約：契約開始月のみ、過去なら実績扱い
 */
export function getEffectiveActualAmount(
  license: LicenseLike,
  yearMonth: string,
  currentMonth: string
): number {
  if (!isActiveInMonth(license, yearMonth)) return 0;

  // 手動記録の実績が最優先
  const recorded = license.actuals.find((x) => x.yearMonth === yearMonth);
  if (recorded) return recorded.amount;

  const scheduled = getScheduledAmount(license, yearMonth);
  if (scheduled <= 0) return 0;

  if (license.billingCycle === "YEARLY") {
    // 年額：契約終了日内なら実績、終了日後（更新前提）は予定
    if (license.endDate) {
      const endYM = toYearMonth(license.endDate);
      return yearMonth <= endYM ? scheduled : 0;
    }
    // 終了日未設定：過去〜当月は実績、未来は予定
    return yearMonth <= currentMonth ? scheduled : 0;
  }

  if (license.billingCycle === "MONTHLY") {
    // 月額：過去月は実績、当月以降は予定（要：請求済ボタン）
    return yearMonth < currentMonth ? scheduled : 0;
  }

  if (license.billingCycle === "ONE_TIME") {
    // 一括：契約開始月のみ計上
    const startYM = toYearMonth(license.startDate);
    if (yearMonth === startYM) {
      return yearMonth <= currentMonth ? scheduled : 0;
    }
    return 0;
  }

  return 0;
}

/**
 * 指定月が「請求未確定（実績計上待ち）」か判定
 *  - 月額契約・当月のみ対象（請求をかけたら実績化）
 */
export function isPendingBilling(
  license: LicenseLike,
  yearMonth: string,
  currentMonth: string
): boolean {
  if (license.billingCycle !== "MONTHLY") return false;
  if (yearMonth !== currentMonth) return false;
  if (!isActiveInMonth(license, yearMonth)) return false;
  // 既に手動実績があれば確定済
  const recorded = license.actuals.find((x) => x.yearMonth === yearMonth);
  if (recorded) return false;
  return getScheduledAmount(license, yearMonth) > 0;
}

/**
 * 月内でライセンスが有効か（予算・計上予定の計上対象になるか）
 * - ACTIVE: 契約終了日を過ぎても継続計上（更新前提）
 * - SCHEDULED_CANCEL / CANCELLED / EXPIRED: endDate で停止
 * - いずれも startDate より前の月は対象外
 */
function isActiveInMonth(license: LicenseLike, yearMonth: string): boolean {
  const startYM = toYearMonth(license.startDate);
  if (yearMonth < startYM) return false;

  // 解約予定/解約済/失効は endDate で打ち切り
  if (
    license.status === "CANCELLED" ||
    license.status === "EXPIRED" ||
    license.status === "SCHEDULED_CANCEL"
  ) {
    if (license.endDate) {
      const endYM = toYearMonth(license.endDate);
      if (yearMonth > endYM) return false;
    }
  }
  // ACTIVE は endDate を過ぎても継続（次年度更新を前提）
  return true;
}

/**
 * 課金周期に応じて月額換算
 * - MONTHLY: そのまま
 * - YEARLY: 加入期間で均等割（endDateが無ければ12ヶ月）
 * - ONE_TIME: 契約開始月のみ全額
 */
function normalizeByBillingCycle(
  amount: number,
  license: LicenseLike,
  yearMonth: string
): number {
  if (license.billingCycle === "MONTHLY") return amount;
  if (license.billingCycle === "YEARLY") {
    const months = getContractMonths(license);
    return Math.round(amount / months);
  }
  if (license.billingCycle === "ONE_TIME") {
    // 契約開始月のみ全額計上
    const startYM = toYearMonth(license.startDate);
    return yearMonth === startYM ? amount : 0;
  }
  return amount;
}

/**
 * 加入期間（月数）を計算
 */
export function getContractMonths(license: LicenseLike): number {
  if (!license.endDate) return 12;
  const startYM = toYearMonth(license.startDate);
  const endYM = toYearMonth(license.endDate);
  const [sy, sm] = startYM.split("-").map(Number);
  const [ey, em] = endYM.split("-").map(Number);
  return Math.max((ey - sy) * 12 + (em - sm) + 1, 1);
}

function toYearMonth(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}
