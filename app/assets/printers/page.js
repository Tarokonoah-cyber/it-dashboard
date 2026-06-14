"use client";

import AppShell from "../../../components/AppShell";
import DataSectionPage from "../../../components/DataSectionPage";

export default function PrintersRoutePage() {
  return (
    <AppShell activeSection="assets_printer" title="印表機">
      <DataSectionPage sectionKey="assets_printer" />
    </AppShell>
  );
}
