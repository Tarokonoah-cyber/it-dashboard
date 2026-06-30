"use client";

import { useRouter } from "next/navigation";
import QuickInspectionPanel from "./QuickInspectionPanel";

export default function InspectionForm({ mode = "new", recordId = "" }) {
  const router = useRouter();

  return (
    <section className="section-page inspection-page">
      <header className="inspection-page-head compact">
        <div>
          <h1>{mode === "edit" ? "編輯每日巡檢" : "新增每日巡檢"}</h1>
        </div>
        <div className="section-actions">
          <button onClick={() => router.push("/inspections")}>返回列表</button>
        </div>
      </header>

      <QuickInspectionPanel
        mode={mode}
        recordId={recordId}
        onSaved={(record) => router.push(`/inspections/${record.id}`)}
      />
    </section>
  );
}
