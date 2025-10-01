// src/components/layout/TopNav.tsx
import { Bell, Settings, Search, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export default function TopNav() {
  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200">
      <div className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold text-gray-900">HoopERP</h1>
          <Badge variant="secondary" className="bg-green-100 text-green-700">Live Database</Badge>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search..."
              className="pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <Button variant="ghost" size="sm"><Bell className="w-4 h-4" /></Button>
          <Button variant="ghost" size="sm"><Settings className="w-4 h-4" /></Button>
          <Avatar><AvatarFallback className="bg-gray-100 text-gray-700"><User className="w-4 h-4" /></AvatarFallback></Avatar>
        </div>
      </div>
    </div>
  );
  
}
