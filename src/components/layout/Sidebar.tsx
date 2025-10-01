// src/components/layout/Sidebar.tsx
import { Database } from "lucide-react";
import { navItems } from "@/app/nav";
import type { NavSection } from "@/types/erp";

export default function Sidebar({ active, onChange }: { active: NavSection; onChange: (s: NavSection) => void; }) {
  return (
    <aside className="w-64 bg-white border-r border-gray-200 fixed left-0 top-16 bottom-0 overflow-y-auto">
      <div className="p-6">
        <nav className="space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = active === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onChange(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
                  isActive ? "bg-blue-50 text-blue-700 border border-blue-200" : "text-gray-700 hover:bg-gray-50"
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="font-medium">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="mt-8 p-4 bg-green-50 rounded-lg border border-green-200">
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
    </aside>
  );
}
