"use client";

export default function SettingsPage() {
  return (
    <section className="section-page">
      <header className="section-head">
        <div>
          <h1>設定</h1>
        </div>
      </header>
      <div className="settings-grid">
        <div className="mini-card"><b>正式介面</b><span>Vercel Dashboard</span></div>
        <div className="mini-card"><b>正式資料來源</b><span>Supabase</span></div>
        <div className="mini-card"><b>資料流程</b><span>單一 Supabase 寫入流程</span></div>
      </div>
    </section>
  );
}
