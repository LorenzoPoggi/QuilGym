import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "QuilGym | Suplementos para entrenar mejor",
  description:
    "Suplementos, creatinas y esenciales de entrenamiento con información clara y asesoramiento real.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" data-scroll-behavior="smooth">
      <body>{children}</body>
    </html>
  );
}
