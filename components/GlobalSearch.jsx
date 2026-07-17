"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const MIN_LENGTH = 2;

export default function GlobalSearch() {
  const router = useRouter();
  const inputRef = useRef(null);
  const requestRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [warnings, setWarnings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    function handleShortcut(event) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen(true);
      }
    }
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const timer = window.setTimeout(() => inputRef.current?.focus(), 30);
    function closeOnEscape(event) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  useEffect(() => {
    const keyword = query.trim();
    requestRef.current?.abort();
    if (keyword.length < MIN_LENGTH) {
      setResults([]);
      setWarnings([]);
      setLoading(false);
      return undefined;
    }
    const controller = new AbortController();
    requestRef.current = controller;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(keyword)}`, { cache: "no-store", signal: controller.signal });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.success) throw new Error(data.message || "搜尋失敗");
        setResults(data.data?.results || []);
        setWarnings(data.data?.warnings || []);
        setActiveIndex(0);
      } catch (error) {
        if (error.name !== "AbortError") {
          setResults([]);
          setWarnings([{ source: "search", message: error.message || "搜尋失敗" }]);
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 250);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  const grouped = useMemo(() => {
    const map = new Map();
    results.forEach((item, index) => {
      if (!map.has(item.category)) map.set(item.category, []);
      map.get(item.category).push({ item, index });
    });
    return Array.from(map.entries());
  }, [results]);

  function select(item) {
    if (!item?.href) return;
    setOpen(false);
    setQuery("");
    router.push(item.href);
  }

  function handleKeyDown(event) {
    if (!results.length) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((current) => (current + 1) % results.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) => (current - 1 + results.length) % results.length);
    } else if (event.key === "Enter") {
      event.preventDefault();
      select(results[activeIndex]);
    }
  }

  return (
    <>
      <button className="global-search-trigger" type="button" onClick={() => setOpen(true)} aria-label="開啟全站搜尋" title="全站搜尋（Ctrl + K）">
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <circle cx="11" cy="11" r="6.25" />
          <path d="m16 16 4 4" />
        </svg>
        <span className="global-search-tooltip" aria-hidden="true">全站搜尋 · Ctrl K</span>
      </button>
      {open ? (
        <div className="global-search-backdrop" role="presentation" onMouseDown={() => setOpen(false)}>
          <section className="global-search-dialog" role="dialog" aria-modal="true" aria-labelledby="global-search-title" onMouseDown={(event) => event.stopPropagation()}>
            <header>
              <div>
                <span>快速前往任何資料</span>
                <h2 id="global-search-title">全站搜尋</h2>
              </div>
              <button type="button" onClick={() => setOpen(false)} aria-label="關閉搜尋">×</button>
            </header>
            <label className="global-search-input">
              <span aria-hidden="true">⌕</span>
              <input ref={inputRef} value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={handleKeyDown} placeholder="搜尋工作、設備、合約、SOP..." autoComplete="off" />
              {loading ? <i>搜尋中</i> : null}
            </label>
            <div className="global-search-results" aria-live="polite">
              {query.trim().length < MIN_LENGTH ? <div className="global-search-empty">請輸入至少 2 個字</div> : null}
              {query.trim().length >= MIN_LENGTH && !loading && !results.length ? <div className="global-search-empty">找不到符合資料</div> : null}
              {grouped.map(([category, items]) => (
                <section key={category}>
                  <h3>{category}</h3>
                  {items.map(({ item, index }) => (
                    <button key={`${item.source}-${item.id}`} className={index === activeIndex ? "active" : ""} type="button" onMouseEnter={() => setActiveIndex(index)} onClick={() => select(item)}>
                      <span><strong>{item.title}</strong>{item.subtitle ? <small>{item.subtitle}</small> : null}</span>
                      <em>開啟</em>
                    </button>
                  ))}
                </section>
              ))}
              {warnings.length ? <p className="global-search-warning">部分資料來源暫時無法搜尋，其餘結果仍可使用。</p> : null}
            </div>
            <footer><span>↑↓ 選擇</span><span>Enter 開啟</span><span>Esc 關閉</span></footer>
          </section>
        </div>
      ) : null}
    </>
  );
}
