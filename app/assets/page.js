"use client";

import AppShell from "../../components/AppShell";
import DataSectionPage from "../../components/DataSectionPage";

export default function AssetsRoutePage() {
  return (
    <AppShell activeSection="assets" title="設備清單">
      <DataSectionPage sectionKey="assets" />
    </AppShell>
  );
}
