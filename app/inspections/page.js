"use client";

import AppShell from "../../components/AppShell";
import InspectionList from "../../components/inspections/InspectionList";

export default function InspectionsRoutePage() {
  return (
    <AppShell activeSection="daily_inspections" title="每日巡檢">
      <InspectionList />
    </AppShell>
  );
}
