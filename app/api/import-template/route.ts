import { generateTemplate } from "@/lib/import/excel";

export const dynamic = "force-dynamic";

export async function GET() {
  const buf = generateTemplate();
  // Buffer に変換して Response.body の型に合わせる
  return new Response(new Uint8Array(buf) as BodyInit, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="biz-cockpit-import-template.xlsx"',
    },
  });
}
