import { PrismaClient } from "@prisma/client";
import "dotenv/config";

function createPrisma() {
  const url = process.env.DATABASE_URL ?? "";
  if (url.startsWith("postgres://") || url.startsWith("postgresql://")) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { PrismaPg } = require("@prisma/adapter-pg");
    const adapter = new PrismaPg({ connectionString: url });
    return new PrismaClient({ adapter });
  }
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { PrismaBetterSqlite3 } = require("@prisma/adapter-better-sqlite3");
  const adapter = new PrismaBetterSqlite3({ url: url || "file:./dev.db" });
  return new PrismaClient({ adapter });
}

const prisma = createPrisma();

function d(s: string) {
  return new Date(s + "T00:00:00Z");
}

async function main() {
  // 既存データクリア
  await prisma.activity.deleteMany();
  await prisma.projectContact.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.costMonthly.deleteMany();
  await prisma.project.deleteMany();
  await prisma.contact.deleteMany();
  await prisma.client.deleteMany();
  await prisma.user.deleteMany();
  await prisma.setting.deleteMany();

  // 設定
  await prisma.setting.create({
    data: {
      id: "singleton",
      fiscalStartMonth: 4,
      targetContractAmount: 100_000_000,
      targetContractCount: 5,
      defaultRevenueBasis: "DELIVERY",
      annualBudgetRevenue: 120_000_000,
      taxRate: 10,
    },
  });

  // ユーザー
  await prisma.user.createMany({
    data: [
      { name: "田中 一郎", email: "tanaka@example.co.jp", department: "営業部", role: "ADMIN" },
      { name: "佐藤 花子", email: "sato@example.co.jp", department: "営業部", role: "MANAGER" },
      { name: "鈴木 太郎", email: "suzuki@example.co.jp", department: "開発部", role: "MANAGER" },
      { name: "高橋 健一", email: "takahashi@example.co.jp", department: "開発部", role: "MEMBER" },
    ],
  });

  // 取引先
  const yamada = await prisma.client.create({
    data: {
      name: "株式会社山田商事",
      note: "製造業 / 1,200名",
      contacts: {
        create: [
          { name: "山田 太郎", role: "情報システム部 部長", email: "yamada@yamada.co.jp", phone: "090-1111-2222", sendFlags: "decision,contract" },
          { name: "田辺 美咲", role: "情報システム部 課長", email: "tanabe@yamada.co.jp", phone: "090-2222-3333", sendFlags: "quote,invoice" },
          { name: "加藤 健一", role: "経営企画部 主任", email: "kato@yamada.co.jp", phone: "090-3333-4444" },
        ],
      },
    },
  });

  const abc = await prisma.client.create({
    data: {
      name: "ABC株式会社",
      note: "小売業",
      contacts: {
        create: [
          { name: "鈴木 恵子", role: "DX推進部 課長", email: "suzuki@abc.co.jp", phone: "090-5555-6666", sendFlags: "decision,quote,contract" },
          { name: "井上 健司", role: "経理部 部長", email: "inoue@abc.co.jp", phone: "090-6666-7777", sendFlags: "invoice" },
        ],
      },
    },
  });

  const gl = await prisma.client.create({
    data: {
      name: "グローバル物流株式会社",
      note: "物流",
      contacts: {
        create: [
          { name: "中村 一平", role: "物流企画部 部長", email: "nakamura@gl.co.jp", phone: "090-7777-8888", sendFlags: "decision,quote,invoice,contract" },
        ],
      },
    },
  });

  const tech = await prisma.client.create({
    data: {
      name: "テック工業株式会社",
      note: "製造業",
      contacts: {
        create: [
          { name: "伊藤 祐介", role: "生産管理部 主任", email: "ito@tech.co.jp", phone: "090-9999-0000" },
        ],
      },
    },
  });

  // 案件1：基幹システム刷新（受注・進行中・複数請求）
  const p1 = await prisma.project.create({
    data: {
      clientId: yamada.id,
      title: "基幹システム刷新",
      contractDate: d("2026-04-01"),
      deliveryDate: d("2026-09-30"),
      contractAmount: 8_500_000,
      status: "WON",
      progress: "IN_PROGRESS",
      detailPhase: "kaihatsu",
      initialForecast: "2026-07",
      invoices: {
        create: [
          { invoiceDate: d("2026-05-10"), amount: 1_500_000, dueDate: d("2026-06-10"), status: "PAID", payments: { create: [{ paymentDate: d("2026-06-08"), amount: 1_500_000 }] } },
          { invoiceDate: d("2026-07-10"), amount: 2_500_000, dueDate: d("2026-08-10"), status: "ISSUED" },
        ],
      },
      costs: {
        create: [
          { yearMonth: "2026-04", amount: 800_000, category: "人件費" },
          { yearMonth: "2026-05", amount: 1_200_000, category: "人件費" },
          { yearMonth: "2026-06", amount: 1_000_000, category: "人件費" },
        ],
      },
    },
  });

  // 案件2：EC サイト構築（受注・開発中）
  const p2 = await prisma.project.create({
    data: {
      clientId: abc.id,
      title: "EC サイト構築",
      contractDate: d("2026-05-01"),
      deliveryDate: d("2026-08-31"),
      contractAmount: 4_200_000,
      status: "WON",
      progress: "IN_PROGRESS",
      detailPhase: "kaihatsu",
      initialForecast: "2026-09",
      invoices: {
        create: [
          { invoiceDate: d("2026-09-05"), amount: 2_000_000, dueDate: d("2026-10-05"), status: "NOT_ISSUED" },
        ],
      },
      costs: {
        create: [
          { yearMonth: "2026-05", amount: 500_000, category: "人件費" },
          { yearMonth: "2026-06", amount: 800_000, category: "人件費" },
        ],
      },
    },
  });

  // 案件3：物流管理 Phase2（受注・請求遅延）
  await prisma.project.create({
    data: {
      clientId: gl.id,
      title: "物流管理 Phase2",
      contractDate: d("2026-03-15"),
      deliveryDate: d("2026-04-28"),
      contractAmount: 2_400_000,
      status: "WON",
      progress: "DELIVERED",
      detailPhase: "seikyu",
      initialForecast: "2026-06",
      invoices: {
        create: [
          { invoiceDate: d("2026-05-09"), amount: 2_400_000, dueDate: d("2026-05-09"), status: "ISSUED" },
        ],
      },
      costs: {
        create: [{ yearMonth: "2026-03", amount: 600_000, category: "人件費" }],
      },
    },
  });

  // 案件4：人事システム（完了）
  await prisma.project.create({
    data: {
      clientId: gl.id,
      title: "物流管理システム",
      contractDate: d("2025-10-01"),
      deliveryDate: d("2026-03-31"),
      contractAmount: 6_000_000,
      status: "WON",
      progress: "COMPLETED",
      detailPhase: "kanryo",
      licenseFee: 500_000,
      licenseStartDate: d("2026-04-01"),
      licenseCycle: "MONTHLY",
      invoices: {
        create: [
          { invoiceDate: d("2026-04-01"), amount: 6_000_000, dueDate: d("2026-05-01"), status: "PAID", payments: { create: [{ paymentDate: d("2026-04-28"), amount: 6_000_000 }] } },
        ],
      },
      costs: {
        create: [
          { yearMonth: "2025-10", amount: 800_000, category: "人件費" },
          { yearMonth: "2025-11", amount: 1_200_000, category: "人件費" },
        ],
      },
    },
  });

  // 案件5：在庫管理（商談中）
  await prisma.project.create({
    data: {
      clientId: tech.id,
      title: "在庫管理システム導入",
      contractAmount: 3_200_000,
      status: "NEGOTIATING",
      progress: "NOT_STARTED",
      detailPhase: "mitsumori",
    },
  });

  // 案件6：失注
  await prisma.project.create({
    data: {
      clientId: tech.id,
      title: "ECサイト構築（旧）",
      contractAmount: 5_000_000,
      status: "LOST",
      progress: "NOT_STARTED",
      detailPhase: "miokuri",
      note: "予算未達のため失注",
    },
  });

  // 活動履歴
  await prisma.activity.createMany({
    data: [
      { date: d("2026-05-19"), type: "CALL", clientId: yamada.id, projectId: p1.id, content: "進捗確認、稟議の状況ヒアリング", nextAction: "5/26 定例打ち合わせ", nextDate: d("2026-05-26") },
      { date: d("2026-05-19"), type: "EMAIL", clientId: abc.id, projectId: p2.id, content: "追加要件への対応見積を送付", nextAction: "5/22 返答確認", nextDate: d("2026-05-22") },
      { date: d("2026-05-18"), type: "VISIT", clientId: tech.id, content: "初回訪問、要件ヒアリング", nextAction: "5/25 提案書送付", nextDate: d("2026-05-25") },
      { date: d("2026-05-17"), type: "ONLINE", clientId: gl.id, content: "契約条件の最終確認", nextAction: "5/24 契約書送付", nextDate: d("2026-05-24") },
    ],
  });

  console.log("✅ Seed completed");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
