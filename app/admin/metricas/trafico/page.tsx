import { requireAdminUser } from "@/lib/admin-auth";
import { getTrafficData } from "@/lib/admin-traffic";
import { resolveTrafficRange } from "@/lib/admin-traffic-core";
import { TrafficDashboard } from "@/components/admin-traffic-dashboard";
import "../../../styles/admin-metrics.css";

export const metadata = { title: "Tráfico | Administración QuilGym" };

export default async function AdminTrafficPage({ searchParams }: { searchParams: Promise<{ p?: string }> }) {
  await requireAdminUser();
  const range = resolveTrafficRange(await searchParams);
  return <TrafficDashboard range={range} data={await getTrafficData(range)}/>;
}
