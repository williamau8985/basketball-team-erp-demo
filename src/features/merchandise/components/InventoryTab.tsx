import { useCallback, useEffect, useMemo, useState } from "react";

import type {
  MerchandiseItem,
  MerchandiseSalesOrder,
  MerchandiseSalesOrderLine,
} from "@/types/erp";

import { Separator } from "@/components/ui/separator";

import { currencyFormatter } from "../utils";
import { AwaitingApprovalPanel } from "./inventory/AwaitingApprovalPanel";
import { InventoryMetricsSection } from "./inventory/InventoryMetricsSection";
import { InventoryPositionCard } from "./inventory/InventoryPositionCard";
import { InventoryRequirementsDialog } from "./inventory/InventoryRequirementsDialog";
import { PackagingQueuePanel } from "./inventory/PackagingQueuePanel";
import { PackagingCarrierDialog } from "./inventory/PackagingCarrierDialog";
import { ProcurementRequestDialog } from "./inventory/ProcurementRequestDialog";

type ResolveBackordersResult = {
  totalBackorders: number;
  resolvedOrderCodes: string[];
  unresolvedOrderCodes: string[];
};

type WorkflowUpdateOptions = {
  carrier?: string;
  trackingNumber?: string | null;
};

const CARRIER_OPTIONS = ["FedEx", "UPS", "DHL"] as const;

type CarrierOption = (typeof CARRIER_OPTIONS)[number];

function isCarrierOption(value: string): value is CarrierOption {
  return (CARRIER_OPTIONS as readonly string[]).includes(value);
}

function generateTrackingNumber(carrier: CarrierOption): string {
  switch (carrier) {
    case "FedEx": {
      const digits = Math.floor(Math.random() * 900_000_000_000 + 100_000_000_000);
      return String(digits);
    }
    case "UPS": {
      const digits = Math.floor(Math.random() * 900_000_000 + 100_000_000)
        .toString()
        .padStart(9, "0");
      return `1Z${digits}`;
    }
    case "DHL": {
      const letter = String.fromCharCode(65 + Math.floor(Math.random() * 26));
      const digits = Math.floor(Math.random() * 9_000_000 + 1_000_000)
        .toString()
        .padStart(7, "0");
      return `DHL${letter}${digits}`;
    }
    default: {
      return `${Date.now()}`;
    }
  }
}

interface InventoryTabProps {
  items: MerchandiseItem[];
  orders: MerchandiseSalesOrder[];
  orderLinesByOrderId: Map<number, MerchandiseSalesOrderLine[]>;
  totalInventoryValue: number;
  awaitingApprovalCount: number;
  onUpdateWorkflow: (
    orderId: number,
    workflowStage: string,
    options?: WorkflowUpdateOptions
  ) => Promise<void> | void;
  onUpdateMinimumLevel: (itemId: number, minimumLevel: number) => Promise<void> | void;
  onCreateProcurementRequests: (
    requests: Array<{
      itemId: number;
      quantity: number;
      minimumGap: number;
      backorderUnits: number;
    }>
  ) => Promise<void> | void;
  onResolveBackorders: () => Promise<ResolveBackordersResult | void>;
}

