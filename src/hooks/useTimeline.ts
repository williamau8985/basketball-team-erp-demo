"use client";

import { useSyncExternalStore } from "react";
import {
  MAX_WEEK,
  advanceWeek,
  formatWeekLabel,
  getCurrentWeek,
  setCurrentWeek,
  subscribe,
} from "@/lib/timeline";

export function useTimeline() {
  const currentWeek = useSyncExternalStore(subscribe, getCurrentWeek, getCurrentWeek);

  return {
    currentWeek,
    currentWeekLabel: formatWeekLabel(currentWeek),
    maxWeek: MAX_WEEK,
    advanceWeek: () => advanceWeek(),
    setWeek: (week: number) => setCurrentWeek(week),
  } as const;
}
