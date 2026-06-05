import { prisma } from "@/lib/prisma";
import { LicenseForm } from "@/components/contracts/LicenseForm";
import { createLicense } from "../actions";
import Link from "next/link";

export default async function NewLicensePage() {
  const [clients, projects] = await Promise.all([
    prisma.client.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.project.findMany({
      orderBy: { title: "asc" },
      select: { id: true, title: true, clientId: true },
    }),
  ]);

  return (
    <div className="p-6 max-w-4xl">
      <Link
        href="/contracts"
        className="text-xs text-blue-600 hover:underline mb-3 inline-block"
      >
        ← ライセンス契約一覧に戻る
      </Link>
      <h1 className="text-xl font-bold mb-6">ライセンス契約 新規登録</h1>
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <LicenseForm clients={clients} projects={projects} action={createLicense} submitLabel="登録する" />
      </div>
    </div>
  );
}
