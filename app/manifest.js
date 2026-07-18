export default function manifest() {
  return {
    id: "/",
    name: "太魯閣 IT 儀表板",
    short_name: "太魯閣 IT",
    description: "工作、巡檢、設備與通知管理平台",
    lang: "zh-Hant-TW",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#f4f7fb",
    theme_color: "#173f6b",
    icons: [
      {
        src: "/pwa-icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any"
      },
      {
        src: "/pwa-icon-maskable.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable"
      }
    ],
    shortcuts: [
      {
        name: "新增工作",
        short_name: "新增工作",
        url: "/work?voice=1",
        icons: [{ src: "/pwa-icon.svg", sizes: "any", type: "image/svg+xml" }]
      },
      {
        name: "開始巡檢",
        short_name: "巡檢",
        url: "/inspections/new",
        icons: [{ src: "/pwa-icon.svg", sizes: "any", type: "image/svg+xml" }]
      },
      {
        name: "通知中心",
        short_name: "通知",
        url: "/notifications",
        icons: [{ src: "/pwa-icon.svg", sizes: "any", type: "image/svg+xml" }]
      }
    ]
  };
}
