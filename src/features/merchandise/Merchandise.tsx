import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CircleDollarSign,
  ClipboardList,
  Filter,
  Package,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { useMerchandise, useDatabase } from "@/hooks/useDatabase";
import { formatWeekLabel, getCurrentWeek } from "@/lib/timeline";
import { num, str } from "@/lib/sqlUtils";
import { cn } from "@/lib/utils";
import type {
  MerchandiseData,
  MerchandiseInvoice,
  MerchandiseItem,
  MerchandiseProcurementOrder,
  MerchandiseProcurementRequest,
  MerchandiseSalesOrder,
  MerchandiseSalesOrderLine,
  MerchandiseShipment,
  MerchandiseStore,
  SqlRow,
} from "@/types/erp";

import { CreateSalesOrderDialog } from "./components/CreateSalesOrderDialog";
import { FinanceTab } from "./components/FinanceTab";
import { InventoryTab } from "./components/InventoryTab";
import { InvoiceDetailsDialog } from "./components/InvoiceDetailsDialog";
import { MetricCard } from "./components/MetricCard";
import { OrderOverviewTab } from "./components/OrderOverviewTab";
import { ProcurementTab } from "./components/ProcurementTab";
import { SalesOrdersTab } from "./components/SalesOrdersTab";
import { ShippingTab } from "./components/ShippingTab";
import { type CreateOrderFormValues } from "./types";
import { currencyFormatter } from "./utils";

type MerchandiseTab =
  | "overview"
  | "sales"
  | "inventory"
  | "procurement"
  | "shipping"
  | "finance";

const tabs: Array<{ id: MerchandiseTab; label: string; description: string }> = [
  {
    id: "overview",
    label: "Order Overview",
    description: "Review sales orders with logistics and billing context",
  },
  { id: "sales", label: "Sales Orders", description: "Capture bulk orders and enforce MOQ" },
  { id: "inventory", label: "Inventory", description: "Approve requests and monitor stock health" },
  { id: "procurement", label: "Procurement", description: "Track replenishment with the manufacturer" },
  { id: "shipping", label: "Shipping", description: "Coordinate outbound fulfillment milestones" },
  { id: "finance", label: "Finance", description: "Invoice, aging, and GL notifications" },
];

