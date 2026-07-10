export default function DashboardToast({ toast }) {
  if (!toast) return null;
  return (
    <div className={`dashboard-toast ${toast.tone || "success"}`} role="status" aria-live="polite">
      <span aria-hidden="true" />
      <p>{toast.message}</p>
    </div>
  );
}
