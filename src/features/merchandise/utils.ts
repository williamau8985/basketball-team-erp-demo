import { addWeeks, ensureWeekLabel, getCurrentWeek, parseWeekLabel } from "@/lib/timeline";
import type { MerchandiseInvoice } from "@/types/erp";

export const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

export function formatDate(date: string | null | undefined): string {
  if (!date) return "—";
  return ensureWeekLabel(date);
}

export function weeksUntil(date: string): number {
  const targetWeek = parseWeekLabel(date);
  const currentWeek = getCurrentWeek();
  return targetWeek - currentWeek;
}

export function addWeeksToLabel(date: string, weeks: number): string {
  return addWeeks(date, weeks);
}

export interface AgingSummary {
  current: number;
  over30: number;
  over45: number;
  over60: number;
}

export function buildAgingSummary(invoices: MerchandiseInvoice[]): AgingSummary {
  const summary: AgingSummary = {
    current: 0,
    over30: 0,
    over45: 0,
    over60: 0,
  };

  invoices.forEach(invoice => {
    const weeks = weeksUntil(invoice.dueDate);
    if (weeks >= 0) {
      summary.current += invoice.amount;
    } else if (weeks >= -4) {
      summary.over30 += invoice.amount;
    } else if (weeks >= -8) {
      summary.over45 += invoice.amount;
    } else {
      summary.over60 += invoice.amount;
    }
  });

  return summary;
}
