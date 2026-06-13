"use client";

import AppShell from "../../components/AppShell";
import QuickNotesPage from "../../components/QuickNotesPage";

export default function QuickNotesRoutePage() {
  return (
    <AppShell activeSection="quick-notes" title="快速備忘錄">
      <QuickNotesPage />
    </AppShell>
  );
}
