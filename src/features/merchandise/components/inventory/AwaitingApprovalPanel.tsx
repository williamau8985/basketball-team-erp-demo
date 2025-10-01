import { AlertTriangle, Check, Info, Loader2, Package } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import type {
  MerchandiseSalesOrder,
  MerchandiseSalesOrderLine,
} from "@/types/erp";

import { currencyFormatter, formatDate } from "../../utils";
import { StatusBadge } from "../StatusBadge";

interface AwaitingApprovalPanelProps {
  orders: MerchandiseSalesOrder[];
  orderLinesByOrderId: Map<number, MerchandiseSalesOrderLine[]>;
  pendingApprovalId: number | null;
  approvedOrders: Set<number>;
  onApproveOrder: (orderId: number) => Promise<void> | void;
  onResolveBackorders: () => Promise<void> | void;
  isResolvingBackorders: boolean;
  backorderCount: number;
}

export function AwaitingApprovalPanel({
  orders,
  orderLinesByOrderId,
  pendingApprovalId,
  approvedOrders,
  onApproveOrder,
  onResolveBackorders,
  isResolvingBackorders,
  backorderCount,
}: AwaitingApprovalPanelProps) {
  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg text-gray-900">
              <Package className="h-5 w-5 text-blue-600" />
              Awaiting Warehouse Approval
            </CardTitle>
            <p className="mt-1 text-sm text-gray-600">
              Orders ready for inventory team review
            </p>
          </div>
          <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center">
            <div className="flex items-center gap-2 text-xs">
              <span className="h-2 w-2 rounded-full bg-red-500" />
              <span className="font-medium text-gray-700">Backorders: {backorderCount}</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void onResolveBackorders()}
              disabled={isResolvingBackorders || backorderCount === 0}
              className="text-xs"
            >
              {isResolvingBackorders ? (
                <>
                  <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                  Resolving
                </>
              ) : (
                "Resolve Backorders"
              )}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {orders.length === 0 ? (
            <div className="py-8 text-center">
              <Package className="mx-auto mb-3 h-12 w-12 text-gray-300" />
              <p className="text-gray-500">No orders awaiting approval</p>
            </div>
          ) : (
            orders.map(order => {
              const lines = orderLinesByOrderId.get(order.id) ?? [];
              const units = lines.reduce((sum, line) => sum + line.quantity, 0);
              const updatingApproval = pendingApprovalId === order.id;
              const isApproved = approvedOrders.has(order.id);
              const isBackorder = order.status === "Backorder";

              return (
                <div
                  key={order.id}
                  className="space-y-3 rounded-lg border border-gray-200 p-4 transition-shadow hover:shadow-sm"
                >
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <StatusBadge
                          label={
                            order.status === "Successful - Inventory Reserved"
                              ? "Inventory Reserved"
                              : order.status
                          }
                          variant={
                            order.status === "Successful - Inventory Reserved"
                              ? "default"
                              : isBackorder
                                ? "destructive"
                                : "outline"
                          }
                        />
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

                  {order.notes && (
                    <div className="rounded border border-blue-200 bg-blue-50 p-2">
                      <div className="flex items-start gap-2">
                        <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-600" />
                        <p className="text-xs text-blue-800">{order.notes}</p>
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    <h4 className="text-xs font-medium uppercase tracking-wide text-gray-700">
                      Line Items
                    </h4>
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
                  </div>

                  {isBackorder && (
                    <div className="rounded border border-amber-200 bg-amber-50 p-2">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-amber-600" />
                        <p className="text-xs text-amber-800">
                          Awaiting allocation from inventory team
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="border-t border-gray-100 pt-2">
                    {isBackorder ? (
                      <div className="text-center">
                        <span className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-500">
                          Cannot approve backorders
                        </span>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => void onApproveOrder(order.id)}
                        disabled={updatingApproval || isApproved}
                        className={`w-full ${
                          isApproved ? "bg-green-600 hover:bg-green-700" : ""
                        }`}
                      >
                        {updatingApproval ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : isApproved ? (
                          <>
                            <Check className="mr-2 h-4 w-4" /> Approved
                          </>
                        ) : (
                          "Approve for Packaging"
                        )}
                      </Button>
                    )}
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
