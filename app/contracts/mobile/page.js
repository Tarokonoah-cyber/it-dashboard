"use client";

import AppShell from "../../../components/AppShell";
import DataSectionPage from "../../../components/DataSectionPage";

export default function MobileContractsRoutePage() {
  return (
    <AppShell activeSection="contracts_mobile" title="行動電話約期">
      <DataSectionPage sectionKey="contracts_mobile" />
    </AppShell>
  );
}
