import type { ReactNode } from "react";
import "./globals.css";

export const metadata = {
  title: "MenuPlanner",
  description: "Touch-first family meal and grocery planner",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-950 text-slate-50">
        <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-4 py-6">
          <header className="mb-6 flex items-center justify-between">
            <h1 className="text-xl font-semibold tracking-tight">
              MenuPlanner
            </h1>
            <span className="text-xs text-slate-400">
              Phase 1 – Toy Planner
            </span>
          </header>
          <main className="flex-1">{children}</main>
        </div>
      </body>
    </html>
  );
}

