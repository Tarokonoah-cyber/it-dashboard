"use client";

import { useParams } from "next/navigation";
import AppShell from "../../../components/AppShell";
import InspectionDetail from "../../../components/inspections/InspectionDetail";

export default function InspectionDetailRoutePage() {
  const params = useParams();
  return (
    <AppShell activeSection="daily_inspections" title="每日巡檢紀錄詳細">
      <InspectionDetail recordId={params.id} />
    </AppShell>
  );
}
