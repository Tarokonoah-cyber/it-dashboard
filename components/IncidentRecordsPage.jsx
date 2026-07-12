"use client";

import { useEffect, useMemo, useRef, useState } from "react";

const EMPTY_ARTICLE = {
  title: "",
  article_type: "troubleshooting",
  category: "",
  system_name: "",
  symptom: "",
  possible_cause: "",
  summary: "",
  keywords: "",
  status: "draft",
  sort_order: 0,
  steps: []
};

const STATUS_LABELS = {
  draft: "草稿",
  published: "已發布",
  archived: "已封存"
};

const TYPE_LABELS = {
  troubleshooting: "故障排除",
  guide: "教學手冊"
};

function createBlankStep() {
  return { id: "", step_order: 1, title: "", body: "", assets: [] };
}

function formatDateTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("zh-TW", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function splitKeywords(value) {
  return String(value || "")
    .split(/[,，\s]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function hasMeaningfulContent(value) {
  if (value === null || value === undefined) return false;
  const text = String(value).trim();
  return Boolean(text && text !== "-" && text !== "—");
}

function safeErrorMessage(error, fallback = "操作失敗，請稍後再試") {
  const message = String(error?.message || "").trim();
  const looksSensitive = /https?:\/\/|signed|storage_path|service_role|select\s|insert\s|update\s|delete\s|sql/i.test(message);
  return message && !looksSensitive ? message.slice(0, 120) : fallback;
}

async function readApi(response) {
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.success === false) throw new Error(body.message || `HTTP ${response.status}`);
  return body.data;
}

function uniqueOptions(rows, key) {
  return Array.from(new Set((rows || []).map((row) => row[key]).filter(Boolean))).sort((a, b) => a.localeCompare(b, "zh-Hant"));
}

async function compressKnowledgeImage(file) {
  const allowed = new Set(["image/jpeg", "image/png", "image/webp"]);
  if (!allowed.has(file.type)) throw new Error("僅允許 JPEG、PNG、WebP 圖片");

  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d", { alpha: true }).drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();

  const toBlob = (type, quality) => new Promise((resolve) => canvas.toBlob(resolve, type, quality));
  let blob = await toBlob("image/webp", 0.78);
  if (!blob) blob = await toBlob(file.type === "image/png" ? "image/png" : "image/jpeg", 0.78);
  if (blob && blob.size > 500 * 1024) blob = await toBlob("image/webp", 0.68);
  if (blob && blob.size > 500 * 1024) blob = await toBlob("image/webp", 0.58);
  if (!blob) throw new Error("圖片壓縮失敗");
  if (blob.size > 500 * 1024) throw new Error("圖片壓縮後仍超過 500KB，請裁切或改用較小圖片");

  const safeBase = String(file.name || "knowledge-image").replace(/\.[^.]+$/, "").slice(0, 80) || "knowledge-image";
  return new File([blob], `${safeBase}.webp`, { type: blob.type || "image/webp" });
}

function ArticleStatus({ status }) {
  return <span className={`knowledge-status is-${status}`}>{STATUS_LABELS[status] || status}</span>;
}

function KnowledgeToast({ toast, onClose }) {
  if (!toast) return null;
  return (
    <div className={`knowledge-toast is-${toast.type}`} role={toast.type === "error" ? "alert" : "status"} aria-live="polite">
      <span aria-hidden="true">{toast.type === "error" ? "!" : "✓"}</span>
      <p>{toast.text}</p>
      {toast.type === "error" ? <button type="button" onClick={onClose} aria-label="關閉提示">×</button> : null}
    </div>
  );
}

function KnowledgeLightbox({ asset, onClose }) {
  useEffect(() => {
    if (!asset) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [asset, onClose]);

  if (!asset) return null;
  const alt = asset.alt_text || asset.original_filename || "教學圖片";
  return (
    <div className="knowledge-lightbox" role="dialog" aria-modal="true" aria-label="圖片預覽" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <div className="knowledge-lightbox-content">
        <button type="button" className="knowledge-lightbox-close" onClick={onClose} aria-label="關閉圖片預覽">×</button>
        <img src={asset.signed_url} alt={alt} />
        {hasMeaningfulContent(asset.alt_text) ? <p>{asset.alt_text}</p> : null}
      </div>
    </div>
  );
}

function KnowledgeImage({ asset, fallbackAlt, onOpen }) {
  const hasImageUrl = hasMeaningfulContent(asset.signed_url);
  const [failed, setFailed] = useState(!hasImageUrl);
  const [retryCount, setRetryCount] = useState(0);
  const alt = asset.alt_text || asset.original_filename || fallbackAlt || "教學圖片";

  if (failed) {
    return (
      <div className="knowledge-image-error" role="status">
        <span>圖片暫時無法載入</span>
        {hasImageUrl ? (
          <button type="button" onClick={() => {
            setFailed(false);
            setRetryCount((count) => count + 1);
          }}>重試</button>
        ) : null}
      </div>
    );
  }

  return (
    <button className="knowledge-image-button" type="button" onClick={() => onOpen(asset)} aria-label={`放大圖片：${alt}`}>
      <img key={retryCount} loading="lazy" src={asset.signed_url} alt={alt} onError={() => setFailed(true)} />
    </button>
  );
}

function KnowledgeOverflowMenu({ article, onArchive, onDelete }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const handlePointerDown = (event) => {
      if (!menuRef.current?.contains(event.target)) setOpen(false);
    };
    const handleKeyDown = (event) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div className="knowledge-overflow" ref={menuRef}>
      <button type="button" className="knowledge-overflow-trigger" onClick={() => setOpen((value) => !value)} aria-label="更多管理操作" aria-expanded={open}>⋯</button>
      {open ? (
        <div className="knowledge-overflow-menu" role="menu">
          {article.status !== "archived" ? <button type="button" role="menuitem" onClick={() => { setOpen(false); onArchive(); }}>封存文章</button> : null}
          <button type="button" role="menuitem" className="danger" onClick={() => { setOpen(false); onDelete(); }}>刪除文章</button>
        </div>
      ) : null}
    </div>
  );
}

function DeleteArticleDialog({ article, deleting, onCancel, onConfirm }) {
  useEffect(() => {
    if (!article) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === "Escape" && !deleting) onCancel();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [article, deleting, onCancel]);

  if (!article) return null;
  return (
    <div className="knowledge-confirm-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !deleting) onCancel();
    }}>
      <div className="knowledge-confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="knowledge-delete-title" aria-describedby="knowledge-delete-description">
        <h2 id="knowledge-delete-title">刪除教學文章？</h2>
        <p id="knowledge-delete-description">即將刪除「{article.title}」。文章、相關步驟與圖片都會一併刪除，且無法復原。</p>
        <div>
          <button type="button" onClick={onCancel} disabled={deleting}>取消</button>
          <button type="button" className="danger" onClick={onConfirm} disabled={deleting}>{deleting ? "刪除中..." : "確認刪除"}</button>
        </div>
      </div>
    </div>
  );
}

