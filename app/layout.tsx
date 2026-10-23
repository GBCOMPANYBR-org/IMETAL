import type { Metadata } from "next";
import "./globals.css";
import PwaLaunch from "@/components/PwaLaunch";
import OfflineRegistration from "@/components/OfflineRegistration";

export const metadata: Metadata = {
  title: "IMETAL — Gestão de Pedidos",
  applicationName: "IMETAL",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "IMETAL", statusBarStyle: "black-translucent" },
  icons: { icon: "/pwa-icon.svg", apple: "/apple-icon" },
  description: "Sistema interno de gestão de pedidos e clientes da IMETAL",
  // ferramenta interna com dados reais de clientes/pedidos — nunca deve aparecer em busca
  robots: { index: false, follow: false, nocache: true },
};

export const viewport = { themeColor: "#ffe637", width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body><OfflineRegistration /><PwaLaunch />{children}</body>
    </html>
  );
}
