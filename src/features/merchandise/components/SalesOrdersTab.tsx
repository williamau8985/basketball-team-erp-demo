import { AlertTriangle, ClipboardList, Factory, Package, Plus } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

import type {
  MerchandiseSalesOrder,
  MerchandiseSalesOrderLine,
  MerchandiseStore,
} from "@/types/erp";

import { currencyFormatter, formatDate } from "../utils";
import { MetricCard } from "./MetricCard";
import { StatusBadge } from "./StatusBadge";

interface SalesOrdersTabProps {
  orders: MerchandiseSalesOrder[];
  orderLinesByOrderId: Map<number, MerchandiseSalesOrderLine[]>;
  stores: MerchandiseStore[];
  onCreateOrder: () => void;
}

export function SalesOrdersTab({ orders, orderLinesByOrderId, stores, onCreateOrder }: SalesOrdersTabProps) {
  const visibleOrders = orders.filter(
    order => order.workflowStage === "Awaiting Warehouse Approval"
  );

  const moqViolations = visibleOrders.filter(order => {
    const lines = orderLinesByOrderId.get(order.id) ?? [];
    const totalUnits = lines.reduce((sum, line) => sum + line.quantity, 0);
    return totalUnits < 5;
  }).length;

  const salesPipelineValue = visibleOrders
    .filter(order => order.status !== "Cancelled")
    .reduce((sum, order) => sum + order.totalAmount, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Sales Orders</h2>
          <p className="text-sm text-gray-600">
            Capture bulk orders and enforce MOQ requirements
          </p>
        </div>
        <Button onClick={onCreateOrder}>
          <Plus className="mr-2 h-4 w-4" /> New Sales Order
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="MOQ Exceptions"
          value={moqViolations.toString()}
          subText="Orders flagged for review"
          icon={<AlertTriangle className="h-5 w-5 text-amber-500" />}
        />
        <MetricCard
          title="Sales Pipeline"
          value={currencyFormatter.format(salesPipelineValue)}
          subText="Open order value"
          icon={<ClipboardList className="h-5 w-5 text-indigo-500" />}
        />
        <MetricCard
          title="Retail Partners"
          value={stores.length.toString()}
          subText="Active wholesale accounts"
          icon={<Factory className="h-5 w-5 text-slate-500" />}
        />
        <MetricCard
          title="Awaiting Warehouse Approval"
          value={visibleOrders.length.toString()}
          subText="Inventory queue backlog"
          icon={<Package className="h-5 w-5 text-rose-500" />}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg text-gray-900">Sales Order Management</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-gray-500">
                <th className="py-2 pr-4">Order</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2 pr-4">Retail Store</th>
                <th className="py-2 pr-4">Workflow</th>
                <th className="py-2 pr-4">Order Value</th>
                <th className="py-2 pr-4">Lines</th>
              </tr>
            </thead>
            <tbody>
              {visibleOrders.map(order => {
                const lines = orderLinesByOrderId.get(order.id) ?? [];
                const totalUnits = lines.reduce((sum, line) => sum + line.quantity, 0);
                const moqBreached = totalUnits < 5;
                return (
                  <tr key={order.id} className="border-t border-gray-200">
                    <td className="py-3 pr-4 align-top">
                      <div className="font-semibold text-gray-900">{order.orderCode}</div>
                      <div className="text-xs text-gray-500">{formatDate(order.orderDate)}</div>
                      {moqBreached && (
                        <div className="mt-1 flex flex-wrap gap-2">
                          <StatusBadge label="MOQ Breach" variant="destructive" />
                        </div>
                      )}
                    </td>
                    <td className="py-3 pr-4 align-top">
                      <StatusBadge
                        label={order.status}
                        variant={
                          order.status === "Successful - Inventory Reserved"
                            ? "default"
                            : order.status === "Backorder"
                              ? "destructive"
                              : "outline"
                        }
                      />
                    </td>
                    <td className="py-3 pr-4 align-top">
                      <div className="font-medium text-gray-900">{order.storeName}</div>
                      <div className="text-xs text-gray-500">Tier {order.storeTier}</div>
                    </td>
                    <td className="py-3 pr-4 align-top">
                      <StatusBadge
                        label={order.workflowStage}
                        variant={
                          order.workflowStage === "Packaging"
                            ? "default"
                            : order.workflowStage === "Shipped"
                              ? "secondary"
                              : order.workflowStage === "Delivered"
                                ? "outline"
                                : "secondary"
                        }
                      />
                      {order.notes && <p className="mt-2 text-xs text-gray-500">{order.notes}</p>}
                    </td>
                    <td className="py-3 pr-4 align-top font-medium text-gray-900">
                      {currencyFormatter.format(order.totalAmount)}
                      <div className="text-xs text-gray-500">{totalUnits} units</div>
                    </td>
                    <td className="py-3 pr-4 align-top">
                      <ul className="space-y-1 text-xs text-gray-600">
                        {lines.map(line => (
                          <li key={line.id} className="flex items-center justify-between gap-2">
                            <span className="font-medium text-gray-900">{line.itemName}</span>
                            <span className="font-mono text-gray-500">
                              {line.quantity} @ {currencyFormatter.format(line.unitPrice)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}