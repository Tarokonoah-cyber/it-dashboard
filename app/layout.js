import "./styles.css";
import "./mobile-dashboard.css";
import "./dashboard-workspace.css";

export const metadata = {
  title: "資訊管理平台",
  description: "Taroko Hotel IT operations dashboard",
  robots: {
    index: false,
    follow: false
  }
};

export default function RootLayout({ children }) {
  return (
    <html lang="zh-Hant">
      <body>{children}</body>
    </html>
  );
}
