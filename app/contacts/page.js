"use client";

import AppShell from "../../components/AppShell";
import DataSectionPage from "../../components/DataSectionPage";

export default function ContactsRoutePage() {
  return (
    <AppShell activeSection="contacts" title="通訊錄">
      <DataSectionPage sectionKey="contacts" />
    </AppShell>
  );
}
