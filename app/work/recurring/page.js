"use client";

import AppShell from "../../../components/AppShell";
import RecurringTasksPage from "../../../components/RecurringTasksPage";

export default function RecurringTasksRoutePage() {
  return (
    <AppShell activeSection="recurring_tasks" title="週期任務">
      <RecurringTasksPage />
    </AppShell>
  );
}
