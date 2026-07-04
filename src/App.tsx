import { Route, Routes } from "react-router-dom";

import DashboardPage from "@/pages/dashboard";
import SettingsPage from "@/pages/settings";
import DeveloperPage from "@/pages/developer";
import AccountPage from "@/pages/account";
import CharactersPage from "@/pages/characters";
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
      <Route
        element={
          <DashboardLayout>
            <CharactersPage />
          </DashboardLayout>
        }
        path="/characters"
      />
      <Route
        element={
          <DashboardLayout>
            <DeveloperPage />
          </DashboardLayout>
        }
        path="/developer"
      />
    </Routes>
  );
}

export default App;
