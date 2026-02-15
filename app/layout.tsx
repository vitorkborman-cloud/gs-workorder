import "./globals.css";
import Script from "next/script";

export const metadata = {
  title: "GS Work Order",
  description: "Gestão de atividades em campo",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#391e2a" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
      </head>
      <body>
        {children}

        <Script id="sw-register" strategy="afterInteractive">
          {`
            if ('serviceWorker' in navigator) {
              window.addEventListener('load', function() {
                navigator.serviceWorker.register('/sw.js');
              });
            }
          `}
        </Script>
      </body>
    </html>
  );
}
