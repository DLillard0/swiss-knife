import { defineManifest } from "@crxjs/vite-plugin";

const ICONS = {
  16: "icons/icon-16.png",
  48: "icons/icon-48.png",
  128: "icons/icon-128.png"
};

export default defineManifest({
  manifest_version: 3,
  name: "Swiss Knife",
  description: "自定义网页 AI 工具的 Chrome 扩展脚手架。",
  version: "0.1.0",
  action: {
    default_icon: ICONS,
    default_title: "Swiss Knife",
    default_popup: "src/extension/popup/index.html"
  },
  options_ui: {
    page: "src/extension/options/index.html",
    open_in_tab: true
  },
  background: {
    service_worker: "src/extension/background.ts",
    type: "module"
  },
  icons: ICONS,
  permissions: ["activeTab", "scripting", "storage"],
  host_permissions: ["<all_urls>"],
  commands: {
    "toggle-toolbar": {
      suggested_key: {
        default: "Ctrl+Shift+K",
        mac: "Command+Shift+K"
      },
      description: "打开/关闭 Swiss Knife 工具栏"
    }
  },
  content_scripts: [
    {
      matches: ["<all_urls>"],
      js: ["src/extension/content-script.tsx"],
      run_at: "document_idle"
    }
  ],
  web_accessible_resources: [
    {
      resources: ["src/extension/popup/index.html"],
      matches: ["<all_urls>"]
    },
    {
      // Shadow DOM 内注入的 KaTeX CSS 通过 chrome-extension:// 绝对地址
      // 加载字体文件，需要把字体加入 web_accessible_resources 才能被宿主页
      // 作为 <font-face> 的 src 拉取。
      resources: ["assets/KaTeX_*"],
      matches: ["<all_urls>"]
    }
  ]
});
