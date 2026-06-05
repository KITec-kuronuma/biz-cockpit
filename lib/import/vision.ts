// 画像から取引先・担当者情報を構造化抽出（Anthropic Claude Vision）

import Anthropic from "@anthropic-ai/sdk";

export interface ExtractedContact {
  name: string;
  role?: string;
  email?: string;
  phone?: string;
  department?: string;
  sendFlags?: string[]; // quote, invoice, contract, decision
  note?: string;
}

export interface ExtractedClient {
  name?: string;
  address?: string;
  phone?: string;
  fax?: string;
  website?: string;
  industry?: string;
}

export interface ExtractionResult {
  client: ExtractedClient;
  contacts: ExtractedContact[];
  rawText?: string;
}

const SYSTEM_PROMPT = `あなたは画像から取引先（会社）と担当者の連絡先情報を抽出する専門家です。
名刺・メール署名・会社案内・担当者リスト・組織図など、どんな画像からも情報を抽出します。

JSONで以下の構造で返してください：
{
  "client": {
    "name": "会社名（あれば）",
    "address": "代表住所（あれば）",
    "phone": "代表電話番号（あれば）",
    "fax": "FAX番号（あれば）",
    "website": "ウェブサイトURL（あれば）",
    "industry": "業種（推測できれば）"
  },
  "contacts": [
    {
      "name": "氏名（漢字・カナ姓名）",
      "role": "役職（例：部長・課長）",
      "department": "部署",
      "email": "メールアドレス",
      "phone": "電話番号",
      "sendFlags": ["decision"],
      "note": "備考"
    }
  ]
}

sendFlags の判定基準：
- decision: 部長以上の役職、決裁権限がある肩書き、「代表」「責任者」を含む場合
- invoice: 経理・会計部署
- contract: 法務・契約管理部署、役員クラス
- quote: 営業窓口、担当者

不明な項目は省略してください。複数人が映っている場合は配列で複数返してください。
情報が読み取れない部分は null や省略でOK、推測しすぎないでください。
日本語で返してください。`;

export async function extractFromImage(
  imageBase64: string,
  mediaType: string,
  hint?: string
): Promise<ExtractionResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY が設定されていません。Vercelの環境変数に設定してください。"
    );
  }

  const client = new Anthropic({ apiKey });

  const userText = hint
    ? `この画像から取引先と担当者の情報を抽出してください。\n\nヒント: ${hint}`
    : "この画像から取引先と担当者の情報を抽出してください。";

  const response = await client.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: mediaType as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
              data: imageBase64,
            },
          },
          {
            type: "text",
            text: userText,
          },
        ],
      },
    ],
  });

  // 応答からJSON部分を抽出
  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("抽出結果のテキストが取得できませんでした");
  }
  const text = textBlock.text;
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("JSON形式の応答が得られませんでした\n" + text);
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]) as ExtractionResult;
    return {
      client: parsed.client ?? {},
      contacts: parsed.contacts ?? [],
      rawText: text,
    };
  } catch (e) {
    throw new Error(
      "JSONパース失敗：" + (e instanceof Error ? e.message : String(e))
    );
  }
}

/**
 * 既存取引先と抽出結果を社名で簡易マッチング
 */
export function matchExistingClient(
  extracted: ExtractedClient,
  existingClients: { id: string; name: string }[]
): string | null {
  if (!extracted.name) return null;
  const target = extracted.name.replace(/\s+/g, "");
  // 完全一致
  for (const c of existingClients) {
    if (c.name.replace(/\s+/g, "") === target) return c.id;
  }
  // 株式会社等の接頭辞を除いた比較
  const normalize = (s: string) =>
    s.replace(/^(株式会社|有限会社|合同会社|合資会社|合名会社)/, "")
      .replace(/(株式会社|有限会社|合同会社|合資会社|合名会社)$/, "")
      .replace(/\s+/g, "")
      .trim();
  const targetNorm = normalize(target);
  for (const c of existingClients) {
    if (normalize(c.name) === targetNorm) return c.id;
  }
  return null;
}
