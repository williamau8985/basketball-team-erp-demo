"use client";


const STORAGE_KEY = "hooperp.timeline.currentWeek";
const WEEK_PREFIX = "Week ";
export const MAX_WEEK = 5;

let initialized = false;
let currentWeek = 1;
const listeners = new Set<() => void>();

function loadFromStorage() {
  if (initialized) return;
  initialized = true;
  if (typeof window === "undefined") {
    return;
  }

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return;
    }
    const parsed = Number.parseInt(stored, 10);
    if (Number.isFinite(parsed) && parsed > 0) {
      currentWeek = parsed;
    }
  } catch (error) {
    console.warn("Failed to load timeline state:", error);
  }
}

function persistToStorage() {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(STORAGE_KEY, String(currentWeek));
  } catch (error) {
    console.warn("Failed to persist timeline state:", error);
  }
}

function setWeekInternal(week: number) {
  const normalized = Number.isFinite(week)
    ? Math.min(MAX_WEEK, Math.max(1, Math.round(week)))
    : 1;
  if (normalized === currentWeek) {
    return;
  }
  currentWeek = normalized;
  persistToStorage();
  listeners.forEach(listener => listener());
}

export function getCurrentWeek(): number {
  loadFromStorage();
  return currentWeek;
}

export function setCurrentWeek(week: number): number {
  loadFromStorage();
  setWeekInternal(week);
  return currentWeek;
}

export function advanceWeek(): number {
  loadFromStorage();
  setWeekInternal(currentWeek + 1);
  return currentWeek;
}

export function subscribe(listener: () => void): () => void {
  loadFromStorage();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function parseWeekLabel(value: string | number | null | undefined): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(1, Math.round(value));
  }
  if (typeof value === "string") {
    const match = value.match(/\d+/);
    if (match) {
      const parsed = Number.parseInt(match[0] ?? "1", 10);
      if (Number.isFinite(parsed) && parsed > 0) {
        return parsed;
      }
    }
  }
  return 1;
}

export function formatWeekLabel(week: number): string {
  const normalized = Math.max(1, Math.round(week));
  return `${WEEK_PREFIX}${normalized}`;
}

export function ensureWeekLabel(value: string | number | null | undefined): string {
  return formatWeekLabel(parseWeekLabel(value));
}

export function addWeeks(value: string | number | null | undefined, weeksToAdd: number): string {
  const base = parseWeekLabel(value);
  const adjusted = Math.max(1, base + Math.round(weeksToAdd));
  return formatWeekLabel(adjusted);
}

export function compareWeekLabels(a: string | null | undefined, b: string | null | undefined): number {
  const weekA = parseWeekLabel(a);
  const weekB = parseWeekLabel(b);
  return weekA - weekB;
}

export const WEEK_LABEL_SQL_EXTRACT = "CAST(REPLACE(%COLUMN%, 'Week ', '') AS INTEGER)";

export function weekOrderingSql(column: string, direction: "ASC" | "DESC" = "ASC"): string {
  const extractor = WEEK_LABEL_SQL_EXTRACT.replace(/%COLUMN%/g, column);
  return `${extractor} ${direction}`;
}
