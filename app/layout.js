import "./styles.css";
import "./mobile-dashboard.css";
import "./dashboard-workspace.css";
import { Noto_Sans_TC } from "next/font/google";
import PwaManager from "../components/PwaManager";

const adminSans = Noto_Sans_TC({
  variable: "--font-admin-sans",
  weight: "variable",
  display: "swap",
  preload: false,
  fallback: ["Microsoft JhengHei", "PingFang TC", "Segoe UI", "sans-serif"]
});

export const metadata = {
  title: "資訊管理平台",
  description: "Taroko Hotel IT operations dashboard",
  applicationName: "太魯閣 IT 儀表板",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "太魯閣 IT"
  },
  formatDetection: {
    telephone: false
  },
  robots: {
    index: false,
    follow: false
  }
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#173f6b"
};

export default function RootLayout({ children }) {
  return (
    <html lang="zh-Hant" className={adminSans.variable}>
      <body>
        {children}
        <PwaManager />
      </body>
    </html>
  );
}
