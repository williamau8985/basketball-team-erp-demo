import { AlertTriangle, CircleDollarSign, ClipboardList, FileText, Package } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import type { MerchandiseInvoice } from "@/types/erp";

import { compareWeekLabels } from "@/lib/timeline";

import { buildAgingSummary, currencyFormatter, formatDate, weeksUntil } from "../utils";
import { MetricCard } from "./MetricCard";
import { StatusBadge } from "./StatusBadge";

interface FinanceTabProps {
  invoices: MerchandiseInvoice[];
  outstanding: MerchandiseInvoice[];
  onMarkPaid: (invoiceId: number) => Promise<void> | void;
  onViewInvoice: (invoice: MerchandiseInvoice) => void;
}

export function FinanceTab({ invoices, outstanding, onMarkPaid, onViewInvoice }: FinanceTabProps) {
  const overdueCount = outstanding.filter(invoice => invoice.status === "Overdue").length;
  const nextDue = outstanding
    .filter(invoice => invoice.status !== "Overdue")
    .sort((a, b) => compareWeekLabels(a.dueDate, b.dueDate))[0];

  const agingSummary = buildAgingSummary(outstanding);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Outstanding Balance"
          value={currencyFormatter.format(outstanding.reduce((sum, invoice) => sum + invoice.amount, 0))}
          subText={`${outstanding.length} invoices awaiting payment`}
          icon={<CircleDollarSign className="h-5 w-5 text-emerald-500" />}
        />
        <MetricCard
          title="Overdue"
          value={overdueCount.toString()}
          subText="Requires escalation"
          icon={<AlertTriangle className="h-5 w-5 text-rose-500" />}
        />
        <MetricCard
          title="Next Due"
          value={nextDue ? formatDate(nextDue.dueDate) : "—"}
          subText={nextDue ? nextDue.storeName : "No upcoming invoices"}
          icon={<ClipboardList className="h-5 w-5 text-slate-600" />}
        />
        <MetricCard
          title="Aging 60+"
          value={currencyFormatter.format(agingSummary.over60)}
          subText="At risk receivables"
          icon={<Package className="h-5 w-5 text-indigo-500" />}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg text-gray-900">Accounts Receivable</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-gray-500">
                <th className="py-2 pr-4">Invoice</th>
                <th className="py-2 pr-4">Store</th>
                <th className="py-2 pr-4">Order</th>
                <th className="py-2 pr-4">Amount</th>
                <th className="py-2 pr-4">Issued</th>
                <th className="py-2 pr-4">Due</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2 pr-4">Aging</th>
                <th className="py-2 pr-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map(invoice => {
                const weeks = weeksUntil(invoice.dueDate);
                const overdue = weeks < 0;
                return (
                  <tr key={invoice.id} className="border-t border-gray-200">
                    <td className="py-2 pr-4">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="group h-auto justify-start gap-2 rounded-md px-0 py-1 text-sm font-semibold text-emerald-700 hover:text-emerald-900"
                        onClick={() => onViewInvoice(invoice)}
                      >
                        <FileText className="h-4 w-4 text-emerald-500 transition group-hover:text-emerald-600" />
                        <span>{invoice.invoiceCode}</span>
                        <span className="ml-1 text-xs font-medium text-emerald-500 transition group-hover:text-emerald-600">
                          View
                        </span>
                      </Button>
                    </td>
                    <td className="py-2 pr-4 text-gray-700">{invoice.storeName}</td>
                    <td className="py-2 pr-4 text-gray-700">{invoice.orderId}</td>
                    <td className="py-2 pr-4 font-medium text-gray-900">
                      {currencyFormatter.format(invoice.amount)}
                    </td>
                    <td className="py-2 pr-4">{formatDate(invoice.issuedDate)}</td>
                    <td className="py-2 pr-4">{formatDate(invoice.dueDate)}</td>
                    <td className="py-2 pr-4">
                      <StatusBadge
                        label={invoice.status}
                        variant={
                          invoice.status === "Paid"
                            ? "outline"
                            : invoice.status === "Overdue"
                              ? "destructive"
                              : "default"
                        }
                      />
                    </td>
                    <td className="py-2 pr-4 text-xs text-gray-600">
                      {overdue
                        ? `${Math.abs(weeks)} week${Math.abs(weeks) === 1 ? "" : "s"} overdue`
                        : `Due in ${weeks} week${weeks === 1 ? "" : "s"}`}
                    </td>
                    <td className="py-2 pr-4 text-right">
                      {invoice.status !== "Paid" ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => void onMarkPaid(invoice.id)}
                        >
                          Mark Paid
                        </Button>
                      ) : (
                        <span className="text-xs text-gray-400">Settled</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg text-gray-900">Aging Buckets</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <AgingPill label="Current" amount={agingSummary.current} />
          <AgingPill label="1-4 weeks" amount={agingSummary.over30} />
          <AgingPill label="5-8 weeks" amount={agingSummary.over45} />
          <AgingPill label="8+ weeks" amount={agingSummary.over60} />
        </CardContent>
      </Card>
    </div>
  );
}

function AgingPill({ label, amount }: { label: string; amount: number }) {
  return (
    <div className="rounded-lg border border-gray-200 p-4">
      <p className="text-xs uppercase tracking-wide text-gray-500">{label}</p>
      <p className="text-lg font-semibold text-gray-900">{currencyFormatter.format(amount)}</p>
    </div>
  );
}
