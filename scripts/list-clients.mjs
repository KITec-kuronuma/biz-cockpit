import { readFileSync } from "fs";
import { resolve } from "path";
import pg from "pg";

const { Client } = pg;

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

// SESSION_POOLER (MIGRATION_URL) を使用。preparedStatement不要のため互換性が高い
const connectionString = env.MIGRATION_URL || env.DATABASE_URL;

const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });

await client.connect();

const { rows } = await client.query(
  `SELECT id, name, address, phone, fax, website, industry, note FROM "Client" ORDER BY name`
);

console.log(JSON.stringify(rows, null, 2));

await client.end();
