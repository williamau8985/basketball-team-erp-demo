import { Fragment } from "react";

import { FileText } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

import type {
  MerchandiseInvoice,
  MerchandiseSalesOrder,
  MerchandiseSalesOrderLine,
  MerchandiseShipment,
} from "@/types/erp";

import { currencyFormatter, formatDate } from "../utils";
import { StatusBadge, type StatusBadgeVariant } from "./StatusBadge";

interface OrderOverviewTabProps {
  orders: MerchandiseSalesOrder[];
  orderLinesByOrderId: Map<number, MerchandiseSalesOrderLine[]>;
  shipmentsByOrderId: Map<number, MerchandiseShipment[]>;
  invoicesByOrderId: Map<number, MerchandiseInvoice[]>;
  onViewInvoice: (invoice: MerchandiseInvoice, order: MerchandiseSalesOrder) => void;
}

export function OrderOverviewTab({
  orders,
  orderLinesByOrderId,
  shipmentsByOrderId,
  invoicesByOrderId,
  onViewInvoice,
}: OrderOverviewTabProps) {
  if (orders.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-gray-200 p-8 text-center text-sm text-gray-500">
        No sales orders have been captured yet. As soon as an order is created, it will appear here with its
        fulfillment, logistics, and billing details.
      </div>
    );
  }

  const sortedOrders = [...orders].sort((a, b) => a.orderCode.localeCompare(b.orderCode));

  return (
    <div className="space-y-6">
      {sortedOrders.map(order => {
        const lines = orderLinesByOrderId.get(order.id) ?? [];
        const shipments = shipmentsByOrderId.get(order.id) ?? [];
        const invoices = invoicesByOrderId.get(order.id) ?? [];

        const latestShipment = getLatestShipment(shipments);
        const shipmentStatus = getShipmentStatus(latestShipment);
        const workflowStatus = getWorkflowStatus(order.workflowStage);
        const orderStatus = getOrderStatus(order.status);

        return (
          <Card key={order.id}>
            <CardHeader className="space-y-2">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-lg text-gray-900">
                    {order.orderCode}
                    <span className="ml-2 text-sm font-normal text-gray-500">
                      {order.storeName} • Tier {order.storeTier}
                    </span>
                  </CardTitle>
                  <p className="text-sm text-gray-500">Entered {formatDate(order.orderDate)}</p>
                  {order.notes && <p className="mt-1 text-sm text-gray-600">{order.notes}</p>}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge label={orderStatus.label} variant={orderStatus.variant} />
                  <StatusBadge label={workflowStatus.label} variant={workflowStatus.variant} />
                  {shipmentStatus && (
                    <StatusBadge label={shipmentStatus.label} variant={shipmentStatus.variant} />
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-6 lg:grid-cols-3">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">Order Breakdown</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    {lines.length} line{lines.length === 1 ? "" : "s"} totaling {currencyFormatter.format(order.totalAmount)}
                  </p>
                  <Separator className="my-3" />
                  <ul className="space-y-2 text-sm text-gray-600">
                    {lines.map(line => (
                      <li key={line.id} className="flex items-center justify-between gap-4">
                        <div>
                          <span className="font-medium text-gray-900">{line.itemName}</span>
                          <span className="ml-2 text-xs text-gray-500">{line.itemSku}</span>
                        </div>
                        <div className="text-right text-xs text-gray-500">
                          <div className="font-medium text-gray-900">
                            {line.quantity} @ {currencyFormatter.format(line.unitPrice)}
                          </div>
                          <div>Line Total {currencyFormatter.format(line.quantity * line.unitPrice)}</div>
                        </div>
                      </li>
                    ))}
                  </ul>
                  {lines.length === 0 && (
                    <p className="text-sm text-gray-500">This order has no line items recorded.</p>
                  )}
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">Logistics</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    {shipmentStatus
                      ? shipmentStatus.description
                      : "Shipment will appear here once the warehouse hands the order to logistics."}
                  </p>
                  <Separator className="my-3" />
                  {latestShipment ? (
                    <dl className="space-y-2 text-sm text-gray-600">
                      <div className="flex justify-between">
                        <dt className="text-gray-500">Carrier</dt>
                        <dd className="font-medium text-gray-900">{latestShipment.carrier}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-gray-500">Tracking</dt>
                        <dd className="font-mono text-gray-900">{latestShipment.trackingNumber}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-gray-500">Expected Arrival</dt>
                        <dd className="font-medium text-gray-900">{formatDate(latestShipment.expectedDelivery)}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-gray-500">Actual Delivery</dt>
                        <dd className="font-medium text-gray-900">{formatDate(latestShipment.actualDelivery)}</dd>
                      </div>
                    </dl>
                  ) : (
                    <p className="text-sm text-gray-500">No shipment has been scheduled for this order yet.</p>
                  )}
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">Billing</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    {invoices.length > 0
                      ? "Select an invoice ID to review the billing document."
                      : "An invoice will appear here once accounting issues one."}
                  </p>
                  <Separator className="my-3" />
                  <div className="space-y-3">
                    {invoices.map(invoice => {
                      const invoiceState = getInvoiceState(invoice);
                      return (
                        <Fragment key={invoice.id}>
                          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <Button
                                type="button"
                                variant="outline"
                                className="group h-auto min-w-[12rem] justify-start gap-2 rounded-md border-emerald-200 bg-emerald-50 px-3 py-2 text-left text-sm font-semibold text-emerald-700 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-300 hover:bg-white"
                                onClick={() => onViewInvoice(invoice, order)}
                              >
                                <FileText className="h-4 w-4 text-emerald-500 transition group-hover:text-emerald-600" />
                                <span>{invoice.invoiceCode}</span>
                                <span className="ml-auto text-xs font-medium text-emerald-500 transition group-hover:text-emerald-600">
                                  View Invoice
                                </span>
                              </Button>
                              <StatusBadge label={invoiceState.label} variant={invoiceState.variant} />
                            </div>
                            <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-gray-600">
                              <div>
                                <span className="font-medium text-gray-700">Issued:</span> {formatDate(invoice.issuedDate)}
                              </div>
                              <div>
                                <span className="font-medium text-gray-700">Due:</span> {formatDate(invoice.dueDate)}
                              </div>
                              <div>
                                <span className="font-medium text-gray-700">Total:</span> {currencyFormatter.format(invoice.amount)}
                              </div>
                            </div>
                            <div className="mt-3 rounded-md border border-dashed border-emerald-100 bg-emerald-50/60 p-3 text-xs text-emerald-700">
                              {invoiceState.description}
                            </div>
                          </div>
                        </Fragment>
                      );
                    })}
                  </div>
                  {invoices.length === 0 && (
                    <p className="text-sm text-gray-500">No invoices are tied to this order yet.</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function getOrderStatus(status: MerchandiseSalesOrder["status"]): {
  label: string;
  variant: StatusBadgeVariant;
} {
  switch (status) {
    case "Successful - Inventory Reserved":
      return { label: "Inventory Reserved", variant: "default" };
    case "Backorder":
      return { label: "Backorder", variant: "destructive" };
    case "Cancelled":
    default:
      return { label: "Cancelled", variant: "outline" };
  }
}

function getWorkflowStatus(stage: MerchandiseSalesOrder["workflowStage"]): {
  label: string;
  variant: StatusBadgeVariant;
} {
  switch (stage) {
    case "Packaging":
      return { label: "Being Packaged", variant: "default" };
    case "Shipped":
      return { label: "Shipped", variant: "secondary" };
    case "Delivered":
      return { label: "Delivered", variant: "outline" };
    case "Awaiting Warehouse Approval":
    default:
      return { label: "Awaiting Approval", variant: "secondary" };
  }
}

function getLatestShipment(shipments: MerchandiseShipment[]): MerchandiseShipment | null {
  if (shipments.length === 0) {
    return null;
  }

  return shipments.reduce((latest, current) => (current.id > latest.id ? current : latest), shipments[0]);
}

function getShipmentStatus(shipment: MerchandiseShipment | null):
  | {
      label: string;
      variant: StatusBadgeVariant;
      description: string;
    }
  | null {
  if (!shipment) {
    return null;
  }

  switch (shipment.status) {
    case "Received from Inventory":
      return {
        label: "Received by Inventory",
        variant: "default",
        description: "Warehouse has staged the order and handed it to logistics for pickup.",
      };
    case "Out for Delivery":
      return {
        label: "In Transit",
        variant: "secondary",
        description: "Carrier is moving the shipment to the retail partner.",
      };
    case "Delivered":
      return {
        label: "Delivered",
        variant: "outline",
        description: "Customer confirmed delivery. Any issues should be logged with support.",
      };
    default:
      return {
        label: shipment.status,
        variant: "secondary",
        description: "Shipment is processing. Track progress with the logistics partner.",
      };
  }
}

function getInvoiceState(invoice: MerchandiseInvoice): {
  label: string;
  variant: StatusBadgeVariant;
  description: string;
} {
  switch (invoice.status) {
    case "Paid":
      return {
        label: "Settled",
        variant: "outline",
        description: "Invoice has been paid and the balance is cleared in AR.",
      };
    case "Overdue":
      return {
        label: "Overdue",
        variant: "destructive",
        description: "Follow up with the customer to resolve the outstanding balance.",
      };
    case "Unpaid":
    default:
      return {
        label: "Open",
        variant: "secondary",
        description: "Invoice is open. Monitor for payment once the due week arrives.",
      };
  }
}
