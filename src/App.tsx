import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { AccountsPage } from "@/pages/AccountsPage";
import { AccountDetailPage } from "@/pages/AccountDetailPage";
import { ContactsPage } from "@/pages/ContactsPage";
import { LeadsPage } from "@/pages/LeadsPage";
import { LoginPage } from "@/pages/LoginPage";
import { useAuth } from "@/auth/AuthProvider";
import { DriveDataProvider } from "@/data/DriveDataProvider";

export default function App() {
  const { status } = useAuth();

  if (status !== "authed") {
    return <LoginPage />;
  }

  return (
    <DriveDataProvider>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<Navigate to="/accounts" replace />} />
          <Route path="/accounts" element={<AccountsPage />} />
          <Route path="/accounts/:id" element={<AccountDetailPage />} />
          <Route path="/contacts" element={<ContactsPage />} />
          <Route path="/leads" element={<LeadsPage />} />
          <Route path="*" element={<Navigate to="/accounts" replace />} />
        </Route>
      </Routes>
    </DriveDataProvider>
  );
}
