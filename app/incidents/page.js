"use client";

import AppShell from "../../components/AppShell";
import IncidentRecordsPage from "../../components/IncidentRecordsPage";

export default function IncidentRecordsRoutePage() {
  return (
    <AppShell activeSection="it_incidents" title="故障知識庫 / 教學手冊">
      <IncidentRecordsPage />
    </AppShell>
  );
}
