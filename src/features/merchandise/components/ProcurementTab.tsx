import { useMemo, useState } from "react";

import {
  AlertTriangle,
  CheckCircle2,
  CircleDollarSign,
  ClipboardList,
  Factory,
  Loader2,
} from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import type {
  MerchandiseItem,
  MerchandiseProcurementOrder,
  MerchandiseProcurementRequest,
} from "@/types/erp";

import { currencyFormatter, formatDate } from "../utils";
import { MetricCard } from "./MetricCard";
import { StatusBadge } from "./StatusBadge";

type PipelineTab = "open" | "closed" | "all";

interface ProcurementTabProps {
  procurementOrders: MerchandiseProcurementOrder[];
  procurementRequests: MerchandiseProcurementRequest[];
  lowStockItems: MerchandiseItem[];
  onApproveRequest: (requestId: number) => Promise<void> | void;
  onDenyRequest: (requestId: number) => Promise<void> | void;
  onClosePurchaseOrder: (procurementId: number) => Promise<void> | void;
}

export function ProcurementTab({
  procurementOrders,
  procurementRequests,
  lowStockItems,
  onApproveRequest,
  onDenyRequest,
  onClosePurchaseOrder,
}: ProcurementTabProps) {
  const openOrders = useMemo(
    () => procurementOrders.filter(po => po.status === "Open"),
    [procurementOrders]
  );
  const closedOrders = useMemo(
    () => procurementOrders.filter(po => po.status === "Closed"),
    [procurementOrders]
  );
  const openSpend = useMemo(
    () => openOrders.reduce((sum, po) => sum + po.qtyOrdered * po.unitCost, 0),
    [openOrders]
  );

  const [pipelineTab, setPipelineTab] = useState<PipelineTab>("open");
  const [approvingRequestId, setApprovingRequestId] = useState<number | null>(null);
  const [denyingRequestId, setDenyingRequestId] = useState<number | null>(null);
  const [poPendingClose, setPoPendingClose] = useState<MerchandiseProcurementOrder | null>(null);
  const [isClosingPo, setIsClosingPo] = useState(false);

  const handleApproveRequest = async (requestId: number) => {
    setApprovingRequestId(requestId);
    try {
      await onApproveRequest(requestId);
    } catch (error) {
      console.error("Failed to approve procurement request", error);
    } finally {
      setApprovingRequestId(null);
    }
  };

  const handleDenyRequest = async (requestId: number) => {
    setDenyingRequestId(requestId);
    try {
      await onDenyRequest(requestId);
    } catch (error) {
      console.error("Failed to deny procurement request", error);
    } finally {
      setDenyingRequestId(null);
    }
  };

  const handleConfirmClose = async () => {
    if (!poPendingClose) {
      return;
    }

    setIsClosingPo(true);
    try {
      await onClosePurchaseOrder(poPendingClose.id);
    } catch (error) {
      console.error("Failed to close purchase order", error);
    } finally {
      setIsClosingPo(false);
      setPoPendingClose(null);
    }
  };

  const renderRequestTable = () => (
    <table className="min-w-full text-sm">
      <thead>
        <tr className="text-left text-xs uppercase tracking-wide text-gray-500">
          <th className="py-2 pr-4">Item</th>
          <th className="py-2 pr-4">Quantity</th>
          <th className="py-2 pr-4">Minimum Gap</th>
          <th className="py-2 pr-4">Backorders</th>
          <th className="py-2 pr-4">Requested On</th>
          <th className="py-2 pr-4">Context</th>
          <th className="py-2 pr-4 text-right">Actions</th>
        </tr>
      </thead>
      <tbody>
        {procurementRequests.length === 0 ? (
          <tr>
            <td colSpan={7} className="py-6 text-center text-sm text-gray-500">
              No procurement requests are waiting for review.
            </td>
          </tr>
        ) : (
          procurementRequests.map(request => {
            const approving = approvingRequestId === request.id;
            const denying = denyingRequestId === request.id;
            const requestedAt = request.requestedAt
              ? formatDate(request.requestedAt)
              : "—";

            return (
              <tr key={request.id} className="border-t border-gray-200">
                <td className="py-2 pr-4">
                  <div className="font-medium text-gray-900">{request.itemName}</div>
                  <div className="text-xs text-gray-500">{request.itemSku}</div>
                </td>
                <td className="py-2 pr-4 font-medium text-gray-900">
                  {request.quantityRequested}
                </td>
                <td className="py-2 pr-4">{request.minimumGap}</td>
                <td className="py-2 pr-4">{request.backorderUnits}</td>
                <td className="py-2 pr-4">{requestedAt}</td>
                <td className="py-2 pr-4">
                  <p className="text-xs text-gray-600">
                    {request.note ?? "No additional context provided."}
                  </p>
                </td>
                <td className="py-2 pl-4 text-right">
                  <div className="flex justify-end gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void handleDenyRequest(request.id)}
                      disabled={approving || denying}
                    >
                      {denying ? <Loader2 className="h-4 w-4 animate-spin" /> : "Deny"}
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => void handleApproveRequest(request.id)}
                      disabled={approving || denying}
                      className="bg-indigo-600 text-white hover:bg-indigo-700"
                    >
                      {approving ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        "Accept"
                      )}
                    </Button>
                  </div>
                </td>
              </tr>
            );
          })
        )}
      </tbody>
    </table>
  );

  const renderPipelineTable = (
    ordersToRender: MerchandiseProcurementOrder[],
    allowClose: boolean
  ) => (
    <table className="min-w-full text-sm">
      <thead>
        <tr className="text-left text-xs uppercase tracking-wide text-gray-500">
          <th className="py-2 pr-4">PO</th>
          <th className="py-2 pr-4">Item</th>
          <th className="py-2 pr-4">Quantity</th>
          <th className="py-2 pr-4">Unit Cost</th>
          <th className="py-2 pr-4">Lead Time (weeks)</th>
          <th className="py-2 pr-4">Status</th>
          <th className="py-2 pr-4">Order Date</th>
          <th className="py-2 pr-4">Expected Receipt</th>
          <th className="py-2 pl-4 text-right">Actions</th>
        </tr>
      </thead>
      <tbody>
        {ordersToRender.length === 0 ? (
          <tr>
            <td colSpan={9} className="py-6 text-center text-sm text-gray-500">
              {allowClose
                ? "No open purchase orders."
                : "No purchase orders in this view."}
            </td>
          </tr>
        ) : (
          ordersToRender.map(po => {
            const isPendingClose = poPendingClose?.id === po.id && isClosingPo;
            return (
              <tr key={po.id} className="border-t border-gray-200">
                <td className="py-2 pr-4 font-medium text-gray-900">{po.poCode}</td>
                <td className="py-2 pr-4">
                  <div className="font-medium text-gray-900">{po.itemName}</div>
                  <div className="text-xs text-gray-500">{po.itemSku}</div>
                </td>
                <td className="py-2 pr-4">{po.qtyOrdered}</td>
                <td className="py-2 pr-4">{currencyFormatter.format(po.unitCost)}</td>
                <td className="py-2 pr-4">{po.leadTimeWeeks}</td>
                <td className="py-2 pr-4">
                  <StatusBadge
                    label={po.status}
                    variant={po.status === "Closed" ? "outline" : "default"}
                  />
                </td>
                <td className="py-2 pr-4">{formatDate(po.orderDate)}</td>
                <td className="py-2 pr-4">{po.expectedReceipt ? formatDate(po.expectedReceipt) : "—"}</td>
                <td className="py-2 pl-4 text-right">
                  {allowClose && po.status === "Open" ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => setPoPendingClose(po)}
                      disabled={isPendingClose}
                    >
                      {isPendingClose ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        "Received"
                      )}
                    </Button>
                  ) : (
                    <span className="text-xs text-gray-500">—</span>
                  )}
                </td>
              </tr>
            );
          })
        )}
      </tbody>
    </table>
  );

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Pending Requests"
          value={procurementRequests.length.toString()}
          subText="Awaiting procurement review"
          icon={<ClipboardList className="h-5 w-5 text-indigo-500" />}
        />
        <MetricCard
          title="Open Purchase Orders"
          value={openOrders.length.toString()}
          subText={`${closedOrders.length} closed in archive`}
          icon={<Factory className="h-5 w-5 text-emerald-500" />}
        />
        <MetricCard
          title="Open PO Spend"
          value={currencyFormatter.format(openSpend)}
          subText="Committed to inbound replenishment"
          icon={<CircleDollarSign className="h-5 w-5 text-slate-600" />}
        />
        <MetricCard
          title="Low Stock Focus"
          value={lowStockItems.length.toString()}
          subText="Driving automatic requisitions"
          icon={<AlertTriangle className="h-5 w-5 text-rose-500" />}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg text-gray-900">Requested Orders</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">{renderRequestTable()}</CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg text-gray-900">Procurement Pipeline</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Tabs value={pipelineTab} onValueChange={value => setPipelineTab(value as PipelineTab)}>
            <TabsList className="w-full justify-start">
              <TabsTrigger value="open">Open POs</TabsTrigger>
              <TabsTrigger value="closed">Closed POs</TabsTrigger>
              <TabsTrigger value="all">All POs</TabsTrigger>
            </TabsList>
            <TabsContent value="open" className="overflow-x-auto">
              {renderPipelineTable(openOrders, true)}
            </TabsContent>
            <TabsContent value="closed" className="overflow-x-auto">
              {renderPipelineTable(closedOrders, false)}
            </TabsContent>
            <TabsContent value="all" className="overflow-x-auto">
              {renderPipelineTable(procurementOrders, false)}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <AlertDialog
        open={Boolean(poPendingClose)}
        onOpenChange={open => {
          if (!open) {
            setPoPendingClose(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Close purchase order?</AlertDialogTitle>
            <AlertDialogDescription>
              {poPendingClose ? (
                <span>
                  Mark PO <strong>{poPendingClose.poCode}</strong> as received and close it?
                  Incoming stock will be moved into available inventory.
                </span>
              ) : (
                "Mark the purchase order as received."
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isClosingPo}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleConfirmClose()} disabled={isClosingPo}>
              {isClosingPo ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Closing...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" /> Close PO
                </span>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

