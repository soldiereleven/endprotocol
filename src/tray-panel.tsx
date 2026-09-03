import React from "react";
import ReactDOM from "react-dom/client";
import { TrayPanel } from "./components/tray-panel";
import "./styles/globals.css";
import "aura-glass/tokens/css";
import { getConfig } from "./utils/configService";
import { listen } from "@tauri-apps/api/event";

type ThemeMode = "light" | "dark" | "system";

function applyTheme(mode: ThemeMode) {
  const root = document.documentElement;
  const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const isDark = mode === "dark" || (mode === "system" && systemDark);
  root.classList.toggle("dark", isDark);
  root.setAttribute("data-aura-mode", isDark ? "dark" : "light");
}

async function initTheme() {
  const mode = await getConfig<ThemeMode>("theme_mode");
  applyTheme(mode ?? "system");

  listen<ThemeMode>("theme-changed", (event) => {
    applyTheme(event.payload);
  });
}

initTheme();

ReactDOM.createRoot(document.getElementById("tray-panel-root")!).render(
  <React.StrictMode>
    <TrayPanel />
  </React.StrictMode>
);
