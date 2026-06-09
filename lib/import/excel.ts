// Excelインポート用ヘルパー（サーバーサイドで使用）

import * as XLSX from "xlsx";

export type ImportResult = {
  type: string;
  added: number;
  updated: number;
  skipped: number;
  errors: { row: number; message: string }[];
};

/**
 * ArrayBuffer から sheets を読み出す
 */
export function readWorkbook(buffer: ArrayBuffer): XLSX.WorkBook {
  return XLSX.read(buffer, { type: "array", cellDates: true });
}

/**
 * sheet を JSON 配列に変換
 */
export function sheetToRows(workbook: XLSX.WorkBook, sheetName: string): Record<string, unknown>[] {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return [];
  return XLSX.utils.sheet_to_json(sheet, { defval: null, raw: false });
}

/**
 * 日付文字列・Excelシリアル値どちらにも対応
 * 対応フォーマット：
 *  - YYYY-MM-DD / YYYY/MM/DD
 *  - MM/DD/YY (米国形式・2桁年は2000年代と仮定)
 *  - Excel シリアル値（数値）
 *  - Date オブジェクト
 */
export function parseExcelDate(v: unknown): Date | null {
  if (!v) return null;
  if (v instanceof Date) return v;
  if (typeof v === "number") {
    const d = XLSX.SSF.parse_date_code(v);
    if (!d) return null;
    return new Date(Date.UTC(d.y, d.m - 1, d.d));
  }
  if (typeof v === "string") {
    const s = v.trim();
    if (!s) return null;
    // YYYY-MM-DD / YYYY/MM/DD
    const m1 = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
    if (m1) {
      return new Date(
        Date.UTC(parseInt(m1[1]), parseInt(m1[2]) - 1, parseInt(m1[3]))
      );
    }
    // MM/DD/YYYY / MM/DD/YY
    const m2 = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
    if (m2) {
      let year = parseInt(m2[3]);
      if (year < 100) year += 2000;
      return new Date(Date.UTC(year, parseInt(m2[1]) - 1, parseInt(m2[2])));
    }
    const d = new Date(s);
    if (!isNaN(d.getTime())) return d;
  }
  return null;
}

/**
 * 会社名を正規化（株式会社等を除去）して比較しやすくする
 */
export function normalizeCompanyName(s: string): string {
  const stripped = s
    .replace(/[\s　]/g, "")
    .replace(
      /^(株式会社|有限会社|合同会社|合資会社|合名会社|医療法人|社会福祉法人|学校法人|公益財団法人|一般財団法人|公益社団法人|一般社団法人|特定非営利活動法人|NPO法人|㈱|（株）|\(株\))/,
      ""
    )
    .replace(
      /(株式会社|有限会社|合同会社|合資会社|合名会社|㈱|（株）|\(株\))$/,
      ""
    );
  return stripped.toLowerCase();
}

/**
 * サービス区分の値を正規化（日本語→英字キー）
 */
export function normalizeServiceType(v: unknown): "LICENSE" | "MAINTENANCE" {
  const s = str(v).toUpperCase();
  if (s === "MAINTENANCE" || s === "保守" || s.includes("保守")) return "MAINTENANCE";
  return "LICENSE"; // デフォルト
}

/**
 * 課金周期の値を正規化
 */
export function normalizeBillingCycle(v: unknown): "MONTHLY" | "YEARLY" | "ONE_TIME" {
  const s = str(v).toUpperCase();
  if (s === "YEARLY" || s === "年額" || s === "年" || s.includes("年")) return "YEARLY";
  if (s === "ONE_TIME" || s === "一括" || s.includes("一括")) return "ONE_TIME";
  return "MONTHLY";
}

/**
 * 更新タイプの正規化
 */
export function normalizeRenewalType(v: unknown): "AUTO" | "MANUAL" {
  const s = str(v).toUpperCase();
  if (s === "AUTO" || s === "自動" || s.includes("自動")) return "AUTO";
  return "MANUAL";
}

/**
 * ライセンスステータスの正規化
 */
export function normalizeLicenseStatus(
  v: unknown
): "ACTIVE" | "SCHEDULED_CANCEL" | "CANCELLED" | "EXPIRED" {
  const s = str(v).toUpperCase();
  if (s === "SCHEDULED_CANCEL" || s.includes("解約予定")) return "SCHEDULED_CANCEL";
  if (s === "CANCELLED" || s === "解約済" || s.includes("解約")) return "CANCELLED";
  if (s === "EXPIRED" || s === "失効") return "EXPIRED";
  return "ACTIVE";
}

