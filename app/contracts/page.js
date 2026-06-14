"use client";

import AppShell from "../../components/AppShell";
import DataSectionPage from "../../components/DataSectionPage";

export default function ContractsRoutePage() {
  return (
    <AppShell activeSection="contracts" title="合約總覽">
      <DataSectionPage sectionKey="contracts" />
    </AppShell>
  );
}
