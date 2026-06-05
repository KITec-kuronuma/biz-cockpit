import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { LicenseForm } from "@/components/contracts/LicenseForm";
import { updateLicense, deleteLicense } from "../../actions";
import Link from "next/link";

function toInputDate(d: Date | null | undefined): string {
  if (!d) return "";
  return d.toISOString().slice(0, 10);
}

export default async function EditLicensePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [license, clients, projects] = await Promise.all([
    prisma.licenseContract.findUnique({ where: { id } }),
    prisma.client.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.project.findMany({
      orderBy: { title: "asc" },
      select: { id: true, title: true, clientId: true },
    }),
  ]);
  if (!license) return notFound();

  const initial = {
    clientId: license.clientId,
    projectId: license.projectId,
    productName: license.productName,
    planName: license.planName,
    initialMonthlyAmount: license.initialMonthlyAmount,
    monthlyAmount: license.monthlyAmount,
    billingCycle: license.billingCycle,
    startDate: toInputDate(license.startDate),
    endDate: toInputDate(license.endDate),
    nextRenewalDate: toInputDate(license.nextRenewalDate),
    renewalType: license.renewalType,
    status: license.status,
    note: license.note,
  };

  const bound = updateLicense.bind(null, id);

  return (
    <div className="p-6 max-w-4xl">
      <Link
        href="/contracts"
        className="text-xs text-blue-600 hover:underline mb-3 inline-block"
      >
        ← ライセンス契約一覧に戻る
      </Link>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-xl font-bold">ライセンス契約 編集</h1>
        <form action={deleteLicense.bind(null, id)}>
          <button
            type="submit"
            className="px-4 py-2 bg-red-50 text-red-600 border border-red-200 rounded-lg text-sm hover:bg-red-100"
          >
            🗑 削除
          </button>
        </form>
      </div>
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <LicenseForm
          clients={clients}
          projects={projects}
          initial={initial}
          action={bound}
          submitLabel="更新する"
        />
      </div>
    </div>
  );
}
