import Link from "next/link";

export default function NotFoundPage() {
  return (
    <main className="offline-page">
      <section>
        <div className="offline-page-mark" aria-hidden="true">404</div>
        <span>PAGE NOT FOUND</span>
        <h1>找不到這個頁面</h1>
        <p>網址可能已變更，或你開啟的功能已被移動。</p>
        <Link href="/">返回儀表板</Link>
      </section>
    </main>
  );
}
