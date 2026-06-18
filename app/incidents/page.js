"use client";

import AppShell from "../../components/AppShell";
import IncidentRecordsPage from "../../components/IncidentRecordsPage";

export default function IncidentRecordsRoutePage() {
  return (
    <AppShell activeSection="it_incidents" title="故障總表 / 異常事件紀錄">
      <IncidentRecordsPage />
    </AppShell>
  );
}