function ArticleList({ rows, selectedId, onSelect, listRef }) {
  if (!rows.length) return <div className="knowledge-empty">目前沒有符合條件的教學資料。</div>;

  return (
    <div className="knowledge-list" role="list" ref={listRef}>
      {rows.map((article) => (
        <button
          className={`knowledge-list-row ${selectedId === article.id ? "active" : ""}`}
          key={article.id}
          type="button"
          onClick={() => onSelect(article.id)}
        >
          <span>
            <b>{article.title}</b>
            <small>{article.category || "未分類"} · {article.system_name || "未指定系統"}</small>
            <small>更新於 {formatDateTime(article.updated_at)}</small>
          </span>
          <ArticleStatus status={article.status} />
        </button>
      ))}
    </div>
  );
}

function ArticleViewer({ article, adminMode, onBack, onEdit, onDelete, onStatus, onOpenImage }) {
  if (!article) return <div className="knowledge-reader knowledge-empty">請從左側選擇一篇教學。</div>;

  const hasSymptom = hasMeaningfulContent(article.symptom);
  const hasCause = hasMeaningfulContent(article.possible_cause);
  const visibleSteps = (article.steps || []).filter((step) =>
    hasMeaningfulContent(step.title) || hasMeaningfulContent(step.body) || Boolean(step.assets?.length)
  );

  return (
    <article className="knowledge-reader">
      <button className="knowledge-mobile-back" type="button" onClick={onBack}>← 返回教學列表</button>
      <header className="knowledge-reader-head">
        <div className="knowledge-reader-title">
          <div className="knowledge-meta-line">
            <span>{TYPE_LABELS[article.article_type] || article.article_type}</span>
            <span>{article.category || "未分類"}</span>
            <span>{article.system_name || "未指定系統"}</span>
          </div>
          <h2>{article.title}</h2>
          <div className="knowledge-meta-line">
            <ArticleStatus status={article.status} />
            <span>最後更新 {formatDateTime(article.updated_at)}</span>
          </div>
        </div>
        {adminMode ? (
          <div className="knowledge-actions">
            <button type="button" onClick={onEdit}>編輯</button>
            {article.status !== "published" ? <button className="primary" type="button" onClick={() => onStatus("published")}>發布</button> : null}
            <KnowledgeOverflowMenu article={article} onArchive={() => onStatus("archived")} onDelete={onDelete} />
          </div>
        ) : null}
      </header>

      {hasSymptom || hasCause ? (
        <div className={`knowledge-summary-grid ${hasSymptom && hasCause ? "" : "is-single"}`}>
          {hasSymptom ? (
            <section>
              <h3>問題現象</h3>
              <p>{article.symptom}</p>
            </section>
          ) : null}
          {hasCause ? (
            <section>
              <h3>可能原因</h3>
              <p>{article.possible_cause}</p>
            </section>
          ) : null}
        </div>
      ) : null}

      {hasMeaningfulContent(article.summary) ? (
        <section className="knowledge-block knowledge-summary-block">
          <h3>摘要</h3>
          <p>{article.summary}</p>
        </section>
      ) : null}

      <section className="knowledge-steps">
        <h3>處理步驟</h3>
        {visibleSteps.length ? visibleSteps.map((step) => (
          <div className="knowledge-step" key={step.id}>
            <div className="knowledge-step-marker" aria-hidden="true">
              <span className="knowledge-step-number">{step.step_order}</span>
            </div>
            <div className="knowledge-step-content">
              {hasMeaningfulContent(step.title) ? <h4>{step.title}</h4> : null}
              {hasMeaningfulContent(step.body) ? <p>{step.body}</p> : null}
              {step.assets?.length ? (
                <div className="knowledge-image-grid">
                  {step.assets.map((asset) => (
                    <figure key={asset.id}>
                      <KnowledgeImage asset={asset} fallbackAlt={step.title} onOpen={onOpenImage} />
                      {asset.alt_text ? <figcaption>{asset.alt_text}</figcaption> : null}
                    </figure>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        )) : <p>尚未建立步驟。</p>}
      </section>

      {splitKeywords(article.keywords).length ? (
        <div className="knowledge-keywords">
          {splitKeywords(article.keywords).map((keyword) => <span key={keyword}>{keyword}</span>)}
        </div>
      ) : null}
    </article>
  );
}

function ArticleEditor({ draft, setDraft, saving, uploadingId, onClose, onSave, onUpload, onDeleteAsset, onMoveStep }) {
  function setField(key, value) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function setStep(index, patch) {
    setDraft((current) => ({
      ...current,
      steps: current.steps.map((step, stepIndex) => stepIndex === index ? { ...step, ...patch } : step)
    }));
  }

  function addStep() {
    setDraft((current) => ({
      ...current,
      steps: [...(current.steps || []), { ...createBlankStep(), step_order: (current.steps || []).length + 1 }]
    }));
  }

  function removeStep(index) {
    setDraft((current) => ({
      ...current,
      steps: current.steps.filter((_, stepIndex) => stepIndex !== index).map((step, stepIndex) => ({ ...step, step_order: stepIndex + 1 }))
    }));
  }

  return (
    <div className="knowledge-editor-backdrop" role="presentation">
      <form className="knowledge-editor" onSubmit={onSave}>
        <header>
          <div>
            <h2>{draft.id ? "編輯教學" : "新增教學"}</h2>
            <p>圖片會先在瀏覽器壓縮為 WebP，並由伺服器上傳到 private Storage。</p>
          </div>
          <button type="button" onClick={onClose}>x</button>
        </header>

        <div className="knowledge-editor-grid">
          <label className="wide">
            <span>標題</span>
            <input value={draft.title} onChange={(event) => setField("title", event.target.value)} required maxLength={180} />
          </label>
          <label>
            <span>類型</span>
            <select value={draft.article_type} onChange={(event) => setField("article_type", event.target.value)}>
              <option value="troubleshooting">故障排除</option>
              <option value="guide">教學手冊</option>
            </select>
          </label>
          <label>
            <span>狀態</span>
            <select value={draft.status} onChange={(event) => setField("status", event.target.value)}>
              <option value="draft">草稿</option>
              <option value="published">發布</option>
              <option value="archived">封存</option>
            </select>
          </label>
          <label>
            <span>分類</span>
            <input value={draft.category || ""} onChange={(event) => setField("category", event.target.value)} />
          </label>
          <label>
            <span>系統</span>
            <input value={draft.system_name || ""} onChange={(event) => setField("system_name", event.target.value)} />
          </label>
          <label className="wide">
            <span>問題現象</span>
            <textarea value={draft.symptom || ""} onChange={(event) => setField("symptom", event.target.value)} rows={3} />
          </label>
          <label className="wide">
            <span>可能原因</span>
            <textarea value={draft.possible_cause || ""} onChange={(event) => setField("possible_cause", event.target.value)} rows={3} />
          </label>
          <label className="wide">
            <span>摘要</span>
            <textarea value={draft.summary || ""} onChange={(event) => setField("summary", event.target.value)} rows={3} />
          </label>
          <label className="wide">
            <span>關鍵字</span>
            <input value={draft.keywords || ""} onChange={(event) => setField("keywords", event.target.value)} placeholder="以逗號或空白分隔" />
          </label>
        </div>

        <section className="knowledge-editor-steps">
          <div className="knowledge-editor-section-head">
            <h3>處理步驟</h3>
            <button type="button" onClick={addStep}>新增步驟</button>
          </div>
          {(draft.steps || []).map((step, index) => (
            <div className="knowledge-editor-step" key={step.id || `new-${index}`}>
              <div className="knowledge-step-toolbar">
                <strong>步驟 {index + 1}</strong>
                <div>
                  <button type="button" onClick={() => onMoveStep(index, -1)} disabled={index === 0}>上移</button>
                  <button type="button" onClick={() => onMoveStep(index, 1)} disabled={index === draft.steps.length - 1}>下移</button>
                  <button className="danger" type="button" onClick={() => removeStep(index)}>刪除</button>
                </div>
              </div>
              <input value={step.title || ""} onChange={(event) => setStep(index, { title: event.target.value })} placeholder="步驟標題" />
              <textarea value={step.body || ""} onChange={(event) => setStep(index, { body: event.target.value })} rows={4} placeholder="步驟內容" />
              {draft.id && step.id ? (
                <label className="knowledge-upload-line">
                  <span>{uploadingId === step.id ? "上傳中..." : "新增圖片"}</span>
                  <input type="file" accept="image/jpeg,image/png,image/webp" disabled={uploadingId === step.id} onChange={(event) => onUpload(event, step.id)} />
                </label>
              ) : (
                <p className="knowledge-muted">先儲存文章後即可上傳圖片。</p>
              )}
              {step.assets?.length ? (
                <div className="knowledge-asset-editor-grid">
                  {step.assets.map((asset) => (
                    <figure key={asset.id}>
                      <img loading="lazy" src={asset.signed_url} alt={asset.alt_text || asset.original_filename || "教學圖片"} />
                      <input
                        value={asset.alt_text || ""}
                        onChange={(event) => {
                          const nextAssets = step.assets.map((item) => item.id === asset.id ? { ...item, alt_text: event.target.value } : item);
                          setStep(index, { assets: nextAssets });
                        }}
                        placeholder="圖片說明"
                      />
                      <button className="danger" type="button" onClick={() => onDeleteAsset(asset.id)}>刪除圖片</button>
                    </figure>
                  ))}
                </div>
              ) : null}
            </div>
          ))}
        </section>

        <footer>
          <button type="button" onClick={onClose}>取消</button>
          <button className="primary" type="submit" disabled={saving}>{saving ? "儲存中..." : "儲存"}</button>
        </footer>
      </form>
    </div>
  );
}

export default function IncidentRecordsPage() {
  const [articles, setArticles] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [selectedArticle, setSelectedArticle] = useState(null);
  const [filters, setFilters] = useState({ query: "", category: "", system: "", status: "published" });
  const [adminMode, setAdminMode] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [draft, setDraft] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingId, setUploadingId] = useState("");
  const [toast, setToast] = useState(null);
  const [lightboxAsset, setLightboxAsset] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [mobileView, setMobileView] = useState("list");
  const listRef = useRef(null);
  const listScrollTop = useRef(0);

  const categories = useMemo(() => uniqueOptions(articles, "category"), [articles]);
  const systems = useMemo(() => uniqueOptions(articles, "system_name"), [articles]);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(null), toast.type === "error" ? 5000 : 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  async function loadArticles(nextAdmin = adminMode) {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (nextAdmin) params.set("includeDrafts", "1");
      if (filters.query) params.set("q", filters.query);
      if (filters.category) params.set("category", filters.category);
      if (filters.system) params.set("system", filters.system);
      if (nextAdmin && filters.status) params.set("status", filters.status);
      const rows = await readApi(await fetch(`/api/knowledge?${params.toString()}`, { cache: "no-store" }));
      setArticles(rows);
      if (!rows.some((row) => row.id === selectedId)) setSelectedId(rows[0]?.id || "");
    } catch (error) {
      if (nextAdmin) setAdminMode(false);
      setToast({ type: "error", text: safeErrorMessage(error, "教學列表讀取失敗") });
      setArticles([]);
    } finally {
      setLoading(false);
    }
  }

  async function loadDetail(id = selectedId, nextAdmin = adminMode) {
    if (!id) {
      setSelectedArticle(null);
      return;
    }
    try {
      const params = nextAdmin ? "?includeDrafts=1" : "";
      setSelectedArticle(await readApi(await fetch(`/api/knowledge/${id}${params}`, { cache: "no-store" })));
    } catch (error) {
      setToast({ type: "error", text: safeErrorMessage(error, "教學內容讀取失敗") });
      setSelectedArticle(null);
    }
  }

  useEffect(() => {
    loadArticles(adminMode);
  }, [filters.query, filters.category, filters.system, filters.status, adminMode]);

  useEffect(() => {
    loadDetail(selectedId, adminMode);
  }, [selectedId, adminMode]);

  function updateFilter(key, value) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function selectArticle(id) {
    listScrollTop.current = listRef.current?.scrollTop || 0;
    setSelectedId(id);
    setMobileView("reader");
  }

  function returnToList() {
    setMobileView("list");
    window.requestAnimationFrame(() => {
      if (listRef.current) listRef.current.scrollTop = listScrollTop.current;
    });
  }

  function openCreate() {
    setDraft({ ...EMPTY_ARTICLE, steps: [createBlankStep()] });
    setEditorOpen(true);
  }

  function openEdit() {
    if (!selectedArticle) return;
    setDraft(JSON.parse(JSON.stringify(selectedArticle)));
    setEditorOpen(true);
  }

  function moveStep(index, delta) {
    setDraft((current) => {
      const steps = [...(current.steps || [])];
      const target = index + delta;
      if (target < 0 || target >= steps.length) return current;
      [steps[index], steps[target]] = [steps[target], steps[index]];
      return { ...current, steps: steps.map((step, stepIndex) => ({ ...step, step_order: stepIndex + 1 })) };
    });
  }

  async function saveArticle(event) {
    event.preventDefault();
    setSaving(true);
    setToast(null);
    try {
      const method = draft.id ? "PATCH" : "POST";
      const url = draft.id ? `/api/knowledge/${draft.id}` : "/api/knowledge";
      const saved = await readApi(await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft)
      }));
      setDraft(JSON.parse(JSON.stringify(saved)));
      setSelectedId(saved.id);
      setSelectedArticle(saved);
      setAdminMode(true);
      setToast({ type: "success", text: "教學已儲存" });
      await loadArticles(true);
    } catch (error) {
      setToast({ type: "error", text: safeErrorMessage(error, "教學儲存失敗") });
    } finally {
      setSaving(false);
    }
  }

  async function quickStatus(status) {
    if (!selectedArticle) return;
    try {
      const saved = await readApi(await fetch(`/api/knowledge/${selectedArticle.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...selectedArticle, status })
      }));
      setSelectedArticle(saved);
      await loadArticles(true);
      setToast({ type: "success", text: status === "published" ? "教學已發布" : "教學已封存" });
    } catch (error) {
      setToast({ type: "error", text: safeErrorMessage(error, "狀態更新失敗") });
    }
  }

  async function deleteArticle() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await readApi(await fetch(`/api/knowledge/${deleteTarget.id}`, { method: "DELETE" }));
      setSelectedId("");
      setSelectedArticle(null);
      setDeleteTarget(null);
      setMobileView("list");
      await loadArticles(true);
      setToast({ type: "success", text: "教學與相關圖片已刪除" });
    } catch (error) {
      setToast({ type: "error", text: safeErrorMessage(error, "教學刪除失敗") });
    } finally {
      setDeleting(false);
    }
  }

  async function uploadImage(event, stepId) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !draft?.id) return;
    setUploadingId(stepId);
    setToast(null);
    try {
      const compressed = await compressKnowledgeImage(file);
      const formData = new FormData();
      formData.set("file", compressed);
      formData.set("step_id", stepId);
      formData.set("alt_text", file.name.replace(/\.[^.]+$/, ""));
      await readApi(await fetch(`/api/knowledge/${draft.id}/assets`, { method: "POST", body: formData }));
      const fresh = await readApi(await fetch(`/api/knowledge/${draft.id}?includeDrafts=1`, { cache: "no-store" }));
      setDraft(JSON.parse(JSON.stringify(fresh)));
      setSelectedArticle(fresh);
      setToast({ type: "success", text: "圖片已上傳" });
    } catch (error) {
      setToast({ type: "error", text: safeErrorMessage(error, "圖片上傳失敗") });
    } finally {
      setUploadingId("");
    }
  }

  async function deleteAsset(assetId) {
    if (!draft?.id) return;
    try {
      await readApi(await fetch(`/api/knowledge/${draft.id}/assets?assetId=${encodeURIComponent(assetId)}`, { method: "DELETE" }));
      const fresh = await readApi(await fetch(`/api/knowledge/${draft.id}?includeDrafts=1`, { cache: "no-store" }));
      setDraft(JSON.parse(JSON.stringify(fresh)));
      setSelectedArticle(fresh);
      setToast({ type: "success", text: "圖片已刪除" });
    } catch (error) {
      setToast({ type: "error", text: safeErrorMessage(error, "圖片刪除失敗") });
    }
  }

  return (
    <section className="section-page incident-page knowledge-page">
      <header className="incident-page-head knowledge-page-head">
        <div>
          <div className="breadcrumb">IT 管理 / 故障知識庫</div>
          <h1>故障知識庫 / 教學手冊</h1>
          <p>集中管理故障排除與內部系統教學，圖片以短效 signed URL 顯示。</p>
        </div>
        <div className="knowledge-actions">
          <button type="button" onClick={() => setAdminMode((value) => !value)}>
            {adminMode ? "一般閱讀" : "管理模式"}
          </button>
          {adminMode ? <button className="primary-action" type="button" onClick={openCreate}>新增教學</button> : null}
        </div>
      </header>

      <div className={`incident-filter-panel knowledge-filter-panel ${adminMode ? "has-status" : "without-status"}`}>
        <input value={filters.query} onChange={(event) => updateFilter("query", event.target.value)} placeholder="搜尋標題、現象、原因、摘要或關鍵字" />
        <select value={filters.category} onChange={(event) => updateFilter("category", event.target.value)}>
          <option value="">全部分類</option>
          {categories.map((category) => <option key={category} value={category}>{category}</option>)}
        </select>
        <select value={filters.system} onChange={(event) => updateFilter("system", event.target.value)}>
          <option value="">全部系統</option>
          {systems.map((system) => <option key={system} value={system}>{system}</option>)}
        </select>
        {adminMode ? (
          <select value={filters.status} onChange={(event) => updateFilter("status", event.target.value)}>
            <option value="">全部狀態</option>
            <option value="draft">草稿</option>
            <option value="published">已發布</option>
            <option value="archived">已封存</option>
          </select>
        ) : null}
        <span>{loading ? "讀取中..." : `${articles.length.toLocaleString("en-US")} 篇`}</span>
      </div>

      <div className={`knowledge-layout is-${mobileView}-view`}>
        <ArticleList rows={articles} selectedId={selectedId} onSelect={selectArticle} listRef={listRef} />
        <ArticleViewer
          article={selectedArticle}
          adminMode={adminMode}
          onBack={returnToList}
          onEdit={openEdit}
          onDelete={() => setDeleteTarget(selectedArticle)}
          onStatus={quickStatus}
          onOpenImage={setLightboxAsset}
        />
      </div>

      {editorOpen && draft ? (
        <ArticleEditor
          draft={draft}
          setDraft={setDraft}
          saving={saving}
          uploadingId={uploadingId}
          onClose={() => setEditorOpen(false)}
          onSave={saveArticle}
          onUpload={uploadImage}
          onDeleteAsset={deleteAsset}
          onMoveStep={moveStep}
        />
      ) : null}
      <KnowledgeToast toast={toast} onClose={() => setToast(null)} />
      <KnowledgeLightbox asset={lightboxAsset} onClose={() => setLightboxAsset(null)} />
      <DeleteArticleDialog
        article={deleteTarget}
        deleting={deleting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={deleteArticle}
      />
    </section>
  );
}