export default function Merchandise() {
  const { isInitialized, isLoading, error } = useDatabase();
  const merch = useMerchandise();
  const [activeTab, setActiveTab] = useState<MerchandiseTab>("overview");
  const [data, setData] = useState<MerchandiseData | null>(null);
  const [isOrderDialogOpen, setIsOrderDialogOpen] = useState(false);
  const [isSavingOrder, setIsSavingOrder] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [invoiceDialog, setInvoiceDialog] = useState<{
    invoice: MerchandiseInvoice;
    order: MerchandiseSalesOrder;
  } | null>(null);

  const fetchMerchandise = useCallback(async (): Promise<MerchandiseData | null> => {
    const {
      getItems,
      getStores,
      getSalesOrders,
      getSalesOrderLines,
      getProcurementOrders,
      getProcurementRequests,
      getShipments,
      getInvoices,
    } = merch;

    if (
      !getItems ||
      !getStores ||
      !getSalesOrders ||
      !getSalesOrderLines ||
      !getProcurementOrders ||
      !getProcurementRequests ||
      !getShipments ||
      !getInvoices
    ) {
      return null;
    }

    const [
      itemsRaw,
      storesRaw,
      ordersRaw,
      orderLinesRaw,
      procurementRaw,
      procurementRequestRaw,
      shipmentsRaw,
      invoicesRaw,
    ] = await Promise.all([
      getItems(),
      getStores(),
      getSalesOrders(),
      getSalesOrderLines(),
      getProcurementOrders(),
      getProcurementRequests(),
      getShipments(),
      getInvoices(),
    ]);

    const stores = mapStores(storesRaw as SqlRow[] | undefined);
    const items = mapItems(itemsRaw as SqlRow[] | undefined);
    const orders = mapOrders(ordersRaw as SqlRow[] | undefined);
    const orderLines = mapOrderLines(orderLinesRaw as SqlRow[] | undefined);
    const procurementOrders = mapProcurement(procurementRaw as SqlRow[] | undefined);
    const procurementRequests = mapProcurementRequests(
      procurementRequestRaw as SqlRow[] | undefined
    );
    const shipments = mapShipments(shipmentsRaw as SqlRow[] | undefined);
    const invoices = mapInvoices(invoicesRaw as SqlRow[] | undefined);

    return {
      stores,
      items,
      orders,
      orderLines,
      procurementOrders,
      procurementRequests,
      shipments,
      invoices,
    };
  }, [merch]);

  useEffect(() => {
    if (!isInitialized || isLoading || error) {
      return;
    }

    let isActive = true;

    (async () => {
      try {
        const result = await fetchMerchandise();
        if (!isActive || !result) return;
        setData(result);
      } catch (err) {
        console.error("Error fetching merchandise data:", err);
        if (!isActive) return;
        setFeedback({ type: "error", message: "Failed to load merchandise data." });
        toast.error("Failed to load merchandise data");
      }
    })();

    return () => {
      isActive = false;
    };
  }, [isInitialized, isLoading, error, fetchMerchandise]);

  const handleCreateOrder = useCallback(
    async (values: CreateOrderFormValues) => {
      if (!merch.createSalesOrder) {
        const errorMessage = "Database not ready yet. Please try again.";
        setFeedback({ type: "error", message: errorMessage });
        toast.error(errorMessage);
        return;
      }

      setIsSavingOrder(true);
      setFeedback(null);

      try {
        const orderId = await merch.createSalesOrder({
          storeId: values.storeId,
          status: values.status,
          workflowStage: values.workflowStage,
          orderDate: values.orderDate,
          notes: values.notes,
          lines: values.lines,
        });

        if (values.createInvoice && merch.createInvoice) {
          const totalAmount = values.lines.reduce(
            (sum, line) => sum + line.quantity * line.unitPrice,
            0
          );
          await merch.createInvoice({
            orderId,
            storeId: values.storeId,
            amount: totalAmount,
            issuedDate: values.orderDate,
            dueDate: values.invoiceDueDate,
            status: "Unpaid",
          });
        }

        const refreshed = await fetchMerchandise();
        if (refreshed) {
          setData(refreshed);
        }

        const successMessage = `Sales order created successfully! ${values.createInvoice ? "Invoice has been generated automatically." : ""}`;
        setFeedback({ type: "success", message: successMessage });
        
        // Show success toast
        toast.success("Sales Order Created", {
          description: `Order for ${data?.stores.find(s => s.id === values.storeId)?.name || 'customer'} has been created successfully${values.createInvoice ? ' with invoice' : ''}.`,
          duration: 4000,
        });
        
        setIsOrderDialogOpen(false);
      } catch (err) {
        console.error("Error creating sales order:", err);
        const errorMessage = "Failed to create sales order.";
        setFeedback({ type: "error", message: errorMessage });
        
        // Show error toast
        toast.error("Order Creation Failed", {
          description: err instanceof Error ? err.message : errorMessage,
          duration: 5000,
        });
      } finally {
        setIsSavingOrder(false);
      }
    },
    [merch, fetchMerchandise, data?.stores]
  );

  const handleMarkInvoicePaid = useCallback(
    async (invoiceId: number) => {
      if (!merch.updateInvoiceStatus) {
        const errorMessage = "Database not ready yet. Please try again.";
        setFeedback({ type: "error", message: errorMessage });
        toast.error(errorMessage);
        return;
      }

      try {
        await merch.updateInvoiceStatus(invoiceId, "Paid");
        const refreshed = await fetchMerchandise();
        if (refreshed) {
          setData(refreshed);
        }
        const successMessage = "Invoice marked as paid.";
        setFeedback({ type: "success", message: successMessage });
        toast.success("Payment Recorded", {
          description: "Invoice has been marked as paid successfully.",
          duration: 3000,
        });
      } catch (err) {
        console.error("Error updating invoice status:", err);
        const errorMessage = "Failed to update invoice.";
        setFeedback({ type: "error", message: errorMessage });
        toast.error("Update Failed", {
          description: errorMessage,
          duration: 4000,
        });
      }
    },
    [merch, fetchMerchandise]
  );

  const handleUpdateOrderWorkflow = useCallback(
    async (
      orderId: number,
      workflowStage: string,
      options?: { carrier?: string; trackingNumber?: string | null }
    ) => {
      if (!merch.updateSalesOrderWorkflow) {
        const errorMessage = "Database not ready yet. Please try again.";
        setFeedback({ type: "error", message: errorMessage });
        toast.error(errorMessage);
        return;
      }

      try {
        await merch.updateSalesOrderWorkflow(orderId, workflowStage, options);
        const refreshed = await fetchMerchandise();
        if (refreshed) {
          setData(refreshed);
        }
        const successMessage = "Order workflow updated.";
        setFeedback({ type: "success", message: successMessage });
        toast.success("Workflow Updated", {
          description: `Order has been moved to ${workflowStage}.`,
          duration: 3000,
        });
      } catch (err) {
        console.error("Error updating order workflow:", err);
        const errorMessage = "Failed to update order workflow.";
        setFeedback({ type: "error", message: errorMessage });
        toast.error("Update Failed", {
          description: errorMessage,
          duration: 4000,
        });
      }
    },
    [merch, fetchMerchandise]
  );

  const handleResolveBackorders = useCallback(async () => {
    if (!merch.resolveBackorders) {
      const errorMessage = "Database not ready yet. Please try again.";
      setFeedback({ type: "error", message: errorMessage });
      toast.error(errorMessage);
      return;
    }

    try {
      const result = await merch.resolveBackorders();
      const refreshed = await fetchMerchandise();
      if (refreshed) {
        setData(refreshed);
      }

      const totalBackorders = result?.totalBackorders ?? 0;
      const resolvedCount = result?.resolvedOrderCodes.length ?? 0;
      const remainingCount = result?.unresolvedOrderCodes.length ?? 0;

      if (totalBackorders === 0) {
        const infoMessage = "No backorders are pending resolution.";
        setFeedback({ type: "success", message: infoMessage });
        toast.success("No Backorders", {
          description: infoMessage,
          duration: 3000,
        });
        return;
      }

      if (resolvedCount > 0) {
        const successMessage =
          remainingCount > 0
            ? `Resolved ${resolvedCount} of ${totalBackorders} backorders. ${remainingCount} order${
                remainingCount === 1 ? "" : "s"
              } still waiting on inventory.`
            : `Resolved all ${resolvedCount} backorders.`;
        setFeedback({ type: "success", message: successMessage });
        toast.success("Backorders Resolved", {
          description: successMessage,
          duration: 4000,
        });
        return;
      }

      const errorMessage =
        "Insufficient inventory to resolve backorders. Submit procurement to replenish stock.";
      setFeedback({ type: "error", message: errorMessage });
      toast.error("No Inventory Available", {
        description: errorMessage,
        duration: 4000,
      });
    } catch (err) {
      console.error("Error resolving backorders:", err);
      const errorMessage = "Failed to resolve backorders.";
      setFeedback({ type: "error", message: errorMessage });
      toast.error("Resolution Failed", {
        description: errorMessage,
        duration: 4000,
      });
    }
  }, [merch, fetchMerchandise]);

  const handleUpdateMinimumLevel = useCallback(
    async (itemId: number, minimumLevel: number) => {
      if (!merch.updateItemMinimumLevel) {
        const errorMessage = "Database not ready yet. Please try again.";
        setFeedback({ type: "error", message: errorMessage });
        toast.error(errorMessage);
        return;
      }

      try {
        await merch.updateItemMinimumLevel(itemId, minimumLevel);
        const refreshed = await fetchMerchandise();
        if (refreshed) {
          setData(refreshed);
        }
        toast.success("Inventory Target Updated", {
          description: "Minimum inventory requirement saved.",
          duration: 3000,
        });
      } catch (err) {
        console.error("Error updating minimum inventory level:", err);
        const errorMessage = "Failed to update minimum inventory level.";
        setFeedback({ type: "error", message: errorMessage });
        toast.error("Update Failed", {
          description: errorMessage,
          duration: 4000,
        });
      }
    },
    [merch, fetchMerchandise]
  );

  const handleCreateProcurementRequests = useCallback(
    async (
      requests: Array<{
        itemId: number;
        quantity: number;
        minimumGap: number;
        backorderUnits: number;
      }>
    ) => {
      if (!merch.createProcurementRequests) {
        const errorMessage = "Database not ready yet. Please try again.";
        setFeedback({ type: "error", message: errorMessage });
        toast.error(errorMessage);
        return;
      }

      if (requests.length === 0) {
        return;
      }

      try {
        await merch.createProcurementRequests(requests);
        const refreshed = await fetchMerchandise();
        if (refreshed) {
          setData(refreshed);
        }
        toast.success("Procurement Request Sent", {
          description: "Inventory replenishment has been queued.",
          duration: 3500,
        });
      } catch (err) {
        console.error("Error creating procurement orders:", err);
        const errorMessage = "Failed to submit procurement requests.";
        setFeedback({ type: "error", message: errorMessage });
        toast.error("Request Failed", {
          description: errorMessage,
          duration: 4000,
        });
      }
    },
    [merch, fetchMerchandise]
  );

  const handleApproveProcurementRequest = useCallback(
    async (requestId: number) => {
      if (!merch.approveProcurementRequest) {
        toast.error("Database not ready yet. Please try again.");
        return;
      }

      try {
        await merch.approveProcurementRequest(requestId);
        const refreshed = await fetchMerchandise();
        if (refreshed) {
          setData(refreshed);
        }
        toast.success("Purchase Order Created", {
          description: "Request approved and PO opened.",
          duration: 3500,
        });
      } catch (err) {
        console.error("Error approving procurement request:", err);
        toast.error("Failed to approve procurement request.");
      }
    },
    [merch, fetchMerchandise]
  );

  const handleDenyProcurementRequest = useCallback(
    async (requestId: number) => {
      if (!merch.denyProcurementRequest) {
        toast.error("Database not ready yet. Please try again.");
        return;
      }

      try {
        await merch.denyProcurementRequest(requestId);
        const refreshed = await fetchMerchandise();
        if (refreshed) {
          setData(refreshed);
        }
        toast.success("Request Dismissed", {
          description: "Inventory will be notified of the decline.",
          duration: 3200,
        });
      } catch (err) {
        console.error("Error denying procurement request:", err);
        toast.error("Failed to deny procurement request.");
      }
    },
    [merch, fetchMerchandise]
  );

  const handleCloseProcurementOrder = useCallback(
    async (procurementId: number) => {
      if (!merch.updateProcurementStatus) {
        toast.error("Database not ready yet. Please try again.");
        return;
      }

      try {
        await merch.updateProcurementStatus(procurementId, "Closed");
        const refreshed = await fetchMerchandise();
        if (refreshed) {
          setData(refreshed);
        }
        toast.success("PO Closed", {
          description: "Inventory levels have been updated.",
          duration: 3200,
        });
      } catch (err) {
        console.error("Error closing procurement order:", err);
        toast.error("Failed to close purchase order.");
      }
    },
    [merch, fetchMerchandise]
  );

  const handleUpdateShipmentStatus = useCallback(
    async (shipmentId: number, status: string) => {
      if (!merch.updateShipmentStatus) {
        const errorMessage = "Database not ready yet. Please try again.";
        setFeedback({ type: "error", message: errorMessage });
        toast.error(errorMessage);
        return;
      }

      try {
        const deliveryDate = status === "Delivered" ? formatWeekLabel(getCurrentWeek()) : null;
        await merch.updateShipmentStatus(shipmentId, status, deliveryDate);
        const refreshed = await fetchMerchandise();
        if (refreshed) {
          setData(refreshed);
        }
        const successMessage = "Shipment status updated.";
        setFeedback({ type: "success", message: successMessage });
        
        if (status === "Delivered") {
          toast.success("Delivery Confirmed", {
            description: "Shipment has been marked as delivered successfully.",
            duration: 4000,
          });
        } else {
          toast.success("Shipment Updated", {
            description: `Shipment status changed to ${status}.`,
            duration: 3000,
          });
        }
      } catch (err) {
        console.error("Error updating shipment status:", err);
        const errorMessage = "Failed to update shipment.";
        setFeedback({ type: "error", message: errorMessage });
        toast.error("Update Failed", {
          description: errorMessage,
          duration: 4000,
        });
      }
    },
    [merch, fetchMerchandise]
  );

  const orderLinesByOrderId = useMemo(() => {
    const map = new Map<number, MerchandiseSalesOrderLine[]>();
    if (!data) return map;
    data.orderLines.forEach(line => {
      const existing = map.get(line.orderId) ?? [];
      existing.push(line);
      map.set(line.orderId, existing);
    });
    return map;
  }, [data]);

  const shipmentsByOrderId = useMemo(() => {
    const map = new Map<number, MerchandiseShipment[]>();
    if (!data) return map;
    data.shipments.forEach(shipment => {
      const existing = map.get(shipment.orderId) ?? [];
      existing.push(shipment);
      map.set(shipment.orderId, existing);
    });
    return map;
  }, [data]);

  const invoicesByOrderId = useMemo(() => {
    const map = new Map<number, MerchandiseInvoice[]>();
    if (!data) return map;
    data.invoices.forEach(invoice => {
      const existing = map.get(invoice.orderId) ?? [];
      existing.push(invoice);
      map.set(invoice.orderId, existing);
    });
    return map;
  }, [data]);

  const ordersById = useMemo(() => {
    const map = new Map<number, MerchandiseSalesOrder>();
    if (!data) return map;
    data.orders.forEach(order => {
      map.set(order.id, order);
    });
    return map;
  }, [data]);

  const lowStockItems = useMemo(
    () =>
      data?.items.filter(item => {
        const available = Math.max(item.currentStock - item.allocatedStock - item.packagingStock, 0);
        const projectedAvailability = available + item.incomingStock;
        return projectedAvailability < item.minInventoryLevel;
      }) ?? [],
    [data]
  );

  const totalInventoryValue = useMemo(() => {
    if (!data) return 0;
    return data.items.reduce((sum, item) => sum + item.costPrice * item.currentStock, 0);
  }, [data]);

  const successfulOrders = useMemo(
    () =>
      data?.orders.filter(
        order => order.status === "Successful - Inventory Reserved"
      ) ?? [],
    [data]
  );

  const backorderValue = useMemo(() => {
    if (!data) return 0;
    return data.orders
      .filter(order => order.status === "Backorder")
      .reduce((sum, order) => sum + order.totalAmount, 0);
  }, [data]);

  const outstandingInvoices = useMemo(() => {
    if (!data) return [] as MerchandiseInvoice[];
    return data.invoices.filter(invoice => invoice.status !== "Paid");
  }, [data]);

  const awaitingApprovalCount = useMemo(
    () =>
      data?.orders.filter(order => order.workflowStage === "Awaiting Warehouse Approval")
        .length ?? 0,
    [data]
  );

  const deliveredShipments = useMemo(
    () => data?.shipments.filter(shipment => shipment.status === "Delivered").length ?? 0,
    [data]
  );

  if (isLoading) {
    return <div className="text-center text-gray-600">Initializing database...</div>;
  }

  if (error) {
    return <div className="text-center text-red-600">Database error: {error}</div>;
  }

  if (!data) {
    return <div className="text-center text-gray-600">Loading merchandise...</div>;
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Merchandise Operations</h1>
          <p className="text-sm text-gray-600">
            Unified order-to-cash workflow for wholesale merchandise partnerships.
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" size="sm">
            <Filter className="mr-2 h-4 w-4" /> Export Snapshot
          </Button>
        </div>
      </div>

      {feedback && (
        <div
          className={cn(
            "rounded-md border px-4 py-3 text-sm",
            feedback.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-900"
              : "border-rose-200 bg-rose-50 text-rose-700"
          )}
        >
          {feedback.message}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Successful Orders"
          value={successfulOrders.length.toString()}
          subText="Ready for warehouse review"
          icon={<ClipboardList className="h-5 w-5 text-emerald-500" />}
        />
        <MetricCard
          title="Backorder Exposure"
          value={currencyFormatter.format(backorderValue)}
          subText="Revenue waiting on replenishment"
          icon={<AlertTriangle className="h-5 w-5 text-amber-500" />}
        />
        <MetricCard
          title="Low Stock Items"
          value={lowStockItems.length.toString()}
          subText="At or below reorder point"
          icon={<Package className="h-5 w-5 text-rose-500" />}
        />
        <MetricCard
          title="Outstanding AR"
          value={currencyFormatter.format(
            outstandingInvoices.reduce((sum, invoice) => sum + invoice.amount, 0)
          )}
          subText={`${outstandingInvoices.length} open invoices`}
          icon={<CircleDollarSign className="h-5 w-5 text-blue-500" />}
        />
      </div>

      <Tabs
        value={activeTab}
        onValueChange={value => setActiveTab(value as MerchandiseTab)}
        className="space-y-6"
      >
        <div className="space-y-4">
          <TabsList className="w-full justify-start">
            {tabs.map(tab => (
              <TabsTrigger key={tab.id} value={tab.id} className="flex-1">
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
          <p className="text-sm text-gray-600">
            {tabs.find(tab => tab.id === activeTab)?.description}
          </p>
        </div>

        <TabsContent value="overview">
          <Card>
            <CardContent className="p-6">
              <OrderOverviewTab
                orders={data.orders}
                orderLinesByOrderId={orderLinesByOrderId}
                shipmentsByOrderId={shipmentsByOrderId}
                invoicesByOrderId={invoicesByOrderId}
                onViewInvoice={(invoice, order) => setInvoiceDialog({ invoice, order })}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sales">
          <Card>
            <CardContent className="p-6">
              <SalesOrdersTab
                orders={data.orders}
                orderLinesByOrderId={orderLinesByOrderId}
                stores={data.stores}
                onCreateOrder={() => {
                  setFeedback(null);
                  setIsOrderDialogOpen(true);
                }}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="inventory">
          <Card>
            <CardContent className="p-6">
              <InventoryTab
                items={data.items}
                orders={data.orders}
                orderLinesByOrderId={orderLinesByOrderId}
                totalInventoryValue={totalInventoryValue}
                awaitingApprovalCount={awaitingApprovalCount}
                onUpdateWorkflow={handleUpdateOrderWorkflow}
                onUpdateMinimumLevel={handleUpdateMinimumLevel}
                onCreateProcurementRequests={handleCreateProcurementRequests}
                onResolveBackorders={handleResolveBackorders}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="procurement">
          <Card>
            <CardContent className="p-6">
              <ProcurementTab
                procurementOrders={data.procurementOrders}
                procurementRequests={data.procurementRequests}
                lowStockItems={lowStockItems}
                onApproveRequest={handleApproveProcurementRequest}
                onDenyRequest={handleDenyProcurementRequest}
                onClosePurchaseOrder={handleCloseProcurementOrder}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="shipping">
          <Card>
            <CardContent className="p-6">
              <ShippingTab
                shipments={data.shipments}
                deliveredCount={deliveredShipments}
                onUpdateStatus={handleUpdateShipmentStatus}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="finance">
          <Card>
            <CardContent className="p-6">
              <FinanceTab
                invoices={data.invoices}
                outstanding={outstandingInvoices}
                onMarkPaid={handleMarkInvoicePaid}
                onViewInvoice={invoice => {
                  const order = ordersById.get(invoice.orderId);
                  if (order) {
                    setInvoiceDialog({ invoice, order });
                  }
                }}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {isOrderDialogOpen && data && (
        <CreateSalesOrderDialog
          open={isOrderDialogOpen}
          stores={data.stores}
          items={data.items}
          onClose={() => {
            if (!isSavingOrder) {
              setIsOrderDialogOpen(false);
            }
          }}
          onSubmit={handleCreateOrder}
          isSubmitting={isSavingOrder}
        />
      )}

      <InvoiceDetailsDialog
        open={Boolean(invoiceDialog)}
        invoice={invoiceDialog?.invoice ?? null}
        order={invoiceDialog?.order ?? null}
        lines={
          invoiceDialog?.order
            ? orderLinesByOrderId.get(invoiceDialog.order.id) ?? []
            : []
        }
        onOpenChange={open => {
          if (!open) {
            setInvoiceDialog(null);
          }
        }}
      />
    </div>
  );
}

function mapStores(rows: SqlRow[] | undefined): MerchandiseStore[] {
  return (
    rows?.map(row => ({
      id: num(row.id),
      name: str(row.name),
      tier: str(row.tier),
      contactName: str(row.contact_name),
      contactEmail: str(row.contact_email),
    })) ?? []
  );
}

function mapItems(rows: SqlRow[] | undefined): MerchandiseItem[] {
  return (
    rows?.map(row => ({
      id: num(row.id),
      name: str(row.name),
      sku: str(row.sku),
      costPrice: num(row.cost_price),
      sellPrice: num(row.sell_price),
      currentStock: num(row.current_stock),
      reorderLevel: num(row.reorder_level),
      minInventoryLevel: num(row.min_inventory_level ?? row.reorder_level ?? 0),
      allocatedStock: num(row.allocated_stock),
      packagingStock: num(row.packaging_stock),
      incomingStock: num(row.incoming_stock),
    })) ?? []
  );
}

function normalizeOrderStatus(status: string): MerchandiseSalesOrder["status"] {
  switch (status) {
    case "Backorder":
    case "Cancelled":
      return status;
    case "Successful - Inventory Reserved":
    case "Successful":
      return "Successful - Inventory Reserved";
    default:
      return "Successful - Inventory Reserved";
  }
}

function normalizeWorkflowStage(
  stage: string
): MerchandiseSalesOrder["workflowStage"] {
  switch (stage) {
    case "Packaging":
    case "Shipped":
    case "Delivered":
      return stage;
    case "Awaiting Warehouse Approval":
    case "Awaiting Approval":
      return "Awaiting Warehouse Approval";
    default:
      return "Awaiting Warehouse Approval";
  }
}

function mapOrders(rows: SqlRow[] | undefined): MerchandiseSalesOrder[] {
  return (
    rows?.map(row => ({
      id: num(row.id),
      orderCode: str(row.order_code),
      storeId: num(row.store_id),
      storeName: str(row.store_name),
      storeTier: str(row.store_tier),
      status: normalizeOrderStatus(str(row.status)),
      workflowStage: normalizeWorkflowStage(str(row.workflow_stage)),
      orderDate: str(row.order_date),
      totalAmount: num(row.total_amount),
      notes: str(row.notes),
    })) ?? []
  );
}

function mapOrderLines(rows: SqlRow[] | undefined): MerchandiseSalesOrderLine[] {
  return (
    rows?.map(row => ({
      id: num(row.id),
      orderId: num(row.order_id),
      orderCode: str(row.order_code),
      itemId: num(row.item_id),
      itemName: str(row.item_name),
      itemSku: str(row.item_sku),
      quantity: num(row.quantity),
      unitPrice: num(row.unit_price),
    })) ?? []
  );
}

function mapProcurement(rows: SqlRow[] | undefined): MerchandiseProcurementOrder[] {
  return (
    rows?.map(row => ({
      id: num(row.id),
      poCode: str(row.po_code),
      itemId: num(row.item_id),
      itemName: str(row.item_name),
      itemSku: str(row.item_sku),
      qtyOrdered: num(row.qty_ordered),
      unitCost: num(row.unit_cost),
      leadTimeWeeks: num(row.lead_time_days),
      status: str(row.status),
      orderDate: str(row.order_date),
      expectedReceipt: str(row.expected_receipt),
    })) ?? []
  ).map(po => ({
    ...po,
    expectedReceipt: po.expectedReceipt || null,
  }));
}

function mapProcurementRequests(
  rows: SqlRow[] | undefined
): MerchandiseProcurementRequest[] {
  return (
    rows?.map(row => ({
      id: num(row.id),
      itemId: num(row.item_id),
      itemName: str(row.item_name),
      itemSku: str(row.item_sku),
      quantityRequested: num(row.quantity_requested),
      minimumGap: num(row.minimum_gap),
      backorderUnits: num(row.backorder_units),
      requestedAt: str(row.requested_at),
      note: str(row.note),
    })) ?? []
  ).map(request => ({
    ...request,
    note: request.note || null,
  }));
}

function mapShipments(rows: SqlRow[] | undefined): MerchandiseShipment[] {
  return (
    rows?.map(row => ({
      id: num(row.id),
      shipmentCode: str(row.shipment_code),
      orderId: num(row.order_id),
      orderCode: str(row.order_code),
      storeId: num(row.store_id),
      storeName: str(row.store_name),
      carrier: str(row.carrier),
      trackingNumber: str(row.tracking_number),
      status: str(row.status),
      expectedDelivery: str(row.expected_delivery),
      actualDelivery: str(row.actual_delivery),
    })) ?? []
  ).map(shipment => ({
    ...shipment,
    expectedDelivery: shipment.expectedDelivery || null,
    actualDelivery: shipment.actualDelivery || null,
  }));
}

function mapInvoices(rows: SqlRow[] | undefined): MerchandiseInvoice[] {
  return (
    rows?.map(row => ({
      id: num(row.id),
      invoiceCode: str(row.invoice_code),
      orderId: num(row.order_id),
      storeId: num(row.store_id),
      storeName: str(row.store_name),
      amount: num(row.amount),
      issuedDate: str(row.issued_date),
      dueDate: str(row.due_date),
      status: str(row.status),
    })) ?? []
  );
}