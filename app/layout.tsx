import "./globals.css";

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
      </head>
      <body>{children}</body>
    </html>
  );
}
