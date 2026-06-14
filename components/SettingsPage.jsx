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
        <div className="mini-card"><b>前端入口</b><span>Vercel Dashboard</span></div>
        <div className="mini-card"><b>資料庫</b><span>Supabase</span></div>
        <div className="mini-card"><b>舊系統</b><span>Apps Script 保留備援與匯入工具</span></div>
      </div>
    </section>
  );
}
