import { Check, Factory, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import type {
  MerchandiseSalesOrder,
  MerchandiseSalesOrderLine,
} from "@/types/erp";

import { currencyFormatter, formatDate } from "../../utils";
import { StatusBadge } from "../StatusBadge";

interface PackagingQueuePanelProps {
  orders: MerchandiseSalesOrder[];
  orderLinesByOrderId: Map<number, MerchandiseSalesOrderLine[]>;
  pendingPackageId: number | null;
  packagedOrders: Set<number>;
  onBeginPackaging: (orderId: number) => void;
}

export function PackagingQueuePanel({
  orders,
  orderLinesByOrderId,
  pendingPackageId,
  packagedOrders,
  onBeginPackaging,
}: PackagingQueuePanelProps) {
  return (
    <Card>
      <CardHeader className="pb-4">
        <div>
          <CardTitle className="flex items-center gap-2 text-lg text-gray-900">
            <Factory className="h-5 w-5 text-purple-600" />
            Packaging Queue
          </CardTitle>
          <p className="mt-1 text-sm text-gray-600">
            Orders being prepared for shipment
          </p>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {orders.length === 0 ? (
            <div className="py-8 text-center">
              <Factory className="mx-auto mb-3 h-12 w-12 text-gray-300" />
              <p className="text-gray-500">No orders in packaging</p>
            </div>
          ) : (
            orders.map(order => {
              const lines = orderLinesByOrderId.get(order.id) ?? [];
              const units = lines.reduce((sum, line) => sum + line.quantity, 0);
              const updatingPackage = pendingPackageId === order.id;
              const isPackaged = packagedOrders.has(order.id);

              return (
                <div
                  key={order.id}
                  className="space-y-3 rounded-lg border border-gray-200 p-4 transition-shadow hover:shadow-sm"
                >
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-900">{order.orderCode}</span>
                        <StatusBadge label={order.status} variant="outline" />
                      </div>
                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        <span>{formatDate(order.orderDate)}</span>
                        <span className="flex items-center gap-1">
                          <span className="h-1 w-1 rounded-full bg-gray-400" />
                          {order.storeName} (Tier {order.storeTier})
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-gray-900">
                        {currencyFormatter.format(order.totalAmount)}
                      </div>
                      <div className="text-xs text-gray-500">{units} units</div>
                    </div>
                  </div>

                  <div className="space-y-2 rounded-md bg-gray-50 p-3">
                    {lines.map(line => (
                      <div
                        key={line.id}
                        className="flex items-center justify-between text-xs"
                      >
                        <span className="font-medium text-gray-900">{line.itemName}</span>
                        <span className="font-mono text-gray-600">
                          {line.quantity} × {currencyFormatter.format(line.unitPrice)}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="border-t border-gray-100 pt-2">
                    <Button
                      size="sm"
                      onClick={() => {
                        if (updatingPackage || isPackaged) {
                          return;
                        }
                        onBeginPackaging(order.id);
                      }}
                      disabled={updatingPackage || isPackaged}
                      className={`w-full ${
                        isPackaged ? "bg-green-600 hover:bg-green-700" : ""
                      }`}
                    >
                      {updatingPackage ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : isPackaged ? (
                        <>
                          <Check className="mr-2 h-4 w-4" /> Packaged & Shipped
                        </>
                      ) : (
                        "Complete Packaging"
                      )}
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
}
