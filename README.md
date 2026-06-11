# 資訊室智慧平台 Vercel Dashboard

第一階段 Vercel 版首頁，只搬每天最常用、最需要速度的功能：

- Dashboard KPI
- Todo List
- 快速備忘錄
- 最近工作紀錄
- 近 7 日新增工作
- 舊 Apps Script 功能入口連結

舊 Apps Script 仍保留，先不拆：

- LINE webhook
- Google Sheet 同步
- 送交單據紀錄
- 通訊錄
- 設備 / 合約 / SOP / 密碼等舊頁面

## 必要環境變數

在 Vercel Project Settings -> Environment Variables 設定：

```env
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
NEXT_PUBLIC_APPS_SCRIPT_URL=https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec
```

注意：

- `SUPABASE_SERVICE_ROLE_KEY` 只放在 Vercel 後端環境變數，不要放進前端。
- `NEXT_PUBLIC_APPS_SCRIPT_URL` 只是舊功能跳轉連結，可以公開。

## 本機開發

```powershell
npm install
npm run dev
```

## Build 驗證

```powershell
npm run build
```

## Supabase

如果快速備忘錄沒有資料表，先在 Supabase SQL Editor 執行：

```text
../supabase_quick_notes.sql
```
