import "./styles.css";
import "./mobile-dashboard.css";
import "./dashboard-workspace.css";
import PwaManager from "../components/PwaManager";

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
    <html lang="zh-Hant">
      <body>
        {children}
        <PwaManager />
      </body>
    </html>
  );
}
