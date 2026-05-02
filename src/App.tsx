import { Route, Routes } from "react-router-dom";

import DashboardPage from "@/pages/dashboard";
import SettingsPage from "@/pages/settings";
import AccountPage from "@/pages/account-new";
import DashboardLayout from "@/layouts/dashboard";

function App() {
  return (
    <Routes>
      <Route
        element={
          <DashboardLayout>
            <DashboardPage />
          </DashboardLayout>
        }
        path="/"
      />
      <Route
        element={
          <DashboardLayout>
            <SettingsPage />
          </DashboardLayout>
        }
        path="/settings"
      />
      <Route
        element={
          <DashboardLayout>
            <AccountPage />
          </DashboardLayout>
        }
        path="/account"
      />
    </Routes>
  );
}

export default App;
