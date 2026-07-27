import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

const CONTACTS_TO_ADD = [
  // ===== フクビ化学工業株式会社 =====
  {
    clientName: "フクビ化学工業株式会社",
    name: "田島 裕敬",
    role: "理事 / 建材事業本部 建材管理統括部長",
    email: "h.tajima@fukuvi.co.jp",
    phone: "090-2152-1045",
  },
  {
    clientName: "フクビ化学工業株式会社",
    name: "滝尾 太志",
    role: "建材事業本部 建材管理統括部 企画管理部 マネージャー",
    email: "f.takio@fukuvi.co.jp",
    phone: "0776-38-8011",
  },
  {
    clientName: "フクビ化学工業株式会社",
    name: "佐藤 康将",
    role: "建材事業本部 建材管理統括部 企画管理部 主任",
    email: "y-satou@fukuvi.co.jp",
    phone: "0776-38-8011",
  },
  // ===== 株式会社東栄住宅 =====
  {
    clientName: "株式会社東栄住宅",
    name: "爲政 淳也",
    role: "生産本部 生産管理部 購買課 課長",
    email: "j-tamemasa@touei.co.jp",
    phone: "080-4630-1609",
  },
  {
    clientName: "株式会社東栄住宅",
    name: "中川 道",
    role: "生産本部 生産管理部 生産業務推進課 課長",
    email: "m-satsuka@touei.co.jp",
    phone: "080-4124-8412",
  },
  {
    clientName: "株式会社東栄住宅",
    name: "吉村 彰浩",
    role: "リスクマネジメント室法務課 課長 / 関連事業部 アドバイザー",
    email: "akihiro-yoshimura@touei.co.jp",
    phone: "042-463-8288",
  },
  {
    clientName: "株式会社東栄住宅",
    name: "田中 昌平",
    role: "リスクマネジメント室 法務課 主任",
    email: "shohei-tanaka@touei.co.jp",
    phone: null,
  },
  {
    clientName: "株式会社東栄住宅",
    name: "本多 達也",
    role: "常務取締役 管理本部長 アセットマネジメント室長",
    email: "t-honda@touei.co.jp",
    phone: "042-463-0220",
  },
  {
    clientName: "株式会社東栄住宅",
    name: "髙野 慎太郎",
    role: "常務取締役 執行役員 戸建事業本部長 くらし創造デザイン室長",
    email: "s-takano@touei.co.jp",
    phone: "090-4826-5595",
  },
  {
    clientName: "株式会社東栄住宅",
    name: "大沼 豪一",
    role: "戸建事業本部 執行役員 副本部長",
    email: "g-ohnuma@touei.co.jp",
    phone: "090-3505-9534",
  },
  {
    clientName: "株式会社東栄住宅",
    name: "今野 晃子",
    role: "管理本部 主計部 部長 兼 主計課長 兼 会計課長 兼 関連事業部 アドバイザー",
    email: "akiko@touei.co.jp",
    phone: "070-1450-9719",
  },
];

async function runAdd() {
  "use server";
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const clients = await prisma.client.findMany({ select: { id: true, name: true } });
  const clientMap = Object.fromEntries(clients.map((c) => [c.name, c.id]));

  let added = 0;
  let skipped = 0;

  for (const c of CONTACTS_TO_ADD) {
    const clientId = clientMap[c.clientName];
    if (!clientId) { skipped++; continue; }

    // 同じメールアドレスの担当者が既に存在する場合はスキップ
    if (c.email) {
      const existing = await prisma.contact.findFirst({
        where: { clientId, email: c.email },
      });
      if (existing) { skipped++; continue; }
    }

    await prisma.contact.create({
      data: {
        clientId,
        name: c.name,
        role: c.role ?? null,
        email: c.email ?? null,
        phone: c.phone ?? null,
      },
    });
    added++;
  }

  revalidatePath("/clients");
  redirect(`/clients?added=${added}&skipped=${skipped}`);
}

export default async function AddContactsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <div className="max-w-2xl mx-auto p-8">
      <h1 className="text-2xl font-bold mb-4">名刺担当者 一括追加</h1>
      <p className="text-slate-600 mb-4">
        フクビ化学工業（3名）・株式会社東栄住宅（8名）を担当者として登録します。
        同じメールアドレスが既に登録済みの場合はスキップします。
      </p>
      <table className="w-full text-sm mb-6 border border-slate-200 rounded">
        <thead className="bg-slate-100">
          <tr>
            <th className="px-3 py-2 text-left">取引先</th>
            <th className="px-3 text-left">氏名</th>
            <th className="px-3 text-left">役職</th>
          </tr>
        </thead>
        <tbody>
          {CONTACTS_TO_ADD.map((c, i) => (
            <tr key={i} className="border-t border-slate-100">
              <td className="px-3 py-1.5 text-slate-600 text-xs">{c.clientName}</td>
              <td className="px-3 font-medium">{c.name}</td>
              <td className="px-3 text-xs text-slate-600">{c.role}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <form action={runAdd}>
        <button
          type="submit"
          className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700"
        >
          担当者を追加する（11名）
        </button>
      </form>
    </div>
  );
}
