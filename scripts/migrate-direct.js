// Direct DB migration script
require("dotenv/config");
const { Client } = require("pg");

function parseDbUrl(rawUrl) {
  const url = new URL(rawUrl);
  return {
    host: url.hostname,
    port: parseInt(url.port, 10),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.replace(/^\//, ""),
    ssl: { rejectUnauthorized: false },
  };
}

// DATABASE_URL (port 6543) で接続テスト
const raw = process.env.DATABASE_URL;
if (!raw) { console.error("❌ DATABASE_URL が未設定"); process.exit(1); }

console.log("接続先:", raw.replace(/:([^:@]+)@/, ":***@"));
const config = parseDbUrl(raw);
console.log("user:", config.user, "| port:", config.port);

const client = new Client(config);

async function run() {
  await client.connect();
  console.log("✅ DB接続成功\n");

  const { rows } = await client.query(`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_name = 'Project'
    ORDER BY ordinal_position
  `);
  console.log("【Projectテーブルのカラム】");
  rows.forEach((r) => console.log(` - ${r.column_name} (${r.data_type})`));

  const stmts = [
    `ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "projectNo" INTEGER`,
    `ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "occurredAt" TIMESTAMP(3)`,
    `ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "quotedAt" TIMESTAMP(3)`,
    `ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "undatedForecast" INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "forecastTiming" TEXT NOT NULL DEFAULT 'UNDECIDED'`,
    `ALTER TABLE "Project" ALTER COLUMN "projectNo" TYPE INTEGER USING "projectNo"::INTEGER`,
  ];

  console.log("\n【DDL実行】");
  for (const sql of stmts) {
    try {
      await client.query(sql);
      console.log(`✅ ${sql.split(" ").slice(0, 6).join(" ")}`);
    } catch (e) {
      console.log(`⚠️  ${sql.split(" ").slice(0, 6).join(" ")} → ${e.message.slice(0, 100)}`);
    }
  }

  await client.end();
  console.log("\n完了");
}

run().catch((e) => { console.error("❌", e.message); process.exit(1); });
