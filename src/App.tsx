// src/App.tsx
import { Suspense, lazy, useState } from "react";
import AppShell from "@/app/AppShell";
import { Toaster } from "@/components/ui/sonner";
import type { NavSection } from "@/types/erp";

const Dashboard = lazy(() => import("@/features/dashboard/Dashboard").then(m => ({ default: m.default })));
const Merchandise = lazy(() => import("@/features/merchandise/Merchandise").then(m => ({ default: m.default })));
const Ticketing = lazy(() => import("@/features/ticketing/Ticketing").then(m => ({ default: m.default })));
const Roster = lazy(() => import("@/features/roster/Roster").then(m => ({ default: m.default })));
const Accounting = lazy(() => import("@/features/accounting/Accounting").then(m => ({ default: m.default })));

export default function App() {
  const [section, setSection] = useState<NavSection>("dashboard");

  return (
    <>
      <AppShell section={section} setSection={setSection}>
        <Suspense fallback={
          <div className="flex items-center justify-center min-h-[200px]">
            <div className="text-center text-gray-600">Loading...</div>
          </div>
        }>
          {section === "dashboard" && <Dashboard />}
          {section === "merchandise" && <Merchandise />}
          {section === "ticketing" && <Ticketing />}
          {section === "roster" && <Roster />}
          {section === "accounting" && <Accounting />}
        </Suspense>
      </AppShell>
      <Toaster />
    </>
  );
}