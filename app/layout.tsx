import "./globals.css";

export const metadata = {
  title: "GS Work Order",
  description: "Sistema de gestão de atividades",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen bg-background text-foreground antialiased">
        <div className="theme light">
          {children}
        </div>
      </body>
    </html>
  );
}
