import { MainLayout } from "@/components/layout/MainLayout";
import { PageHeader } from "@/components/PageHeader";
import { DashboardContent } from "@/components/dashboard/DashboardContent";

export default function Dashboard() {
  return (
    <MainLayout>
      <div className="space-y-6">
        <PageHeader
          title="Dashboard"
          subtitle="Vue d’ensemble des flux + KPIs (local + Supabase)."
        />
        <DashboardContent embedded={false} />
      </div>
    </MainLayout>
  );
}
