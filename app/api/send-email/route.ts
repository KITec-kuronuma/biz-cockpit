import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";

export interface SendEmailRequest {
  recipients: { name: string; email: string }[];
  subject: string;
  body: string; // プレーンテキスト or HTML
  useHtml?: boolean;
}

export interface SendEmailResult {
  email: string;
  name: string;
  ok: boolean;
  error?: string;
}

export async function POST(req: NextRequest) {
  const { recipients, subject, body, useHtml } = (await req.json()) as SendEmailRequest;

  if (!recipients?.length || !subject || !body) {
    return NextResponse.json({ error: "必須項目が不足しています" }, { status: 400 });
  }

  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;

  if (!smtpUser || !smtpPass) {
    return NextResponse.json(
      { error: "SMTP 設定が未構成です。管理者に SMTP_USER / SMTP_PASS の設定を依頼してください。" },
      { status: 500 }
    );
  }

  const transporter = nodemailer.createTransport({
    host: "smtp.office365.com",
    port: 587,
    secure: false,
    auth: { user: smtpUser, pass: smtpPass },
    tls: { ciphers: "SSLv3" },
  });

  const results: SendEmailResult[] = [];

  for (const { name, email } of recipients) {
    // 本文中の {{氏名}} を実際の名前に置換
    const personalizedBody = body.replace(/\{\{氏名\}\}/g, name);
    const personalizedSubject = subject.replace(/\{\{氏名\}\}/g, name);

    try {
      await transporter.sendMail({
        from: `"${process.env.SMTP_FROM_NAME ?? "biz-cockpit"}" <${smtpUser}>`,
        to: email,
        subject: personalizedSubject,
        ...(useHtml ? { html: personalizedBody } : { text: personalizedBody }),
      });
      results.push({ email, name, ok: true });
    } catch (e) {
      results.push({ email, name, ok: false, error: String(e) });
    }
  }

  return NextResponse.json({ results });
}
