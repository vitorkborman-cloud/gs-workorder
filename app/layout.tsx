import type { Metadata, Viewport } from "next";
import "./globals.css";
import Script from "next/script";
import { ToastProvider } from "../components/Toast";

export const metadata: Metadata = {
  title: "GS Work Order",
  description: "Sistema de gestão de atividades",
  manifest: "/manifest.json",
  // Tags específicas da Apple: sem elas o iOS usa uma captura de tela como
  // ícone ao "Adicionar à Tela de Início" e abre o app dentro do Safari em
  // vez de em tela cheia (padrão da Apple, o manifest.json genérico não
  // é suficiente sozinho).
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "GS Work Order",
  },
  icons: {
    icon: "/icon-192.png",
    apple: "/icon-192.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#391e2a",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <head />
      <body className="min-h-screen bg-background text-foreground antialiased">
        <div className="theme light">
          <ToastProvider>
            {children}
          </ToastProvider>
        </div>

        {/* Registro do Service Worker */}
        <Script id="register-sw" strategy="afterInteractive">
          {`
            if ('serviceWorker' in navigator) {
              window.addEventListener('load', function() {
                navigator.serviceWorker.register('/sw.js')
                  .catch(function(err) {
                    console.error('Erro ao registrar SW:', err);
                  });
              });
            }
          `}
        </Script>
      </body>
    </html>
  );
}