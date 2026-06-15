"use client";

import AppShell from "../../components/AppShell";
import SportsCalendarPage from "../../components/SportsCalendarPage";

export default function CalendarRoutePage() {
  return (
    <AppShell activeSection="dashboard" title="Sports Calendar">
      <SportsCalendarPage />
    </AppShell>
  );
}
