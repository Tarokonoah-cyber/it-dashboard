"use client";

import AppShell from "../../components/AppShell";
import FollowUpsPage from "../../components/FollowUpsPage";

export default function FollowUpsRoutePage() {
  return (
    <AppShell activeSection="follow-ups" title="待追蹤">
      <FollowUpsPage />
    </AppShell>
  );
}
