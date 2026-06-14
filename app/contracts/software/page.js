"use client";

import AppShell from "../../../components/AppShell";
import DataSectionPage from "../../../components/DataSectionPage";

export default function SoftwareContractsRoutePage() {
  return (
    <AppShell activeSection="contracts_software" title="軟體合約">
      <DataSectionPage sectionKey="contracts_software" />
    </AppShell>
  );
}
