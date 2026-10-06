import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { readFileSync } from "fs";
import { resolve } from "path";

// .env 読み込み
const envPath = resolve(process.cwd(), ".env");
const env = Object.fromEntries(
  readFileSync(envPath, "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => {
      const idx = l.indexOf("=");
      return [l.slice(0, idx).trim(), l.slice(idx + 1).trim().replace(/^"|"$/g, "")];
    })
);

const DATABASE_URL = env.DATABASE_URL;
const adapter = new PrismaPg({ connectionString: DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const invoices = await prisma.invoice.findMany({
    where: {
      invoiceDate: {
        gte: new Date("2026-06-01T00:00:00Z"),
        lt: new Date("2026-07-01T00:00:00Z"),
      },
    },
    include: {
      project: { include: { client: true } },
      payments: true,
    },
    orderBy: { invoiceDate: "asc" },
  });

  const total = invoices.reduce((s, inv) => s + inv.amount, 0);

  console.log("\n=== biz-cockpit 6月 請求一覧 ===");
  console.log(`件数: ${invoices.length}件 / 合計: ¥${total.toLocaleString()}\n`);

  for (const inv of invoices) {
    const paid = inv.payments.reduce((s, p) => s + p.amount, 0);
    console.log(
      `[${inv.invoiceDate.toISOString().slice(0, 10)}] ${inv.project.client.name.padEnd(20)} / ${inv.project.title.slice(0, 30).padEnd(30)} / ¥${inv.amount.toLocaleString().padStart(10)} / ${inv.status}`
    );
  }
  console.log(`\n合計 (税抜): ¥${total.toLocaleString()}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
