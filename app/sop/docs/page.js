"use client";

import AppShell from "../../../components/AppShell";
import DataSectionPage from "../../../components/DataSectionPage";

export default function SopDocsRoutePage() {
  return (
    <AppShell activeSection="sop_docs" title="SOP">
      <DataSectionPage sectionKey="sop_docs" />
    </AppShell>
  );
}
