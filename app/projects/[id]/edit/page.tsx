import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { ProjectForm } from "@/components/projects/ProjectForm";
import { updateProject, deleteProject } from "../../actions";
import { DeleteProjectButton } from "@/components/projects/DeleteProjectButton";
import Link from "next/link";

function toInputDate(d: Date | null | undefined): string {
  if (!d) return "";
  return d.toISOString().slice(0, 10);
}

export default async function EditProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [project, clients] = await Promise.all([
    prisma.project.findUnique({ where: { id } }),
    prisma.client.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  if (!project) return notFound();

  const initial = {
    clientId: project.clientId,
    title: project.title,
    contractDate: toInputDate(project.contractDate),
    deliveryDate: toInputDate(project.deliveryDate),
    contractAmount: project.contractAmount,
    taxRate: project.taxRate,
    licenseFee: project.licenseFee,
    licenseStartDate: toInputDate(project.licenseStartDate),
    licenseCycle: project.licenseCycle,
    detailPhase: project.detailPhase,
    initialForecast: project.initialForecast,
    note: project.note,
  };

  const boundUpdate = updateProject.bind(null, id);

  return (
    <div className="p-6 max-w-4xl">
      <Link
        href={`/projects/${id}`}
        className="text-xs text-blue-600 hover:underline mb-3 inline-block"
      >
        ← 案件詳細に戻る
      </Link>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-xl font-bold">案件 編集</h1>
        <DeleteProjectButton action={deleteProject.bind(null, id)} />
      </div>
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <ProjectForm clients={clients} initial={initial} action={boundUpdate} submitLabel="更新する" />
      </div>
    </div>
  );
}
