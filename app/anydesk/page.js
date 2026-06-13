"use client";

import AppShell from "../../components/AppShell";
import DataSectionPage from "../../components/DataSectionPage";

export default function AnydeskRoutePage() {
  return (
    <AppShell activeSection="anydesk" title="AnyDesk List">
      <DataSectionPage sectionKey="anydesk" />
    </AppShell>
  );
}
