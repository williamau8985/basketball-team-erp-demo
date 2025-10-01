// src/app/nav.ts
import { Home, DollarSign, Calendar, Users, Landmark } from "lucide-react";
import type { NavSection } from "@/types/erp";

export const navItems: Array<{ id: NavSection; label: string; icon: any }> = [
  { id: "dashboard", label: "Dashboard", icon: Home },
  { id: "merchandise", label: "Merchandise", icon: DollarSign },
  { id: "ticketing", label: "Ticketing", icon: Calendar },
  { id: "roster", label: "Roster", icon: Users },
  { id: "accounting", label: "Accounting", icon: Landmark },
];
