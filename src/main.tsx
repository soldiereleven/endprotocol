import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import App from "./App.tsx";
import { Provider } from "./provider.tsx";
import "@/styles/globals.css";
import { setInitialLanguage } from "./i18n";
import { getConfig } from "./utils/configService";
import { CardStartupService } from "@/cards/startup-service";
import { loadAllCards } from "@/components/cards/registry/loader";
import logger from "@/utils/logger";

// Initialize language from config service before rendering
getConfig<string>("app.language").then((savedLang) => {
  const lng = savedLang || (navigator.language.startsWith("zh") ? "zh" : "en");
  setInitialLanguage(lng);

  logger.info("Tauri interop ready", "Main");

  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <BrowserRouter>
        <Provider>
          <App />
        </Provider>
      </BrowserRouter>
    </React.StrictMode>,
  );

  // Build card registry to register startup handlers, then run startup tasks
  loadAllCards();
  setTimeout(() => {
    CardStartupService.runAll();
  }, 0);
});
