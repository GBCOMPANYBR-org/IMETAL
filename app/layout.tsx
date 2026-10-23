import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "IMETAL — Gestão de Pedidos",
  applicationName: "IMETAL",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "IMETAL", statusBarStyle: "black-translucent" },
  icons: { icon: "/pwa-icon.svg", apple: "/pwa-icon.svg" },
  description: "Sistema interno de gestão de pedidos e clientes da IMETAL",
  // ferramenta interna com dados reais de clientes/pedidos — nunca deve aparecer em busca
  robots: { index: false, follow: false, nocache: true },
};

export const viewport = { themeColor: "#0f172a", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
