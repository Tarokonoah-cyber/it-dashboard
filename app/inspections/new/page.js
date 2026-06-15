"use client";

import AppShell from "../../../components/AppShell";
import InspectionForm from "../../../components/inspections/InspectionForm";

export default function NewInspectionRoutePage() {
  return (
    <AppShell activeSection="daily_inspections" title="新增每日巡檢紀錄">
      <InspectionForm mode="new" />
    </AppShell>
  );
}
