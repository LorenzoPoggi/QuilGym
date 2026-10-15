"use client";

import { createContext, useContext } from "react";
import type { InstallmentsData } from "@/lib/installments-core";

const InstallmentsContext = createContext<InstallmentsData | null>(null);

/** Cuotas y marcas aceptadas leídas en el servidor (con caché); null si Mercado Pago no respondió. */
export function InstallmentsProvider({ data, children }: { data: InstallmentsData | null; children: React.ReactNode }) {
  return <InstallmentsContext.Provider value={data}>{children}</InstallmentsContext.Provider>;
}

export const useInstallmentsData = () => useContext(InstallmentsContext);
