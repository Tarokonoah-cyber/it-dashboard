"use client";

import { useParams, useSearchParams } from "next/navigation";
import AppShell from "../../../components/AppShell";
import InspectionDetail from "../../../components/inspections/InspectionDetail";

export default function InspectionDetailRoutePage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const initialPeriod = searchParams.get("period") === "monthly" ? "monthly" : "daily";

  return (
    <AppShell activeSection="daily_inspections" title="每日巡檢詳細">
      <InspectionDetail recordId={params.id} initialPeriod={initialPeriod} />
    </AppShell>
  );
}
