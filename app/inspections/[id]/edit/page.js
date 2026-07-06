"use client";

import { useParams, useSearchParams } from "next/navigation";
import AppShell from "../../../../components/AppShell";
import InspectionForm from "../../../../components/inspections/InspectionForm";

export default function EditInspectionRoutePage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const initialPeriod = searchParams.get("period") === "monthly" ? "monthly" : "daily";

  return (
    <AppShell activeSection="daily_inspections" title="編輯每日巡檢">
      <InspectionForm mode="edit" recordId={params.id} initialPeriod={initialPeriod} />
    </AppShell>
  );
}
