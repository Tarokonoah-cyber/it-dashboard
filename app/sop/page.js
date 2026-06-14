"use client";

import AppShell from "../../components/AppShell";
import DataSectionPage from "../../components/DataSectionPage";

export default function SopRoutePage() {
  return (
    <AppShell activeSection="sop" title="SOP 文件">
      <DataSectionPage sectionKey="sop" />
    </AppShell>
  );
}
