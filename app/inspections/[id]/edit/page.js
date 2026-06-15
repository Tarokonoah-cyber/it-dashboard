"use client";

import { useParams } from "next/navigation";
import AppShell from "../../../../components/AppShell";
import InspectionForm from "../../../../components/inspections/InspectionForm";

export default function EditInspectionRoutePage() {
  const params = useParams();
  return (
    <AppShell activeSection="daily_inspections" title="編輯每日巡檢紀錄">
      <InspectionForm mode="edit" recordId={params.id} />
    </AppShell>
  );
}
