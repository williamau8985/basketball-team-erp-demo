import { AlertTriangle, Settings2, ShoppingCart, TrendingUp } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

import type { MerchandiseItem } from "@/types/erp";

import { currencyFormatter } from "../../utils";
import { StatusBadge } from "../StatusBadge";

interface InventoryPositionCardProps {
  items: MerchandiseItem[];
  onOpenRequirements: () => void;
  onOpenProcurement: () => void;
  getAvailableUnits: (item: MerchandiseItem) => number;
}

export function InventoryPositionCard({
  items,
  onOpenRequirements,
  onOpenProcurement,
  getAvailableUnits,
}: InventoryPositionCardProps) {
  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-xl text-gray-900">Inventory Position</CardTitle>
            <p className="mt-1 text-sm text-gray-600">
              Real-time stock levels and allocation status
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onOpenRequirements}
              className="flex items-center gap-2"
            >
              <Settings2 className="h-4 w-4" />
              Inventory Settings
            </Button>
            <Button
              size="sm"
              onClick={onOpenProcurement}
              className="flex items-center gap-2 bg-indigo-600 text-white hover:bg-indigo-700"
            >
              <ShoppingCart className="h-4 w-4" />
              Request Procurement
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="py-3 pr-4 text-left font-semibold text-gray-700">Item Name</th>
                <th className="py-3 pr-4 text-left font-semibold text-gray-700">ID</th>
                <th className="py-3 pr-4 text-left font-semibold text-gray-700">SKU</th>
                <th className="py-3 pr-4 text-left font-semibold text-gray-700">Pricing</th>
                <th className="py-3 pr-4 text-right font-semibold text-gray-700">Available</th>
                <th className="py-3 pr-4 text-right font-semibold text-gray-700">Allocated</th>
                <th className="py-3 pr-4 text-right font-semibold text-gray-700">Packaging</th>
                <th className="py-3 pr-4 text-right font-semibold text-gray-700">Incoming</th>
                <th className="py-3 pr-4 text-right font-semibold text-gray-700">Targets</th>
                <th className="py-3 pr-4 text-center font-semibold text-gray-700">Status</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => {
                const available = getAvailableUnits(item);
                const projected = available + item.incomingStock;
                const belowMinimum = projected < item.minInventoryLevel;
                const belowReorder = available < item.reorderLevel;
                const healthyStock = available >= item.minInventoryLevel;

                return (
                  <tr
                    key={item.id}
                    className={`border-b border-gray-100 ${index % 2 === 0 ? "bg-gray-50/50" : "bg-white"} hover:bg-blue-50/50 transition-colors`}
                  >
                    <td className="py-4 pr-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900">{item.name}</span>
                          {belowReorder && <AlertTriangle className="h-4 w-4 text-red-500" />}
                        </div>
                      </div>
                    </td>
                    <td className="py-4 pr-4">
                      <span className="rounded bg-gray-100 px-2 py-1 font-mono text-xs text-gray-500">MI-{item.id}</span>
                    </td>
                    <td className="py-4 pr-4">
                      <span className="rounded bg-gray-100 px-2 py-1 font-mono text-xs text-gray-500">{item.sku}</span>
                    </td>
                    <td className="py-4 pr-4">
                      <div className="space-y-1 text-sm">
                        <div className="flex items-center gap-2">
                          <span className="text-gray-600">Cost:</span>
                          <span className="font-medium text-gray-900">
                            {currencyFormatter.format(item.costPrice)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-gray-600">Sell:</span>
                          <span className="font-semibold text-green-700">
                            {currencyFormatter.format(item.sellPrice)}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 pr-4 text-right">
                      <div className="flex flex-col items-end gap-1">
                        <span
                          className={`text-lg font-bold ${
                            healthyStock
                              ? "text-green-700"
                              : belowReorder
                                ? "text-red-600"
                                : "text-amber-600"
                          }`}
                        >
                          {available}
                        </span>
                        <span className="text-xs text-gray-500">units</span>
                      </div>
                    </td>
                    <td className="py-4 pr-4 text-right">
                      <span
                        className={`font-medium ${
                          item.allocatedStock > 0 ? "text-blue-600" : "text-gray-400"
                        }`}
                      >
                        {item.allocatedStock}
                      </span>
                    </td>
                    <td className="py-4 pr-4 text-right">
                      <span
                        className={`font-medium ${
                          item.packagingStock > 0 ? "text-purple-600" : "text-gray-400"
                        }`}
                      >
                        {item.packagingStock}
                      </span>
                    </td>
                    <td className="py-4 pr-4 text-right">
                      <div className="flex flex-col items-end gap-1">
                        <span
                          className={`font-medium ${
                            item.incomingStock > 0 ? "text-emerald-600" : "text-gray-400"
                          }`}
                        >
                          {item.incomingStock}
                        </span>
                        {item.incomingStock > 0 && (
                          <TrendingUp className="h-3 w-3 text-emerald-500" />
                        )}
                      </div>
                    </td>
                    <td className="py-4 pr-4 text-right">
                      <div className="space-y-1 text-xs">
                        <div className="flex items-center justify-end gap-1">
                          <span className="text-gray-600">Min:</span>
                          <span className="font-medium">{item.minInventoryLevel}</span>
                        </div>
                        <div className="flex items-center justify-end gap-1">
                          <span className="text-gray-600">Reorder:</span>
                          <span className="font-medium">{item.reorderLevel}</span>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 pr-4 text-center">
                      {belowReorder ? (
                        <StatusBadge label="Critical" variant="destructive" />
                      ) : belowMinimum ? (
                        <StatusBadge label="Low Stock" variant="outline" />
                      ) : (
                        <StatusBadge label="Healthy" variant="secondary" />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}