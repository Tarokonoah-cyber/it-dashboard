"use client";

import AppShell from "../../components/AppShell";
import CostControlPage from "../../components/CostControlPage";
import "./cost-control.css";

export default function CostControlRoutePage() {
  return (
    <AppShell activeSection="cost_control" title="成本控制">
      <CostControlPage />
    </AppShell>
  );
}
