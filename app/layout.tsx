import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Vida Produtiva | Custeio e Precificação",
  description: "Custeio e precificação orientada para pequenos negócios"
};

export default function Layout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body suppressHydrationWarning>{children}</body></html>;
}
