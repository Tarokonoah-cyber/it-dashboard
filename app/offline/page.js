import Link from "next/link";

export const metadata = {
  title: "目前離線｜太魯閣 IT"
};

export default function OfflinePage() {
  return (
    <main className="offline-page">
      <section>
        <div className="offline-page-mark" aria-hidden="true">T</div>
        <span>OFFLINE MODE</span>
        <h1>目前沒有網路連線</h1>
        <p>已開啟的巡檢表仍可繼續填寫，內容會自動暫存在這台裝置。恢復網路後，再按「完成巡檢」送出。</p>
        <Link href="/">重新連線</Link>
      </section>
    </main>
  );
}
