import { redirect } from "next/navigation";
import { ManageShell } from "@/components/manage-shell";
import { currentManageSession } from "@/lib/manage-auth";

// Temporary preview to verify the faithful Path A gestionale chrome.
export default async function ShellPreviewPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  const session = await currentManageSession(tenantSlug);
  if (!session) redirect(`/manage/login?slug=${encodeURIComponent(tenantSlug)}`);

  return (
    <ManageShell slug={tenantSlug} userName={session.user.name} currentPage="dashboard">
      <div className="page-head d-flex align-items-center justify-content-between mb-3">
        <div>
          <h1 className="h4 mb-1">Dashboard</h1>
          <p className="text-muted mb-0">Anteprima shell Path A (chrome fedele).</p>
        </div>
      </div>
      <div className="row g-3">
        <div className="col-12 col-md-4"><div className="card"><div className="card-body"><div className="text-muted small">Incasso oggi</div><div className="h4 mb-0">€ 0,00</div></div></div></div>
        <div className="col-12 col-md-4"><div className="card"><div className="card-body"><div className="text-muted small">Appuntamenti</div><div className="h4 mb-0">0</div></div></div></div>
        <div className="col-12 col-md-4"><div className="card"><div className="card-body"><div className="text-muted small">Clienti</div><div className="h4 mb-0">0</div></div></div></div>
      </div>
    </ManageShell>
  );
}
