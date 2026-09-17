import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Agent Ops — Thales Sakano",
  description:
    "Interactive agent operations demo: simulated executions, observability and human approvals.",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
