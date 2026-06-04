import { prisma } from "@/lib/prisma";
import { ProjectForm } from "@/components/projects/ProjectForm";
import { createProject } from "../actions";
import Link from "next/link";

export default async function NewProjectPage() {
  const clients = await prisma.client.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  return (
    <div className="p-6 max-w-4xl">
      <Link href="/projects" className="text-xs text-blue-600 hover:underline mb-3 inline-block">
        ← 案件一覧に戻る
      </Link>
      <h1 className="text-xl font-bold mb-6">案件 新規登録</h1>
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <ProjectForm clients={clients} action={createProject} submitLabel="登録する" />
      </div>
    </div>
  );
}
