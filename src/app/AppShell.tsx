// src/app/AppShell.tsx
import { ReactNode } from "react";
import { Bell, Settings, Search, User, Database, CalendarClock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { navItems } from "./nav";
import type { NavSection } from "@/types/erp";
import { useTimeline } from "@/hooks/useTimeline";
import { useAccounting } from "@/hooks/useAccounting";
import { useDatabase } from "@/hooks/useDatabase";

interface AppShellProps {
  section: NavSection;
  setSection: (s: NavSection) => void;
  children: ReactNode;
}

export default function AppShell({ section, setSection, children }: AppShellProps) {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar section={section} setSection={setSection} />
        <SidebarInset className="flex-1">
          <TopNav />
          <main className="flex-1 p-8 pt-4">
            {children}
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}

interface AppSidebarProps {
  section: NavSection;
  setSection: (s: NavSection) => void;
}

function AppSidebar({ section, setSection }: AppSidebarProps) {
  const { currentWeek, currentWeekLabel, advanceWeek, setWeek, maxWeek } = useTimeline();
  const accounting = useAccounting();
  const { resetDatabase } = useDatabase();

  const handleAdvanceWeek = () => {
    if (currentWeek >= maxWeek) {
      if (typeof window !== "undefined") {
        window.alert(`Week ${maxWeek} is the final week available in this build. Starting over from Week 1.`);
      }
      setWeek(1);
      if (resetDatabase) {
        void resetDatabase();
      }
      return;
    }

    if (accounting.finalizeTicketWeek) {
      try {
        accounting.finalizeTicketWeek(currentWeek);
      } catch (error) {
        console.error("Failed to finalize ticket revenue for week", currentWeek, error);
      }
    }

    advanceWeek();
  };

  return (
    <Sidebar variant="inset">
      <SidebarHeader>
        <div className="flex items-center gap-2 px-4 py-2">
          <h1 className="text-xl font-bold text-gray-900">HoopERP</h1>
          <Badge variant="secondary" className="bg-green-100 text-green-700">
            Live Database
          </Badge>
        </div>
      </SidebarHeader>
      
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = section === item.id;
                
                return (
                  <SidebarMenuItem key={item.id}>
                    <SidebarMenuButton
                      onClick={() => setSection(item.id)}
                      isActive={isActive}
                      tooltip={item.label}
                    >
                      <Icon className="w-4 h-4" />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <div className="mx-4 mb-4 space-y-3">
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 shadow-sm">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <CalendarClock className="h-4 w-4 text-blue-600" />
                <div>
                  <p className="text-xs uppercase tracking-wide text-blue-600">Simulated Timeline</p>
                  <p className="text-sm font-semibold text-blue-900">{currentWeekLabel}</p>
                </div>
              </div>
              <Button size="sm" onClick={handleAdvanceWeek} className="bg-blue-600 text-white hover:bg-blue-700">
                Next Week
              </Button>
            </div>
            <p className="mt-3 text-xs text-blue-700">
              Progress through seasons manually to explore how operations evolve week over week.
            </p>
          </div>

          <div className="p-4 bg-green-50 rounded-lg border border-green-200">
            <div className="flex items-center gap-2 mb-2">
              <Database className="w-4 h-4 text-green-600" />
              <span className="text-sm font-medium text-green-800">Database Status</span>
            </div>
            <p className="text-xs text-green-600">
            ✅ SQLite database active
            <br />
            🔒 Data persisted locally
            </p>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}

function TopNav() {
  return (
    <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
      <SidebarTrigger className="-ml-1" />
      <div className="flex flex-1 items-center justify-end gap-4">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search..."
            className="pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <Button variant="ghost" size="sm">
          <Bell className="w-4 h-4" />
        </Button>
        <Button variant="ghost" size="sm">
          <Settings className="w-4 h-4" />
        </Button>
        <Avatar>
          <AvatarFallback className="bg-gray-100 text-gray-700">
            <User className="w-4 h-4" />
          </AvatarFallback>
        </Avatar>
      </div>
    </header>
  );
}