import "./styles.css";

export const metadata = {
  title: "資訊室智慧平台",
  description: "IT daily operations dashboard"
};

export default function RootLayout({ children }) {
  return (
    <html lang="zh-Hant">
      <body>{children}</body>
    </html>
  );
}
