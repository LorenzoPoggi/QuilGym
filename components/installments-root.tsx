import { getInstallmentsData } from "@/lib/installments";
import { InstallmentsProvider } from "./installments-provider";

/** Envuelve la app con los datos de cuotas; la consulta a Mercado Pago está cacheada por varias horas. */
export async function InstallmentsRoot({ children }: { children: React.ReactNode }) {
  return <InstallmentsProvider data={await getInstallmentsData()}>{children}</InstallmentsProvider>;
}
