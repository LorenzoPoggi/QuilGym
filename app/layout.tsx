import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { CartDialog } from "@/components/cart-drawer";
import { CartProvider } from "@/components/cart-provider";
import "./globals.css";
import "./styles/home.css";
import "./styles/catalog.css";
import "./styles/product.css";
import "./styles/checkout.css";

// Inter autoalojada por next/font: sin pedidos a Google y sin depender de las fuentes del sistema.
const inter = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });

export const metadata: Metadata = {
  title: "QuilGym | Suplementos para entrenar mejor",
  description:
    "Suplementos, creatinas y esenciales de entrenamiento con información clara y asesoramiento real.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" data-scroll-behavior="smooth" className={inter.variable}>
      <body><CartProvider>{children}<CartDialog/></CartProvider></body>
    </html>
  );
}
