"use client";

import AppShell from "../../components/AppShell";
import WorkCenterPage from "../../components/WorkCenterPage";

export default function WorkRoutePage() {
  return (
    <AppShell activeSection="work" title="工作中心">
      <WorkCenterPage />
    </AppShell>
  );
}
