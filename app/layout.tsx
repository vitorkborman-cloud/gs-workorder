import "./globals.css";
import { Inter } from "next/font/google";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

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
      <body className={`${inter.variable} font-sans bg-[#f3f4f6] text-gray-800`}>
        {children}
      </body>
    </html>
  );
}
