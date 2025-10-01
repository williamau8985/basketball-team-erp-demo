import { AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";

import type { StockExceptionLine } from "../types";

interface StockExceptionDialogProps {
  shortages: StockExceptionLine[];
  onCancel: () => void;
  onPartial: () => void;
  onBackorder: () => Promise<void> | void;
  canPartial: boolean;
}

export function StockExceptionDialog({
  shortages,
  onCancel,
  onPartial,
  onBackorder,
  canPartial,
}: StockExceptionDialogProps) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 px-4">
      <div className="w-full max-w-xl overflow-hidden rounded-lg bg-white shadow-2xl">
        <div className="flex items-start gap-3 border-b border-gray-200 px-6 py-5">
          <div className="rounded-full bg-amber-100 p-2">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Insufficient Inventory</h3>
            <p className="text-sm text-gray-600">
              Some requested quantities exceed available stock. Collaborate with the buyer to choose the next step.
            </p>
          </div>
        </div>

        <div className="space-y-4 px-6 py-5">
          <ul className="space-y-3">
            {shortages.map(shortage => (
              <li key={shortage.itemId} className="rounded-md border border-gray-200 p-3">
                <div className="font-medium text-gray-900">{shortage.itemName}</div>
                <div className="text-xs text-gray-500">{shortage.sku}</div>
                <div className="mt-2 text-sm text-gray-700">
                  Requested {shortage.requested} • Available {shortage.available}
                </div>
              </li>
            ))}
          </ul>

          {!canPartial && (
            <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
              Available quantities below the five-unit MOQ must be converted into a backorder.
            </p>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-gray-200 bg-gray-50 px-6 py-4">
          <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
            Back to form
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={onPartial} disabled={!canPartial}>
            Allocate available
          </Button>
          <Button type="button" size="sm" onClick={() => void onBackorder()}>
            Create backorder
          </Button>
        </div>
      </div>
    </div>
  );
}
