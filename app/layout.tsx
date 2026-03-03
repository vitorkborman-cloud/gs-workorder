import "./globals.css";
import Script from "next/script";

export const metadata = {
  title: "GS Work Order",
  description: "Sistema de gestão de atividades",
  manifest: "/manifest.json",
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
          {children}
        </div>

        {/* Registro do Service Worker */}
        <Script id="register-sw" strategy="afterInteractive">
          {`
            if ('serviceWorker' in navigator) {
              window.addEventListener('load', function() {
                navigator.serviceWorker.register('/sw.js')
                  .then(function() {
                    console.log('Service Worker registrado');
                  })
                  .catch(function(err) {
                    console.log('Erro ao registrar SW:', err);
                  });
              });
            }
          `}
        </Script>
      </body>
    </html>
  );
}