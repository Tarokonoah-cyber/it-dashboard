"use client";

import AppShell from "../../components/AppShell";
import SettingsPage from "../../components/SettingsPage";

export default function SettingsRoutePage() {
  return (
    <AppShell activeSection="settings" title="設定">
      <SettingsPage />
    </AppShell>
  );
}
