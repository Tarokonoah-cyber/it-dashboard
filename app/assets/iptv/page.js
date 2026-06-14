"use client";

import AppShell from "../../../components/AppShell";
import DataSectionPage from "../../../components/DataSectionPage";

export default function IptvRoutePage() {
  return (
    <AppShell activeSection="assets_iptv" title="IPTV">
      <DataSectionPage sectionKey="assets_iptv" />
    </AppShell>
  );
}
