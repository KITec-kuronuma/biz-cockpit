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
 */
export function parseExcelDate(v: unknown): Date | null {
  if (!v) return null;
  if (v instanceof Date) return v;
  if (typeof v === "number") {
    // Excelシリアル値（1900-01-01からの日数）
    const d = XLSX.SSF.parse_date_code(v);
    if (!d) return null;
    return new Date(Date.UTC(d.y, d.m - 1, d.d));
  }
  if (typeof v === "string") {
    const s = v.trim();
    if (!s) return null;
    // YYYY-MM-DD / YYYY/MM/DD / YYYY/M/D 等
    const match = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
    if (match) {
      return new Date(
        Date.UTC(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]))
      );
    }
    // 日付として解釈試みる
    const d = new Date(s);
    if (!isNaN(d.getTime())) return d;
  }
  return null;
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
