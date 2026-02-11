import "../styles/globals.css";

export const metadata = {
  title: "GS Work Order",
  description: "Sistema de gestão de atividades em campo",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
