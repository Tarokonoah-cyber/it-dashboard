"use client";

import AppShell from "../../../components/AppShell";
import DataSectionPage from "../../../components/DataSectionPage";

export default function SocDocsRoutePage() {
  return (
    <AppShell activeSection="soc_docs" title="SOC">
      <DataSectionPage sectionKey="soc_docs" />
    </AppShell>
  );
}
