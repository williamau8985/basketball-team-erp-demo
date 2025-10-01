import { Loader2, ShoppingCart } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";

import type { MerchandiseItem } from "@/types/erp";

interface ProcurementRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prioritizedItems: MerchandiseItem[];
  orderQuantities: Record<number, number>;
  onQuantityChange: (itemId: number, value: string) => void;
  onSubmit: () => Promise<void> | void;
  isSubmitting: boolean;
  hasOrderRequests: boolean;
  getAvailableUnits: (item: MerchandiseItem) => number;
  backorderUnitsByItem: Map<number, number>;
}

export function ProcurementRequestDialog({
  open,
  onOpenChange,
  prioritizedItems,
  orderQuantities,
  onQuantityChange,
  onSubmit,
  isSubmitting,
  hasOrderRequests,
  getAvailableUnits,
  backorderUnitsByItem,
}: ProcurementRequestDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Request Procurement Support
          </DialogTitle>
          <DialogDescription>
            Enter the quantities required for each item. Separate purchase orders will be
            created and routed to procurement.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[600px] pr-4">
          <div className="space-y-6">
            {prioritizedItems.map(item => {
              const available = getAvailableUnits(item);
              const incoming = item.incomingStock;
              const quantity = Math.max(0, Math.floor(orderQuantities[item.id] ?? 0));
              const pendingBackorder = backorderUnitsByItem.get(item.id) ?? 0;
              const minimumGap = Math.max(item.minInventoryLevel - (available + incoming), 0);
              const projected = available + incoming + quantity;
              const meetsMinimum = projected >= item.minInventoryLevel;
              const clearsBackorder = quantity >= pendingBackorder;
              const remainingMinimum = Math.max(item.minInventoryLevel - projected, 0);
              const remainingBackorder = Math.max(pendingBackorder - quantity, 0);

              let indicatorText = "Stock at or above minimum.";
              let indicatorClass = "text-emerald-600 bg-emerald-50 border-emerald-200";

              if (quantity === 0 && !meetsMinimum) {
                indicatorText = `Short ${remainingMinimum} units to reach minimum target.`;
                indicatorClass = "text-red-600 bg-red-50 border-red-200";
              } else if (meetsMinimum && clearsBackorder) {
                indicatorText = "Meets minimum level and clears backorders.";
                indicatorClass = "text-emerald-600 bg-emerald-50 border-emerald-200";
              } else if (meetsMinimum && !clearsBackorder) {
                indicatorText = `Meets minimum level but leaves ${remainingBackorder} units backordered.`;
                indicatorClass = "text-amber-600 bg-amber-50 border-amber-200";
              } else if (!meetsMinimum && clearsBackorder) {
                indicatorText = `Backorders cleared; short ${remainingMinimum} units to hit minimum.`;
                indicatorClass = "text-amber-600 bg-amber-50 border-amber-200";
              } else if (!meetsMinimum && !clearsBackorder) {
                indicatorText = `Short ${remainingMinimum} units to minimum and ${remainingBackorder} units to close backorders.`;
                indicatorClass = "text-red-600 bg-red-50 border-red-200";
              }

              return (
                <div
                  key={item.id}
                  className="space-y-4 rounded-lg border border-gray-200 p-4"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <div>
                      <h3 className="font-medium text-gray-900">{item.name}</h3>
                      <div className="mt-1 flex items-center gap-2">
                        <span className="rounded bg-gray-100 px-2 py-1 text-xs font-mono text-gray-600">
                          {item.sku}
                        </span>
                        {pendingBackorder > 0 && (
                          <span className="rounded bg-red-100 px-2 py-1 text-xs font-medium text-red-600">
                            {pendingBackorder} backordered
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right text-xs text-gray-500">
                      Minimum target:{" "}
                      <span className="font-semibold text-gray-900">
                        {item.minInventoryLevel}
                      </span>{" "}
                      units
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-3">
                      <h4 className="text-xs font-medium uppercase tracking-wide text-gray-700">
                        Current Status
                      </h4>
                      <div className="space-y-2 rounded-md bg-gray-50 p-3 text-sm text-gray-600">
                        <div className="flex items-center justify-between">
                          <span>Available</span>
                          <span className="font-medium text-gray-900">{available}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Incoming</span>
                          <span className="font-medium text-gray-900">{incoming}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Minimum gap</span>
                          <span className="font-medium text-gray-900">{minimumGap}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Backorders</span>
                          <span className="font-medium text-gray-900">{pendingBackorder}</span>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <h4 className="text-xs font-medium uppercase tracking-wide text-gray-700">
                        Order Quantity
                      </h4>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs text-gray-500">
                          <span>Quantity to order</span>
                          <span className="text-lg font-semibold text-gray-900">{quantity}</span>
                        </div>
                        <Input
                          type="number"
                          min={0}
                          value={quantity}
                          onChange={event => onQuantityChange(item.id, event.target.value)}
                          inputMode="numeric"
                          className="text-center font-mono"
                        />
                      </div>
                    </div>
                  </div>

                  <div className={`rounded border p-2 text-xs font-medium ${indicatorClass}`}>
                    {indicatorText}
                  </div>
                </div>
              );
            })}
            {prioritizedItems.length === 0 && (
              <div className="py-8 text-center">
                <ShoppingCart className="mx-auto mb-3 h-12 w-12 text-gray-300" />
                <p className="text-gray-500">No merchandise items configured</p>
              </div>
            )}
          </div>
        </ScrollArea>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={() => void onSubmit()} disabled={isSubmitting || !hasOrderRequests}>
            {isSubmitting ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Submitting Requests
              </span>
            ) : (
              "Send to Procurement"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