export function InventoryTab({
  items,
  orders,
  orderLinesByOrderId,
  totalInventoryValue,
  awaitingApprovalCount,
  onUpdateWorkflow,
  onUpdateMinimumLevel,
  onCreateProcurementRequests,
  onResolveBackorders,
}: InventoryTabProps) {
  const [pendingApprovalId, setPendingApprovalId] = useState<number | null>(null);
  const [pendingPackageId, setPendingPackageId] = useState<number | null>(null);
  const [approvedOrders, setApprovedOrders] = useState<Set<number>>(new Set());
  const [packagedOrders, setPackagedOrders] = useState<Set<number>>(new Set());
  const [carrierDialogOrder, setCarrierDialogOrder] =
    useState<MerchandiseSalesOrder | null>(null);
  const [selectedCarrier, setSelectedCarrier] = useState<CarrierOption>(CARRIER_OPTIONS[0]);
  const [isRequirementsOpen, setIsRequirementsOpen] = useState(false);
  const [isOrderDialogOpen, setIsOrderDialogOpen] = useState(false);
  const [isSavingRequirements, setIsSavingRequirements] = useState(false);
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);
  const [minimumLevels, setMinimumLevels] = useState<Record<number, number>>({});
  const [orderQuantities, setOrderQuantities] = useState<Record<number, number>>({});
  const [isResolvingBackorders, setIsResolvingBackorders] = useState(false);

  const handleCarrierSelection = useCallback(
    (carrier: string) => {
      if (isCarrierOption(carrier)) {
        setSelectedCarrier(carrier);
      }
    },
    [setSelectedCarrier]
  );

  const backorderUnitsByItem = useMemo(() => {
    const totals = new Map<number, number>();
    orders
      .filter(order => order.status === "Backorder")
      .forEach(order => {
        const lines = orderLinesByOrderId.get(order.id) ?? [];
        lines.forEach(line => {
          totals.set(line.itemId, (totals.get(line.itemId) ?? 0) + line.quantity);
        });
      });
    return totals;
  }, [orders, orderLinesByOrderId]);

  const getAvailableUnits = useCallback(
    (item: MerchandiseItem) =>
      Math.max(item.currentStock - item.allocatedStock - item.packagingStock, 0),
    []
  );

  const getSliderMinimum = useCallback(
    (item: MerchandiseItem) => Math.min(Math.max(item.reorderLevel + 5, 0), 300),
    []
  );

  const clampMinimumLevel = useCallback(
    (value: number, item: MerchandiseItem) => {
      const lowerBound = getSliderMinimum(item);
      const upperBound = 300;
      return Math.min(upperBound, Math.max(lowerBound, value));
    },
    [getSliderMinimum]
  );

  const prioritizedItems = useMemo(() => {
    return [...items].sort((a, b) => {
      const aAvailable = getAvailableUnits(a);
      const bAvailable = getAvailableUnits(b);
      const aShortage = Math.max(a.minInventoryLevel - (aAvailable + a.incomingStock), 0);
      const bShortage = Math.max(b.minInventoryLevel - (bAvailable + b.incomingStock), 0);
      const aBackorder = backorderUnitsByItem.get(a.id) ?? 0;
      const bBackorder = backorderUnitsByItem.get(b.id) ?? 0;
      const aScore = aShortage + aBackorder;
      const bScore = bShortage + bBackorder;
      return bScore - aScore;
    });
  }, [items, getAvailableUnits, backorderUnitsByItem]);

  useEffect(() => {
    if (!isRequirementsOpen) return;
    setMinimumLevels(
      items.reduce<Record<number, number>>((acc, item) => {
        acc[item.id] = clampMinimumLevel(item.minInventoryLevel, item);
        return acc;
      }, {})
    );
  }, [isRequirementsOpen, items, clampMinimumLevel]);

  useEffect(() => {
    if (!isOrderDialogOpen) return;
    setOrderQuantities(
      items.reduce<Record<number, number>>((acc, item) => {
        const available = getAvailableUnits(item);
        const projected = available + item.incomingStock;
        const shortage = Math.max(item.minInventoryLevel - projected, 0);
        const backorders = backorderUnitsByItem.get(item.id) ?? 0;
        acc[item.id] = Math.max(shortage, backorders, 0);
        return acc;
      }, {})
    );
  }, [isOrderDialogOpen, items, getAvailableUnits, backorderUnitsByItem]);

  const handleApproveOrder = async (orderId: number) => {
    setPendingApprovalId(orderId);
    try {
      await onUpdateWorkflow(orderId, "Packaging");
      setApprovedOrders(prev => new Set(prev).add(orderId));
    } finally {
      setPendingApprovalId(null);
    }
  };

  const handleBeginPackaging = (orderId: number) => {
    const order = orders.find(entry => entry.id === orderId) ?? null;
    if (!order) {
      return;
    }
    setSelectedCarrier(CARRIER_OPTIONS[0]);
    setCarrierDialogOrder(order);
  };

  const handlePackageOrder = async (orderId: number, carrier: CarrierOption) => {
    setPendingPackageId(orderId);
    try {
      const trackingNumber = generateTrackingNumber(carrier);
      await onUpdateWorkflow(orderId, "Shipped", { carrier, trackingNumber });
      setPackagedOrders(prev => new Set(prev).add(orderId));
      setCarrierDialogOrder(null);
      setSelectedCarrier(CARRIER_OPTIONS[0]);
    } finally {
      setPendingPackageId(null);
    }
  };

  const handleCancelCarrierDialog = () => {
    if (carrierDialogOrder && pendingPackageId === carrierDialogOrder.id) {
      return;
    }
    setCarrierDialogOrder(null);
    setSelectedCarrier(CARRIER_OPTIONS[0]);
  };

  const handleConfirmCarrier = async () => {
    if (!carrierDialogOrder) {
      return;
    }
    try {
      await handlePackageOrder(carrierDialogOrder.id, selectedCarrier);
    } catch (error) {
      console.error("Failed to assign carrier", error);
    }
  };

  const handleResolveBackorders = async () => {
    setIsResolvingBackorders(true);
    try {
      await Promise.resolve(onResolveBackorders());
    } finally {
      setIsResolvingBackorders(false);
    }
  };

  const handleMinimumLevelChange = (item: MerchandiseItem, values: number[]) => {
    const [next] = values;
    setMinimumLevels(prev => ({
      ...prev,
      [item.id]: clampMinimumLevel(next ?? item.minInventoryLevel, item),
    }));
  };

  const handleSaveRequirements = async () => {
    const updates = prioritizedItems
      .map(item => {
        const desired = clampMinimumLevel(
          minimumLevels[item.id] ?? item.minInventoryLevel,
          item
        );
        return desired !== item.minInventoryLevel
          ? { itemId: item.id, minimum: desired }
          : null;
      })
      .filter((entry): entry is { itemId: number; minimum: number } => Boolean(entry));

    if (!updates.length) {
      setIsRequirementsOpen(false);
      return;
    }

    setIsSavingRequirements(true);
    try {
      await Promise.all(
        updates.map(update =>
          Promise.resolve(onUpdateMinimumLevel(update.itemId, update.minimum))
        )
      );
      setIsRequirementsOpen(false);
    } catch (error) {
      console.error("Failed to save inventory requirements", error);
    } finally {
      setIsSavingRequirements(false);
    }
  };

  const handleQuantityChange = (itemId: number, value: string) => {
    const parsed = Number(value);
    const quantity = Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : 0;
    setOrderQuantities(prev => ({ ...prev, [itemId]: quantity }));
  };

  const handleSubmitProcurement = async () => {
    const payload = prioritizedItems
      .map(item => {
        const quantity = Math.max(0, Math.floor(orderQuantities[item.id] ?? 0));
        const available = getAvailableUnits(item);
        const minimumGap = Math.max(
          item.minInventoryLevel - (available + item.incomingStock),
          0
        );
        const backorders = backorderUnitsByItem.get(item.id) ?? 0;
        return quantity > 0
          ? { itemId: item.id, quantity, minimumGap, backorderUnits: backorders }
          : null;
      })
      .filter(
        (entry): entry is {
          itemId: number;
          quantity: number;
          minimumGap: number;
          backorderUnits: number;
        } => Boolean(entry)
      );

    if (!payload.length) {
      setIsOrderDialogOpen(false);
      return;
    }

    setIsSubmittingOrder(true);
    try {
      await Promise.resolve(onCreateProcurementRequests(payload));
      setIsOrderDialogOpen(false);
    } catch (error) {
      console.error("Failed to submit procurement request", error);
    } finally {
      setIsSubmittingOrder(false);
    }
  };

  const hasOrderRequests = useMemo(
    () => Object.values(orderQuantities).some(quantity => (quantity ?? 0) > 0),
    [orderQuantities]
  );

  const awaitingApprovalOrders = orders.filter(
    order => order.workflowStage === "Awaiting Warehouse Approval"
  );

  const packagingOrders = orders.filter(order => order.workflowStage === "Packaging");

  const packagingCount = packagingOrders.length;
  const backorderCount = useMemo(
    () => orders.filter(order => order.status === "Backorder").length,
    [orders]
  );

  const criticalItems = useMemo(() => {
    return items.filter(item => getAvailableUnits(item) < item.reorderLevel);
  }, [items, getAvailableUnits]);

  const formattedInventoryValue = useMemo(
    () => currencyFormatter.format(totalInventoryValue),
    [totalInventoryValue]
  );

  return (
    <div className="space-y-8">
      <InventoryMetricsSection
        awaitingApprovalCount={awaitingApprovalCount}
        packagingCount={packagingCount}
        criticalItemsCount={criticalItems.length}
        formattedInventoryValue={formattedInventoryValue}
      />

      <Separator />

      <InventoryPositionCard
        items={items}
        onOpenRequirements={() => setIsRequirementsOpen(true)}
        onOpenProcurement={() => setIsOrderDialogOpen(true)}
        getAvailableUnits={getAvailableUnits}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <AwaitingApprovalPanel
          orders={awaitingApprovalOrders}
          orderLinesByOrderId={orderLinesByOrderId}
          pendingApprovalId={pendingApprovalId}
          approvedOrders={approvedOrders}
          onApproveOrder={handleApproveOrder}
          onResolveBackorders={handleResolveBackorders}
          isResolvingBackorders={isResolvingBackorders}
          backorderCount={backorderCount}
        />
        <PackagingQueuePanel
          orders={packagingOrders}
          orderLinesByOrderId={orderLinesByOrderId}
          pendingPackageId={pendingPackageId}
          packagedOrders={packagedOrders}
          onBeginPackaging={handleBeginPackaging}
        />
      </div>

      <InventoryRequirementsDialog
        open={isRequirementsOpen}
        onOpenChange={setIsRequirementsOpen}
        prioritizedItems={prioritizedItems}
        minimumLevels={minimumLevels}
        onMinimumLevelChange={handleMinimumLevelChange}
        onSave={handleSaveRequirements}
        isSaving={isSavingRequirements}
        getSliderMinimum={getSliderMinimum}
        clampMinimumLevel={clampMinimumLevel}
        getAvailableUnits={getAvailableUnits}
        backorderUnitsByItem={backorderUnitsByItem}
      />

      <ProcurementRequestDialog
        open={isOrderDialogOpen}
        onOpenChange={setIsOrderDialogOpen}
        prioritizedItems={prioritizedItems}
        orderQuantities={orderQuantities}
        onQuantityChange={handleQuantityChange}
        onSubmit={handleSubmitProcurement}
        isSubmitting={isSubmittingOrder}
        hasOrderRequests={hasOrderRequests}
        getAvailableUnits={getAvailableUnits}
        backorderUnitsByItem={backorderUnitsByItem}
      />

      <PackagingCarrierDialog
        open={Boolean(carrierDialogOrder)}
        orderCode={carrierDialogOrder?.orderCode}
        storeName={carrierDialogOrder?.storeName}
        carriers={CARRIER_OPTIONS}
        selectedCarrier={selectedCarrier}
        onCarrierChange={handleCarrierSelection}
        onConfirm={handleConfirmCarrier}
        onCancel={handleCancelCarrierDialog}
        isSubmitting={
          Boolean(
            carrierDialogOrder && pendingPackageId === carrierDialogOrder.id
          )
        }
      />
    </div>
  );
}