export function parseInt0(v: unknown): number {
  if (v === null || v === undefined || v === "") return 0;
  if (typeof v === "number") return Math.round(v);
  const s = String(v).replace(/[¥,\s]/g, "");
  const n = parseInt(s, 10);
  return isNaN(n) ? 0 : n;
}

export function str(v: unknown): string {
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

export function strOrNull(v: unknown): string | null {
  const s = str(v);
  return s === "" ? null : s;
}

/**
 * テンプレート用のサンプルExcelを生成
 */
export function generateTemplate(): Uint8Array {
  const wb = XLSX.utils.book_new();

  // 取引先
  const clientsSheet = XLSX.utils.aoa_to_sheet([
    ["会社名", "業種", "代表住所", "代表電話", "FAX", "ウェブサイト", "備考"],
    [
      "株式会社サンプル",
      "製造業",
      "東京都千代田区...",
      "03-1234-5678",
      "03-1234-5679",
      "https://example.co.jp",
      "メモ",
    ],
  ]);
  XLSX.utils.book_append_sheet(wb, clientsSheet, "取引先");

  // 担当者
  const contactsSheet = XLSX.utils.aoa_to_sheet([
    ["会社名", "氏名", "役職", "メール", "電話", "送付区分"],
    [
      "株式会社サンプル",
      "山田 太郎",
      "営業部長",
      "yamada@example.co.jp",
      "090-1111-2222",
      "decision,contract",
    ],
    [
      "株式会社サンプル",
      "田中 花子",
      "経理担当",
      "tanaka@example.co.jp",
      "090-3333-4444",
      "invoice",
    ],
  ]);
  XLSX.utils.book_append_sheet(wb, contactsSheet, "担当者");

  // 案件
  const projectsSheet = XLSX.utils.aoa_to_sheet([
    [
      "会社名",
      "案件名",
      "契約金額",
      "契約日",
      "納品日",
      "詳細フェーズ",
      "期初予想納品月",
      "備考",
    ],
    [
      "株式会社サンプル",
      "基幹システム刷新",
      8500000,
      "2026-04-01",
      "2026-09-30",
      "kaihatsu",
      "2026-07",
      "メモ",
    ],
  ]);
  XLSX.utils.book_append_sheet(wb, projectsSheet, "案件");

  // ライセンス
  const licensesSheet = XLSX.utils.aoa_to_sheet([
    [
      "会社名",
      "サービス区分",
      "製品名",
      "プラン名",
      "月額",
      "課金周期",
      "契約開始日",
      "契約終了日",
      "次回更新日",
      "更新タイプ",
      "ステータス",
      "見積書送付月",
      "使用許諾書",
      "覚書",
      "備考",
    ],
    [
      "株式会社サンプル",
      "LICENSE",
      "CRM基本パック",
      "Pro",
      100000,
      "MONTHLY",
      "2026-04-01",
      "2027-03-31",
      "2027-03-01",
      "AUTO",
      "ACTIVE",
      "2026-03",
      "使用許諾書の保管URL等",
      "覚書本文",
      "備考",
    ],
  ]);
  XLSX.utils.book_append_sheet(wb, licensesSheet, "ライセンス");

  // 凡例シート
  const noteSheet = XLSX.utils.aoa_to_sheet([
    ["項目", "値の例"],
    ["サービス区分", "LICENSE / MAINTENANCE"],
    ["課金周期", "MONTHLY / YEARLY / ONE_TIME"],
    ["更新タイプ", "AUTO / MANUAL"],
    ["ライセンスステータス", "ACTIVE / SCHEDULED_CANCEL / CANCELLED / EXPIRED"],
    [
      "詳細フェーズ",
      "kikaku, mitsumori, ringi, ringi_saki, keiyaku, kaihatsu, ukenyu, seikyu, miunyou, kanryo, shanai, miokuri",
    ],
    ["送付区分", "quote, invoice, contract, decision（カンマ区切り）"],
    ["", ""],
    ["インポート仕様", ""],
    ["同じ会社名が既にある場合", "情報を上書き（空欄は維持）"],
    ["同じ氏名+会社名が既にある場合", "情報を上書き"],
    ["同じ案件名+会社名が既にある場合", "情報を上書き"],
    ["同じ製品名+会社名+開始日が既にある場合", "情報を上書き"],
  ]);
  XLSX.utils.book_append_sheet(wb, noteSheet, "凡例");

  const out = XLSX.write(wb, { type: "array", bookType: "xlsx" });
  return out as Uint8Array;
}
