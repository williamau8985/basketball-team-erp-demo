// src/features/dashboard/Dashboard.tsx
import { useEffect, useState } from "react";
import { Calendar, DollarSign, BarChart3, Users, Download, Upload, RotateCcw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

import { useDatabase, useMerchandise, useTicketing, useRoster } from "@/hooks/useDatabase";
import { useDbBackup } from "@/hooks/useDbBackup";
import { num, str, boolFromSql } from "@/lib/sqlUtils";
import type { DashboardData, SqlRow } from "@/types/erp";

export default function Dashboard() {
  const { isInitialized, isLoading, error, resetDatabase } = useDatabase();
  const merchandise = useMerchandise();
  const ticketing = useTicketing();
  const roster = useRoster();
  const { exportDbToFile, importDbFromFilePicker } = useDbBackup();

  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    // Gate the effect on database being ready
    if (!isInitialized || isLoading || error) {
      return;
    }

    let isMounted = true; // Prevent state updates after unmount

    (async () => {
      try {
        const salesOrdersRaw = merchandise.getSalesOrders?.() as SqlRow[] | undefined;
        const ticketOrdersRaw = ticketing.getTicketOrders?.() as SqlRow[] | undefined;
        const playerRowsRaw = roster.getPlayers?.();
        const gameRowsRaw = ticketing.getGames?.();

        // Only update state if component is still mounted
        if (!isMounted) return;

        const revenue = {
          merchandise: {
            total_revenue:
              (salesOrdersRaw ?? []).reduce((sum, order) => sum + num(order.total_amount), 0),
            order_count: (salesOrdersRaw ?? []).length,
          },
          tickets: {
            total_revenue: (ticketOrdersRaw ?? []).reduce((sum, order) => sum + num(order.total), 0),
            order_count: (ticketOrdersRaw ?? []).length,
          },
        };

        const players = (playerRowsRaw as SqlRow[] | undefined)?.map((r) => ({
          name: str(r.name),
          position: str(r.position),
          active: boolFromSql(r.active),
          aav: num(r.aav),
        })) ?? [];

        const games = (gameRowsRaw as SqlRow[] | undefined)?.map((r) => ({
          date: str(r.date),
          opponent: str(r.opponent),
          venue: str(r.venue),
        })) ?? [];

        setData({ revenue, players, games });
      } catch (err) {
        console.error('Error fetching dashboard data:', err);
      }
    })();

    // Cleanup function to prevent state updates after unmount
    return () => {
      isMounted = false;
    };
  }, [isInitialized, isLoading, error, merchandise, ticketing, roster]);

  // Handle loading and error states
  if (isLoading) {
    return <div className="text-center text-gray-600">Initializing database...</div>;
  }

  if (error) {
    return <div className="text-center text-red-600">Database error: {error}</div>;
  }

  if (!data) {
    return <div className="text-center text-gray-600">Loading dashboard...</div>;
  }

  const totalRevenue = (data.revenue.merchandise.total_revenue || 0) + (data.revenue.tickets.total_revenue || 0);
  const totalOrders = (data.revenue.merchandise.order_count || 0) + (data.revenue.tickets.order_count || 0);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <div className="flex gap-3">
          <Button variant="outline" size="sm" onClick={() => resetDatabase()}>
            <RotateCcw className="w-4 h-4 mr-2" /> Reset DB
          </Button>
          <Button variant="outline" size="sm" onClick={() => exportDbToFile()}>
            <Download className="w-4 h-4 mr-2" /> Export
          </Button>
          <Button variant="outline" size="sm" onClick={() => importDbFromFilePicker()}>
            <Upload className="w-4 h-4 mr-2" /> Import
          </Button>
        </div>
      </div>

      <div className="grid md:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Active Players</p>
                <p className="text-3xl font-bold text-gray-900">{data.players.filter(p => p.active).length}</p>
              </div>
              <Users className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Upcoming Games</p>
                <p className="text-3xl font-bold text-gray-900">{data.games.length}</p>
              </div>
              <Calendar className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Revenue</p>
                <p className="text-3xl font-bold text-gray-900">${totalRevenue.toLocaleString()}</p>
              </div>
              <DollarSign className="w-8 h-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Orders</p>
                <p className="text-3xl font-bold text-gray-900">{totalOrders}</p>
              </div>
              <BarChart3 className="w-8 h-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        <Card>
          <CardHeader><CardTitle className="text-gray-900">Upcoming Games</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-4">
              {data.games.slice(0, 5).map((g, i) => (
                <div key={i} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">{g.date} vs {g.opponent}</p>
                    <p className="text-sm text-gray-600">{g.venue}</p>
                  </div>
                  <Badge variant="secondary">Scheduled</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-gray-900">Active Roster</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-4">
              {data.players.filter(p => p.active).slice(0, 5).map((p, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Avatar>
                    <AvatarFallback className="bg-gray-100 text-gray-700">
                      {p.name.split(" ").map(n => n[0]).join("")}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{p.name}</p>
                    <p className="text-sm text-gray-600">{p.position}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-gray-900">${(p.aav || 0).toLocaleString()}</p>
                    <p className="text-sm text-gray-600">AAV</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}