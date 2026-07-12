import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { AccountsPage } from "@/pages/AccountsPage";
import { AccountDetailPage } from "@/pages/AccountDetailPage";
import { PlaceholderPage } from "@/pages/PlaceholderPage";

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<Navigate to="/accounts" replace />} />
        <Route path="/accounts" element={<AccountsPage />} />
        <Route path="/accounts/:id" element={<AccountDetailPage />} />
        <Route
          path="/contacts"
          element={
            <PlaceholderPage
              title="Contacts"
              blurb="People found for each account. Discovery lands here in Phase 2."
            />
          }
        />
        <Route
          path="/network"
          element={
            <PlaceholderPage
              title="Network"
              blurb="People we know — the unlock. The finder reads this before it searches."
            />
          }
        />
        <Route
          path="/leads"
          element={
            <PlaceholderPage
              title="Leads"
              blurb="Prospective lab2scale clients. Ranker agent arrives in Phase 4."
            />
          }
        />
      </Route>
    </Routes>
  );
}
