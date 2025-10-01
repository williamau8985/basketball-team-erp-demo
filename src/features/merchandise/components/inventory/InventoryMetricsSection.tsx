import { BarChart3, ClipboardList, Factory, Package, AlertTriangle } from "lucide-react";

import { MetricCard } from "../MetricCard";

interface InventoryMetricsSectionProps {
  awaitingApprovalCount: number;
  packagingCount: number;
  criticalItemsCount: number;
  formattedInventoryValue: string;
}

export function InventoryMetricsSection({
  awaitingApprovalCount,
  packagingCount,
  criticalItemsCount,
  formattedInventoryValue,
}: InventoryMetricsSectionProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Inventory Overview</h2>
          <p className="text-sm text-gray-600">
            Monitor stock levels, approve orders, and manage procurement
          </p>
        </div>
        <div className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-indigo-600" />
          <span className="text-sm font-medium text-gray-700">Live Inventory Data</span>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Total Inventory Value"
          value={formattedInventoryValue}
          subText="Based on cost pricing"
          icon={<ClipboardList className="h-5 w-5 text-emerald-600" />}
        />
        <MetricCard
          title="Awaiting Approval"
          value={awaitingApprovalCount.toString()}
          subText="Orders ready for review"
          icon={<Package className="h-5 w-5 text-blue-600" />}
        />
        <MetricCard
          title="In Packaging"
          value={packagingCount.toString()}
          subText="Orders being prepared"
          icon={<Factory className="h-5 w-5 text-purple-600" />}
        />
        <MetricCard
          title="Critical Stock Alerts"
          value={criticalItemsCount.toString()}
          subText="Below reorder point"
          icon={<AlertTriangle className="h-5 w-5 text-red-600" />}
        />
      </div>
    </div>
  );
}
