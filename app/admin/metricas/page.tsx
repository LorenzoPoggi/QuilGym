import { requireAdminUser } from "@/lib/admin-auth";
import { getMetricsData } from "@/lib/admin-metrics";
import { resolveRange } from "@/lib/admin-metrics-core";
import { MetricsDashboard } from "@/components/admin-metrics-dashboard";
import "../../styles/admin-metrics.css";

export const metadata = { title: "Métricas | Administración QuilGym" };

export default async function AdminMetricsPage({ searchParams }: { searchParams: Promise<{ p?: string; desde?: string; hasta?: string }> }) {
  await requireAdminUser();
  const range = resolveRange(await searchParams);
  return <MetricsDashboard range={range} data={await getMetricsData(range)}/>;
}
