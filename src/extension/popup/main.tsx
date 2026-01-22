import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import App from "./App";
import "@/styles/globals.css";

const container = document.getElementById("root");

if (!container) {
  throw new Error("缺少 #root 节点，无法挂载弹窗应用。");
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>
);
