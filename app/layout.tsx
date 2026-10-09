import type { Metadata } from "next";
import { Archivo, Inter } from "next/font/google";
import { CartDialog } from "@/components/cart-drawer";
import { CartProvider } from "@/components/cart-provider";
import { AccountProvider } from "@/components/account-provider";
import { AdvisorLauncher } from "@/components/advisor-launcher";
import "./globals.css";
import "./styles/home.css";
import "./styles/catalog.css";
import "./styles/product.css";
import "./styles/checkout.css";
import "./styles/account-advisor.css";
import "./styles/combos.css";

// Inter autoalojada por next/font: sin pedidos a Google y sin depender de las fuentes del sistema.
const inter = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
// Archivo variable con el eje de ancho: el logotipo usa la versión expandida y pesada.
const archivo = Archivo({ subsets: ["latin"], axes: ["wdth"], variable: "--font-display", display: "swap" });

export const metadata: Metadata = {
  title: "QuilGym | Suplementos para entrenar mejor",
  description:
    "Suplementos, creatinas y esenciales de entrenamiento con información clara y asesoramiento real.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" data-scroll-behavior="smooth" className={`${inter.variable} ${archivo.variable}`}>
      <body><AccountProvider><CartProvider>{children}<AdvisorLauncher/><CartDialog/></CartProvider></AccountProvider></body>
    </html>
  );
}
