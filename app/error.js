"use client";

import { useEffect } from "react";

export default function ErrorPage({ error, reset }) {
  useEffect(() => {
    console.error("[dashboard render error]", error);
  }, [error]);

  return (
    <main className="offline-page">
      <section role="alert">
        <div className="offline-page-mark" aria-hidden="true">!</div>
        <span>PAGE ERROR</span>
        <h1>這個頁面暫時無法顯示</h1>
        <p>系統已保留目前頁面位置。你可以再試一次；若問題持續發生，請通知資訊管理人員。</p>
        <button className="offline-page-action" type="button" onClick={reset}>再試一次</button>
      </section>
    </main>
  );
}
