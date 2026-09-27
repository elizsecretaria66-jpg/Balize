import type { Metadata } from "next";
import { Sidebar } from "@/components/layout/sidebar";
import "./globals.css";

export const metadata: Metadata = {
  title: "Balize",
  description: "Conciliação bancária e gestão financeira",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <div className="flex" style={{ background: "var(--cor-fundo)" }}>
          <Sidebar />
          <div className="min-h-screen flex-1 overflow-y-auto">{children}</div>
        </div>
      </body>
    </html>
  );
}
