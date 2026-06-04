// 列挙値ラベル（上長仕様 v1.0 準拠）

export const STATUS_LABELS: Record<string, string> = {
  LEAD: "見込",
  NEGOTIATING: "商談中",
  WON: "受注",
  LOST: "失注",
  ON_HOLD: "保留",
};

export const PROGRESS_LABELS: Record<string, string> = {
  NOT_STARTED: "未着手",
  IN_PROGRESS: "進行中",
  DELIVERED: "納品済",
  COMPLETED: "完了",
};

export const INVOICE_STATUS_LABELS: Record<string, string> = {
  NOT_ISSUED: "未請求",
  ISSUED: "請求済",
  PAID: "入金済",
};

export const LICENSE_CYCLE_LABELS: Record<string, string> = {
  MONTHLY: "月額",
  YEARLY: "年額",
  ONE_TIME: "一括",
};

export const REVENUE_BASIS_LABELS: Record<string, string> = {
  DELIVERY: "納品日基準",
  INVOICE: "請求日基準",
  CONTRACT: "契約日基準",
};

export const ROLE_LABELS: Record<string, string> = {
  ADMIN: "管理者",
  MANAGER: "マネージャー",
  MEMBER: "一般メンバー",
};

export const ACTIVITY_TYPE_LABELS: Record<string, string> = {
  CALL: "📞 電話",
  EMAIL: "✉️ メール",
  VISIT: "🤝 訪問",
  ONLINE: "💻 オンライン",
};

// 補助：12段階詳細フェーズ（営業現場用）
export const DETAIL_PHASE_LABELS: Record<string, string> = {
  kikaku: "企画中",
  mitsumori: "見積準備",
  ringi: "稟議中",
  ringi_saki: "稟議中(先行)",
  keiyaku: "契約手続中",
  kaihatsu: "開発中",
  ukenyu: "受入検証",
  seikyu: "請求中",
  miunyou: "未運用",
  kanryo: "完了",
  shanai: "社内",
  miokuri: "見送り",
};

// 担当者の送付区分タグ
export const SEND_FLAG_LABELS: Record<string, string> = {
  quote: "見積",
  invoice: "請求書",
  contract: "契約書",
  decision: "意思決定",
};
