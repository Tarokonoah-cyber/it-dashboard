"use client";

import AppShell from "../../components/AppShell";
import PasswordsPage from "../../components/PasswordsPage";

export default function PasswordsRoutePage() {
  return (
    <AppShell activeSection="passwords" title="密碼管理">
      <PasswordsPage />
    </AppShell>
  );
}
