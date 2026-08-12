export default function LoadingPage() {
  return (
    <main className="offline-page app-loading-page" aria-busy="true">
      <section role="status" aria-live="polite">
        <div className="offline-page-mark" aria-hidden="true">T</div>
        <span>LOADING</span>
        <h1>正在準備頁面</h1>
        <p>請稍候，系統正在載入最新資料。</p>
      </section>
    </main>
  );
}
