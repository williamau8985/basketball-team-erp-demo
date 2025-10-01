import { useState } from "react";

import { ClipboardList, Factory, Loader2, Package, Truck } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import type { MerchandiseShipment } from "@/types/erp";

import { parseWeekLabel } from "@/lib/timeline";

import { formatDate } from "../utils";
import { MetricCard } from "./MetricCard";
import { StatusBadge } from "./StatusBadge";

interface ShippingTabProps {
  shipments: MerchandiseShipment[];
  deliveredCount: number;
  onUpdateStatus: (shipmentId: number, status: string) => Promise<void> | void;
}

interface StatusSliderProps {
  currentStatus: string;
  shipmentId: number;
  onUpdateStatus: (shipmentId: number, status: string) => Promise<void> | void;
  isUpdating: boolean;
}

const statusSteps = [
  { value: "Received from Inventory", label: "Received", icon: Package },
  { value: "Out for Delivery", label: "In Transit", icon: Truck },
  { value: "Delivered", label: "Delivered", icon: Package }
];

function StatusSlider({ currentStatus, shipmentId, onUpdateStatus, isUpdating }: StatusSliderProps) {
  const currentIndex = statusSteps.findIndex(step => step.value === currentStatus);
  
  const handleStepClick = async (stepIndex: number) => {
    if (stepIndex === currentIndex || isUpdating) return;
    
    const newStatus = statusSteps[stepIndex].value;
    await onUpdateStatus(shipmentId, newStatus);
  };

  return (
    <div className="relative flex items-center justify-between w-48 py-2">
      {/* Progress Line */}
      <div className="absolute top-1/2 left-4 right-4 h-0.5 bg-gray-200 -translate-y-1/2">
        <div 
          className="h-full bg-blue-500 transition-all duration-300 ease-in-out"
          style={{ width: `${(currentIndex / (statusSteps.length - 1)) * 100}%` }}
        />
      </div>
      
      {/* Status Steps */}
      {statusSteps.map((step, index) => {
        const StepIcon = step.icon;
        const isActive = index <= currentIndex;
        const isCurrent = index === currentIndex;
        const isClickable = !isUpdating && index !== currentIndex;
        
        return (
          <div key={step.value} className="relative z-10">
            <button
              onClick={() => handleStepClick(index)}
              disabled={!isClickable}
              className={`
                relative flex items-center justify-center w-8 h-8 rounded-full border-2 transition-all duration-200
                ${isActive 
                  ? 'bg-blue-500 border-blue-500 text-white' 
                  : 'bg-white border-gray-300 text-gray-400'
                }
                ${isClickable ? 'hover:scale-110 cursor-pointer' : ''}
                ${isUpdating && isCurrent ? 'animate-pulse' : ''}
              `}
              title={`Set to ${step.label}`}
            >
              {isUpdating && isCurrent ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <StepIcon className="w-4 h-4" />
              )}
            </button>
            
            {/* Step Label */}
            <div className="absolute top-10 left-1/2 -translate-x-1/2 whitespace-nowrap">
              <span className={`text-xs font-medium ${isActive ? 'text-blue-600' : 'text-gray-500'}`}>
                {step.label}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function ShippingTab({ shipments, deliveredCount, onUpdateStatus }: ShippingTabProps) {
  const [pendingShipmentId, setPendingShipmentId] = useState<number | null>(null);

  const handleStatusChange = async (shipmentId: number, status: string) => {
    setPendingShipmentId(shipmentId);
    try {
      await onUpdateStatus(shipmentId, status);
    } catch (error) {
      console.error("Failed to update shipment status", error);
    } finally {
      setPendingShipmentId(null);
    }
  };

  const onTimeDeliveries = shipments.filter(shipment => {
    if (shipment.status !== "Delivered" || !shipment.expectedDelivery || !shipment.actualDelivery) {
      return false;
    }
    const expected = parseWeekLabel(shipment.expectedDelivery);
    const actual = parseWeekLabel(shipment.actualDelivery);
    return actual <= expected;
  }).length;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Active Shipments"
          value={shipments.filter(shipment => shipment.status !== "Delivered").length.toString()}
          subText="Orders leaving the warehouse"
          icon={<Truck className="h-5 w-5 text-emerald-500" />}
        />
        <MetricCard
          title="Delivered"
          value={deliveredCount.toString()}
          subText="Completed deliveries"
          icon={<Package className="h-5 w-5 text-indigo-500" />}
        />
        <MetricCard
          title="On-Time Rate"
          value={shipments.length ? `${Math.round((onTimeDeliveries / shipments.length) * 100)}%` : "0%"}
          subText="Delivered vs expected week"
          icon={<ClipboardList className="h-5 w-5 text-slate-600" />}
        />
        <MetricCard
          title="Pending Handoffs"
          value={shipments.filter(shipment => shipment.status === "Received from Inventory").length.toString()}
          subText="Ready for carrier pick up"
          icon={<Factory className="h-5 w-5 text-amber-500" />}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg text-gray-900">Shipping & Fulfillment</CardTitle>
          <p className="text-sm text-gray-600 mt-1">Click on the status progress steps to update delivery status</p>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-gray-500">
                <th className="py-2 pr-4">Shipment</th>
                <th className="py-2 pr-4">Order</th>
                <th className="py-2 pr-4">Store</th>
                <th className="py-2 pr-4">Carrier</th>
                <th className="py-2 pr-4">Status Progress</th>
                <th className="py-2 pr-4">Expected</th>
                <th className="py-2 pr-4">Delivered</th>
                <th className="py-2 pr-4">Performance</th>
              </tr>
            </thead>
            <tbody>
              {shipments.map(shipment => {
                const onTime =
                  shipment.status === "Delivered" &&
                  shipment.expectedDelivery &&
                  shipment.actualDelivery &&
                  parseWeekLabel(shipment.actualDelivery) <= parseWeekLabel(shipment.expectedDelivery);
                const isUpdating = pendingShipmentId === shipment.id;

                return (
                  <tr key={shipment.id} className="border-t border-gray-200">
                    <td className="py-4 pr-4 font-medium text-gray-900">{shipment.shipmentCode}</td>
                    <td className="py-4 pr-4 text-gray-700">{shipment.orderCode}</td>
                    <td className="py-4 pr-4 text-gray-700">{shipment.storeName}</td>
                    <td className="py-4 pr-4 text-gray-700">
                      <div>{shipment.carrier}</div>
                      <div className="font-mono text-xs text-gray-500">{shipment.trackingNumber}</div>
                    </td>
                    <td className="py-4 pr-4">
                      <StatusSlider
                        currentStatus={shipment.status}
                        shipmentId={shipment.id}
                        onUpdateStatus={handleStatusChange}
                        isUpdating={isUpdating}
                      />
                    </td>
                    <td className="py-4 pr-4">{formatDate(shipment.expectedDelivery)}</td>
                    <td className="py-4 pr-4">{formatDate(shipment.actualDelivery)}</td>
                    <td className="py-4 pr-4">
                      {shipment.status === "Delivered" ? (
                        <StatusBadge label={onTime ? "On Time" : "Delayed"} variant={onTime ? "secondary" : "destructive"} />
                      ) : (
                        <span className="text-xs text-gray-500">ETA {formatDate(shipment.expectedDelivery)}</span>
                      )}
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