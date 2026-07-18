"use client";

import { useEffect, useState } from "react";

const INSTALL_DISMISS_KEY = "taroko-pwa-install-dismissed";

function isStandalone() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
}

function isIosDevice() {
  if (typeof window === "undefined") return false;
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}

export default function PwaManager() {
  const [installPrompt, setInstallPrompt] = useState(null);
  const [showIosHelp, setShowIosHelp] = useState(false);
  const [online, setOnline] = useState(true);

  useEffect(() => {
    setOnline(window.navigator.onLine);

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch((error) => {
        console.error("[PWA] Service worker registration failed", error);
      });
    }

    function handleBeforeInstall(event) {
      event.preventDefault();
      if (window.localStorage.getItem(INSTALL_DISMISS_KEY) === "1") return;
      setInstallPrompt(event);
    }

    function handleInstalled() {
      setInstallPrompt(null);
      setShowIosHelp(false);
      window.localStorage.removeItem(INSTALL_DISMISS_KEY);
    }

    function handleOnline() {
      setOnline(true);
    }

    function handleOffline() {
      setOnline(false);
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    window.addEventListener("appinstalled", handleInstalled);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    if (!isStandalone() && isIosDevice() && window.localStorage.getItem(INSTALL_DISMISS_KEY) !== "1") {
      setShowIosHelp(true);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
      window.removeEventListener("appinstalled", handleInstalled);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  async function installApp() {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome !== "accepted") window.localStorage.setItem(INSTALL_DISMISS_KEY, "1");
    setInstallPrompt(null);
  }

  function dismissInstall() {
    window.localStorage.setItem(INSTALL_DISMISS_KEY, "1");
    setInstallPrompt(null);
    setShowIosHelp(false);
  }

  return (
    <>
      {!online ? (
        <div className="pwa-offline-indicator" role="status">
          <span aria-hidden="true">●</span>
          目前離線，巡檢內容仍會自動暫存在這台裝置
        </div>
      ) : null}

      {installPrompt || showIosHelp ? (
        <aside className="pwa-install-card" aria-label="加入手機桌面">
          <div className="pwa-install-icon" aria-hidden="true">T</div>
          <div>
            <strong>加入手機桌面</strong>
            <p>
              {showIosHelp
                ? "請在 Safari 點「分享」，再選「加入主畫面」。"
                : "安裝後可像 App 一樣直接開啟太魯閣 IT 儀表板。"}
            </p>
          </div>
          {installPrompt ? <button type="button" onClick={installApp}>立即安裝</button> : null}
          <button className="pwa-install-dismiss" type="button" aria-label="稍後再說" onClick={dismissInstall}>×</button>
        </aside>
      ) : null}
    </>
  );
}
