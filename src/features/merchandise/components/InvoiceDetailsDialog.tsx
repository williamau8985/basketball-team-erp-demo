import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

import type {
  MerchandiseInvoice,
  MerchandiseSalesOrder,
  MerchandiseSalesOrderLine,
} from "@/types/erp";

import { currencyFormatter, formatDate } from "../utils";
import { StatusBadge } from "./StatusBadge";

interface InvoiceDetailsDialogProps {
  open: boolean;
  invoice: MerchandiseInvoice | null;
  order: MerchandiseSalesOrder | null;
  lines: MerchandiseSalesOrderLine[];
  onOpenChange: (open: boolean) => void;
}

export function InvoiceDetailsDialog({
  open,
  invoice,
  order,
  lines,
  onOpenChange,
}: InvoiceDetailsDialogProps) {
  if (!invoice || !order) {
    return null;
  }

  const subtotal = lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl border-none bg-transparent p-0 sm:max-w-5xl">
        <div className="flex flex-col gap-8 rounded-xl border border-slate-200 bg-white p-8 shadow-2xl">
          <DialogHeader className="space-y-4 p-0">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-2">
                <DialogTitle className="text-2xl font-semibold text-slate-900">{invoice.invoiceCode}</DialogTitle>
                <DialogDescription className="max-w-xl text-sm text-slate-500">
                  Billing summary for sales order {order.orderCode}. Review the simulated invoice details below.
                </DialogDescription>
              </div>
              <div className="rounded-lg bg-emerald-50 px-4 py-3 text-right">
                <div className="text-xs uppercase tracking-wide text-emerald-700">Balance Due</div>
                <div className="text-xl font-semibold text-emerald-900">
                  {currencyFormatter.format(invoice.amount)}
                </div>
              </div>
            </div>
          </DialogHeader>

          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-1 text-sm">
              <div className="text-xs uppercase tracking-wide text-slate-500">From</div>
              <div className="font-medium text-slate-900">Basketball Club Headquarters</div>
              <div className="text-slate-600">Montreal, Ville Marie</div>
              <div className="text-slate-600">Canada</div>
            </div>
            <div className="space-y-1 text-sm md:text-right">
              <div className="text-xs uppercase tracking-wide text-slate-500">Bill To</div>
              <div className="font-medium text-slate-900">{order.storeName}</div>
              <div className="text-slate-600">Tier {order.storeTier}</div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-lg bg-slate-50 p-4 text-sm">
              <div className="text-xs uppercase tracking-wide text-slate-500">Issued</div>
              <div className="mt-1 font-medium text-slate-900">{formatDate(invoice.issuedDate)}</div>
            </div>
            <div className="rounded-lg bg-slate-50 p-4 text-sm">
              <div className="text-xs uppercase tracking-wide text-slate-500">Due</div>
              <div className="mt-1 font-medium text-slate-900">{formatDate(invoice.dueDate)}</div>
            </div>
            <div className="rounded-lg bg-slate-50 p-4 text-sm">
              <div className="text-xs uppercase tracking-wide text-slate-500">Status</div>
              <div className="mt-2">
                <StatusBadge label={invoice.status} variant={getInvoiceVariant(invoice.status)} />
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-slate-900">Line Items</h3>
            <div className="mt-4 overflow-hidden rounded-lg border border-slate-200">
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="px-4 py-2">Item</th>
                    <th className="px-4 py-2">Quantity</th>
                    <th className="px-4 py-2">Unit Price</th>
                    <th className="px-4 py-2 text-right">Line Total</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map(line => (
                    <tr key={line.id} className="border-t border-slate-200 text-slate-700">
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900">{line.itemName}</div>
                        <div className="text-xs text-slate-500">{line.itemSku}</div>
                      </td>
                      <td className="px-4 py-3">{line.quantity}</td>
                      <td className="px-4 py-3">{currencyFormatter.format(line.unitPrice)}</td>
                      <td className="px-4 py-3 text-right font-medium text-slate-900">
                        {currencyFormatter.format(line.quantity * line.unitPrice)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex flex-col items-end gap-2 text-sm text-slate-600">
              <div className="flex w-full max-w-xs items-center justify-between">
                <span>Subtotal</span>
                <span className="font-medium text-slate-900">{currencyFormatter.format(subtotal)}</span>
              </div>
              <div className="flex w-full max-w-xs items-center justify-between">
                <span>Freight</span>
                <span className="font-medium text-slate-900">{currencyFormatter.format(0)}</span>
              </div>
              <div className="flex w-full max-w-xs items-center justify-between text-base">
                <span className="font-semibold text-slate-900">Total Due</span>
                <span className="font-semibold text-slate-900">{currencyFormatter.format(invoice.amount)}</span>
              </div>
            </div>
          </div>

          <div className="rounded-lg bg-slate-50 p-4 text-xs text-slate-500">
            This invoice reflects a simulated receivable for the merchandise workflow timeline.
          </div>

          <DialogFooter className="flex flex-col gap-3 border-t border-slate-200 pt-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-xs text-slate-500">Montreal, Ville Marie • Demonstration Finance Record</div>
            <Button onClick={() => onOpenChange(false)}>Close</Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function getInvoiceVariant(status: MerchandiseInvoice["status"]) {
  switch (status) {
    case "Paid":
      return "outline" as const;
    case "Overdue":
      return "destructive" as const;
    case "Unpaid":
    default:
      return "secondary" as const;
  }
}
