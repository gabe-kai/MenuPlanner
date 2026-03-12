import type { ReactNode } from "react";
import "./globals.css";
import { SiteShell } from "@/components/SiteShell";

export const metadata = {
  title: "MenuPlanner",
  description: "Touch-first family meal and grocery planner",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-950 text-slate-50">
        <SiteShell>{children}</SiteShell>
      </body>
    </html>
  );
}

