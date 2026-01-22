import { Puzzle, Sparkles, Zap } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { SkMessage } from "../shared/messages";

const roadmap = [
  {
    title: "连接 AI SDK",
    description: "准备好 provider 与消息流，后续将接入页面数据。",
    icon: Sparkles
  },
  {
    title: "页面采集层",
    description: "在 content-script 中收集、清洗页面上下文并传递给 AI。",
    icon: Puzzle
  },
  {
    title: "工具编排",
    description: "在后台或 popup 配置工具清单，统一调度和权限控制。",
    icon: Zap
  }
];

export default function App() {
  const openToolbar = async () => {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (!tab?.id) return;
    chrome.tabs.sendMessage(tab.id, { type: "SK_TOGGLE_TOOLBAR" } satisfies SkMessage);
    window.close();
  };

  const openOptions = () => {
    chrome.runtime.openOptionsPage();
    window.close();
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 to-white px-4 py-6 text-slate-900">
      <section className="mx-auto flex max-w-md flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
              Swiss Knife
            </p>
            <h1 className="mt-2 text-xl font-semibold text-slate-900">
              AI 工具箱脚手架
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Popup、Background、Content Script 已就绪，可直接开始接入。
            </p>
          </div>
          <div className="h-10 w-10 rounded-full bg-slate-900 text-white shadow-md ring-4 ring-slate-100">
            <div className="flex h-full items-center justify-center text-sm font-semibold">
              AI
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            下一步
          </p>
          <ul className="mt-3 space-y-3">
            {roadmap.map((item) => (
              <li
                key={item.title}
                className="flex items-start gap-3 rounded-lg bg-white/60 p-3 ring-1 ring-slate-200"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-white shadow-sm">
                  <item.icon className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    {item.title}
                  </p>
                  <p className="text-sm text-slate-600">{item.description}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-col gap-2 rounded-xl border border-dashed border-slate-200 p-4">
          <p className="text-sm font-semibold text-slate-900">
            调试建议
          </p>
          <p className="text-sm text-slate-600">
            1) 在 Chrome 开发者模式加载 dist，2) 通过 popup 点击“打开演示面板”
            挂载 content-script，3) 打开 devtools 观察日志。
          </p>
          <div className="flex gap-2">
            <Button size="default" onClick={openToolbar}>
              打开工具栏
            </Button>
            <Button variant="secondary" size="default" onClick={openOptions}>
              打开选项页
            </Button>
          </div>
        </div>
      </section>
    </main>
  );
}
