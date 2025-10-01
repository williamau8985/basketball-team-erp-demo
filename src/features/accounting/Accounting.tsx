// src/features/accounting/Accounting.tsx
import { useEffect, useState } from "react";
import { Landmark, ShoppingBag, Ticket } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useAccounting, type AccountingSnapshot } from "@/hooks/useAccounting";
import { useDatabase } from "@/hooks/useDatabase";

const formatCurrency = (value: number) =>
  `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const statusVariant = (status: string): "secondary" | "outline" | "destructive" => {
  if (status.toLowerCase().includes("cancel")) {
    return "destructive";
  }
  if (status.toLowerCase().includes("successful") || status.toLowerCase().includes("delivered")) {
    return "secondary";
  }
  return "outline";
};

export default function Accounting() {
  const { isLoading, error, isInitialized } = useDatabase();
  const accounting = useAccounting();
  const [snapshot, setSnapshot] = useState<AccountingSnapshot | null>(null);

  useEffect(() => {
    if (!isInitialized || !accounting.getSnapshot) {
      return;
    }

    try {
      const data = accounting.getSnapshot();
      setSnapshot(data);
    } catch (loadError) {
      console.error("Failed to load accounting snapshot", loadError);
    }
  }, [isInitialized, accounting]);

  if (isLoading) {
    return <div className="text-center text-gray-600">Initializing database...</div>;
  }

  if (error) {
    return <div className="text-center text-red-600">Database error: {error}</div>;
  }

  if (!snapshot) {
    return <div className="text-center text-gray-600">Loading accounting overview...</div>;
  }

  const netProfitColor =
    snapshot.netProfit > 0 ? "text-emerald-600" : snapshot.netProfit < 0 ? "text-rose-600" : "text-gray-900";
  const merchandiseGrossProfit = snapshot.merchandiseRevenue - snapshot.merchandiseCost;
  const ticketingNet = snapshot.ticketRevenue - snapshot.arenaOperationsAccrual;
  const closedGames = snapshot.ticketGames.filter(game => game.isClosed).length;
  const arenaVendorInvoices = Math.max(0, snapshot.arenaOperationsExpense - snapshot.arenaOperationsAccrual);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Accounting Overview</h1>
          <p className="text-sm text-gray-600">
            Merchandise performance and ticketing revenue in one glance.
          </p>
        </div>
        <Landmark className="w-6 h-6 text-indigo-600" />
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <Card>
          <CardContent className="p-6 space-y-1">
            <p className="text-sm text-gray-600">Net Profit</p>
            <p className={`text-3xl font-bold ${netProfitColor}`}>{formatCurrency(snapshot.netProfit)}</p>
            <p className="text-xs text-gray-500">
              Revenue from ticketing and merchandise minus arena operations and other expenses.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 space-y-1">
            <p className="text-sm text-gray-600">Total Revenue</p>
            <p className="text-3xl font-bold text-gray-900">{formatCurrency(snapshot.totalRevenue)}</p>
            <p className="text-xs text-gray-500">Combined ticket sales and merchandise revenue.</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 space-y-1">
            <p className="text-sm text-gray-600">Total Expenses</p>
            <p className="text-3xl font-bold text-gray-900">{formatCurrency(snapshot.totalExpenses)}</p>
            <p className="text-xs text-gray-500">Includes arena operations, COGS, and other operating costs.</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base font-semibold text-gray-900">Merchandise Financials</CardTitle>
            <ShoppingBag className="w-5 h-5 text-indigo-500" />
          </CardHeader>
          <CardContent className="space-y-3">
            <dl className="space-y-2">
              <div className="flex items-center justify-between text-sm text-gray-700">
                <dt>Revenue</dt>
                <dd className="font-semibold text-gray-900">
                  {formatCurrency(snapshot.merchandiseRevenue)}
                </dd>
              </div>
              <div className="flex items-center justify-between text-sm text-gray-700">
                <dt>Cost of goods sold</dt>
                <dd className="font-semibold text-rose-600">
                  - {formatCurrency(snapshot.merchandiseCost)}
                </dd>
              </div>
              <div className="flex items-center justify-between text-sm">
                <dt className="text-gray-700">Gross profit</dt>
                <dd
                  className={`font-semibold ${
                    merchandiseGrossProfit >= 0 ? "text-emerald-600" : "text-rose-600"
                  }`}
                >
                  {formatCurrency(merchandiseGrossProfit)}
                </dd>
              </div>
            </dl>
            <p className="text-xs text-gray-500">
              Based on recorded journal entries for merchandise sales and cost of goods sold.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base font-semibold text-gray-900">Ticketing Financials</CardTitle>
            <Ticket className="w-5 h-5 text-emerald-500" />
          </CardHeader>
          <CardContent className="space-y-3">
            <dl className="space-y-2">
              <div className="flex items-center justify-between text-sm text-gray-700">
                <dt>Revenue</dt>
                <dd className="font-semibold text-gray-900">
                  {formatCurrency(snapshot.ticketRevenue)}
                </dd>
              </div>
              <div className="flex items-center justify-between text-sm text-gray-700">
                <dt>Arena operations cost</dt>
                <dd className="font-semibold text-rose-600">
                  - {formatCurrency(snapshot.arenaOperationsAccrual)}
                </dd>
              </div>
              <div className="flex items-center justify-between text-sm">
                <dt className="text-gray-700">Net ticket profit</dt>
                <dd className={`font-semibold ${ticketingNet >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                  {formatCurrency(ticketingNet)}
                </dd>
              </div>
            </dl>
            <p className="text-xs text-gray-500">
              {closedGames > 0
                ? `${closedGames} game${closedGames === 1 ? "" : "s"} have closed this season, each accruing $125,000 in arena costs.`
                : "Arena operations costs will accrue after each game concludes."}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold text-gray-900">Expense Breakdown</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <dl className="space-y-2">
              <div className="flex items-center justify-between text-sm text-gray-700">
                <dt>Merchandise COGS</dt>
                <dd className="font-semibold text-rose-600">
                  - {formatCurrency(snapshot.merchandiseCost)}
                </dd>
              </div>
              <div className="flex items-center justify-between text-sm text-gray-700">
                <dt>Arena operations (closed games)</dt>
                <dd className="font-semibold text-rose-600">
                  - {formatCurrency(snapshot.arenaOperationsAccrual)}
                </dd>
              </div>
              {arenaVendorInvoices > 0 && (
                <div className="flex items-center justify-between text-sm text-gray-700">
                  <dt>Arena vendor invoices</dt>
                  <dd className="font-semibold text-rose-600">
                    - {formatCurrency(arenaVendorInvoices)}
                  </dd>
                </div>
              )}
              <div className="flex items-center justify-between text-sm text-gray-700">
                <dt>Other operating costs</dt>
                <dd className="font-semibold text-rose-600">
                  - {formatCurrency(snapshot.otherExpenses)}
                </dd>
              </div>
            </dl>
            <p className="text-xs text-gray-500">
              Total expenses reconcile to {formatCurrency(snapshot.totalExpenses)}.
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-gray-900">Recent Merchandise Orders</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {snapshot.merchandiseOrders.map(order => (
              <div
                key={order.id}
                className="flex items-center justify-between rounded-lg border border-gray-200 p-4"
              >
                <div>
                  <p className="font-semibold text-gray-900">{order.orderCode}</p>
                  <p className="text-xs text-gray-600">{order.orderDate}</p>
                </div>
                <div className="text-right space-y-1">
                  <Badge variant={statusVariant(order.status)}>{order.status}</Badge>
                  <p className="text-sm font-medium text-gray-900">{formatCurrency(order.totalAmount)}</p>
                </div>
              </div>
            ))}
            {snapshot.merchandiseOrders.length === 0 && (
              <p className="text-sm text-gray-500">No merchandise orders recorded yet.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-gray-900">Game Attendance &amp; Ticket Sales</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {snapshot.ticketGames.map(game => (
              <div
                key={game.id}
                className="rounded-lg border border-gray-200 p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold text-gray-900">
                      {game.date} vs {game.opponent}
                    </p>
                    <p className="text-xs text-gray-600">{game.venue}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={game.isClosed ? "outline" : "secondary"}>
                      {game.isClosed
                        ? "Sales Closed"
                        : game.lockedFloor > 0
                          ? "Sales Restricted"
                          : "Sales Open"}
                    </Badge>
                  </div>
                </div>
                <div className="mt-3 space-y-2">
                  <div className="flex items-center justify-between text-xs text-gray-600">
                    <span>Attendance</span>
                    <span>
                      {Math.round(game.attendancePercentage)}% · {game.soldSeats.toLocaleString()} /
                      {" "}
                      {game.totalSeats.toLocaleString()} seats
                    </span>
                  </div>
                  <Progress value={game.attendancePercentage} />
                  <div className="flex items-center justify-between text-sm text-gray-700">
                    <span>Projected revenue</span>
                    <span className="font-medium">{formatCurrency(game.realizedRevenue)}</span>
                  </div>
                  {game.isClosed && (
                    <div className="flex items-center justify-between text-sm text-gray-700">
                      <span>Arena operations cost</span>
                      <span className="font-medium text-rose-600">
                        - {formatCurrency(game.arenaOperationsCost)}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center justify-between text-sm text-gray-900">
                    <span>Net ticket profit</span>
                    <span
                      className={`font-semibold ${
                        game.realizedRevenue - game.arenaOperationsCost >= 0
                          ? "text-emerald-600"
                          : "text-rose-600"
                      }`}
                    >
                      {formatCurrency(game.realizedRevenue - game.arenaOperationsCost)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
            {snapshot.ticketGames.length === 0 && (
              <p className="text-sm text-gray-500">No games scheduled yet.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
