# 太魯閣 IT 資訊管理平台

以 Next.js App Router 建置的內部 IT 營運平台，集中處理工作紀錄、待追蹤事項、巡檢、資產、合約、文件、通知、報表、知識庫與運動賽程等功能。所有 Supabase 存取都經由伺服器端 API，瀏覽器不應取得 service role key。

## 本機啟動

需求：Node.js 20.9 以上。

```powershell
npm install
npm run dev
```

預設本機開發請使用 `localhost` 或 `127.0.0.1`，並使用同一個 `taroko` 帳號登入；本機環境不會繞過登入驗證。請勿把開發伺服器直接暴露到外部網路。

## 必要環境變數

在 `vercel-dashboard/.env.local` 設定；不要提交實際值：

```env
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=replace-with-server-only-key
DASHBOARD_LOGIN_USER=taroko
DASHBOARD_LOGIN_PASSWORD=replace-with-a-strong-password
DASHBOARD_SESSION_SECRET=replace-with-at-least-32-random-characters
```

Dashboard 只有 `taroko` 一個帳號，不使用角色或多使用者權限。登入密碼優先讀取伺服器端 `dashboard_login_credentials` 單筆雜湊資料；資料表尚未建立時，才使用 `DASHBOARD_LOGIN_PASSWORD`。`DASHBOARD_LOGIN_USER` 必須維持為 `taroko`。

選用整合：

- `CRON_SECRET`、`SPORTS_SYNC_SECRET`：排程端點驗證。
- `LINE_CHANNEL_SECRET`、`LINE_CHANNEL_ACCESS_TOKEN`、`LINE_PUSH_USER_ID`、`LINE_ALLOWED_GROUP_ID`：LINE webhook 與通知。
- `IT_DASHBOARD_WEBHOOK_SECRET`：LINE 報修系統簽章。
- `GEMINI_API_KEY`：AI 指令助理。
- `NEXT_PUBLIC_APP_URL`：外部通知中的平台網址；這是唯一預期公開到瀏覽器的設定。

`SUPABASE_SERVICE_ROLE_KEY`、登入密碼、session secret 與 webhook secret 都只能放在伺服器端環境變數。

## 驗證

```powershell
npm test
npm run lint
npm run build
npm audit
```

預設測試使用 mock／fixture，不連正式資料庫或第三方服務。資料匯入、同步與其他 smoke scripts 可能接觸外部環境，不屬於一般本機回歸測試，執行前必須明確確認目標環境。

## 資料庫變更

Supabase migration 位於 `supabase/migrations`。請先在隔離的本機或測試專案驗證 migration、RLS、grants 與 rollback 計畫，再由人工審核後套用；不要直接對正式資料庫試跑。
