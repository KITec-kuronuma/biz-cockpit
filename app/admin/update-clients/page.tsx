import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

const CLIENT_DATA: { name: string; website: string | null; address: string | null }[] = [
  { name: "TOPPAN株式会社", website: "https://www.toppan.com", address: "〒110-8560 東京都台東区台東1丁目5番1号" },
  { name: "YKK AP株式会社", website: "https://www.ykkap.co.jp", address: "〒101-0024 東京都千代田区神田和泉町1番地" },
  { name: "アイディホーム株式会社", website: "https://idhome.co.jp", address: "〒167-0043 東京都杉並区上荻1丁目2番1号 Daiwa荻窪タワー18F" },
  { name: "タクトホーム株式会社", website: "https://www.tacthome.co.jp", address: "〒202-0021 東京都西東京市東伏見3丁目6番19号" },
  { name: "トクラス株式会社", website: "https://www.toclas.co.jp", address: "〒432-8001 静岡県浜松市中央区西山町1370番地" },
  { name: "フクビ化学工業株式会社", website: "https://www.fukuvi.co.jp", address: "〒918-8585 福井県福井市三十八社町33字66番地" },
  { name: "三協立山株式会社", website: "https://www.st-grp.co.jp", address: "〒933-8610 富山県高岡市早川70番地" },
  { name: "四国化成建材株式会社", website: "https://kenzai.shikoku.co.jp", address: "〒763-8504 香川県丸亀市土器町東8丁目537番地1" },
  { name: "旭化成ホームズ", website: "https://www.asahi-kasei.co.jp/hebel/", address: "〒101-8101 東京都千代田区神田神保町1丁目105番地 神保町三井ビルディング" },
  { name: "旭化成ホームズコンストラクション株式会社", website: "https://www.asahi-kasei.co.jp/j-koho/", address: "〒101-8101 東京都千代田区神田神保町1丁目105番地 神保町三井ビルディング" },
  { name: "旭興進株式会社", website: "https://www.aksk.jp", address: "〒260-0013 千葉県千葉市中央区中央1丁目11番1号 千葉中央ツインビル1号館8F" },
  { name: "東建コーポレーション株式会社", website: "https://www.token.co.jp", address: "〒460-0002 愛知県名古屋市中区丸の内2丁目1番33号 東建本社丸の内ビル" },
  { name: "株式会社F&F", website: "https://www.fftokyo.com", address: "〒198-0023 東京都青梅市今井3丁目4番19号" },
  { name: "株式会社KOMOJU", website: "https://ja.komoju.com", address: "〒180-0004 東京都武蔵野市吉祥寺本町1丁目14番9号 プレファス吉祥寺フロント9F" },
  { name: "株式会社LIXIL", website: "https://www.lixil.com/jp/", address: "〒141-0033 東京都品川区西品川1丁目1番1号 大崎ガーデンタワー" },
  { name: "株式会社エクスタイル", website: "https://www.extile.co.jp", address: "〒919-0321 福井県福井市下河北町11-8-1" },
  { name: "株式会社コンピューターシステム研究所（CST）", website: "https://www.cst-web.co.jp", address: "〒963-0108 福島県郡山市笹川1丁目100番1号" },
  { name: "株式会社サンゲツ", website: "https://www.sangetsu.co.jp", address: "〒451-8575 愛知県名古屋市西区幅下1丁目4番1号" },
  { name: "株式会社タカショー", website: "https://takasho.co.jp", address: "〒642-0017 和歌山県海南市南赤坂20番1号" },
  { name: "株式会社ビジュアルリサーチ", website: "https://www.visualresearch.jp", address: "〒107-6123 東京都港区赤坂5丁目2番20号 赤坂パークビル23F" },
  { name: "株式会社プロトソリューション", website: "https://www.protosolution.co.jp", address: "〒901-2223 沖縄県宜野湾市大山7丁目10番25号 プロト宜野湾ビル" },
  { name: "株式会社ユニマットライフ", website: "https://www.unimat-life.co.jp", address: "〒107-0062 東京都港区南青山2丁目12番14号 ユニマット青山ビル" },
  { name: "株式会社ユニマットリック", website: "https://www.rikcorp.jp", address: "〒107-0062 東京都港区南青山2丁目13番10号 ユニマットアネックスビル5F" },
  { name: "株式会社ヨドコウ", website: "https://www.yodoko.co.jp", address: "〒541-0054 大阪府大阪市中央区南本町4丁目1番1号" },
  { name: "株式会社東栄住宅", website: "https://www.touei.co.jp", address: "〒188-0014 東京都西東京市芝久保町4丁目26番3号" },
  { name: "積水樹脂株式会社", website: "https://www.sekisuijushi.co.jp", address: "〒530-8565 大阪府大阪市北区西天満2丁目4番4号" },
  { name: "飯田グループ", website: "https://www.ighd.co.jp", address: "〒180-0013 東京都武蔵野市西久保1丁目2番11号" },
];

async function runUpdate() {
  "use server";
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  for (const c of CLIENT_DATA) {
    await prisma.client.updateMany({
      where: { name: c.name },
      data: { website: c.website, address: c.address },
    });
  }
}

export default async function UpdateClientsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <div className="max-w-2xl mx-auto p-8">
      <h1 className="text-2xl font-bold mb-4">取引先 住所・Website 一括更新</h1>
      <p className="text-slate-600 mb-6">
        27社分の住所・WebサイトURLをデータベースに書き込みます。
        実行後このページは削除してください。
      </p>
      <form action={runUpdate}>
        <button
          type="submit"
          className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700"
        >
          更新実行
        </button>
      </form>
    </div>
  );
}
