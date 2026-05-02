import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import App from "./App.tsx";
import { Provider } from "./provider.tsx";
import "@/styles/globals.css";
import { setInitialLanguage } from "./i18n";
import { configService } from "./utils/configService";

// Initialize language from config service before rendering
configService.get<string>("app.language").then((savedLang) => {
  const lng = savedLang || "en";
  setInitialLanguage(lng);

  console.log("Account Interop registration ready");

  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <BrowserRouter>
        <Provider>
          <App />
        </Provider>
      </BrowserRouter>
    </React.StrictMode>,
  );
});
