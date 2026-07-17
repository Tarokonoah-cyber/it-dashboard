"use client";

import AppShell from "../../components/AppShell";
import ReportsPage from "../../components/ReportsPage";

export default function ReportsRoutePage() {
  return (
    <AppShell activeSection="reports" title="報表中心">
      <ReportsPage />
    </AppShell>
  );
}
