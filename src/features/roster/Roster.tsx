import { useEffect, useMemo, useState } from "react";
import { Plus, Filter } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useRoster, useDatabase } from "@/hooks/useDatabase";
import { num, str, boolFromSql } from "@/lib/sqlUtils";
import type { RosterData, SqlRow } from "@/types/erp";

export default function Roster() {
  const { isInitialized, isLoading, error } = useDatabase();
  const r = useRoster();
  const [data, setData] = useState<RosterData | null>(null);

  useEffect(() => {
    // Gate the effect on database being ready
    if (!isInitialized || isLoading || error) {
      return;
    }

    let isMounted = true; // Prevent state updates after unmount

    (async () => {
      try {
        const [playersRaw, faRaw, capRaw] = await Promise.all([
          r.getPlayers?.(),
          r.getFreeAgents?.(),
          r.getCapLedger?.(),
        ]);

        // Only update state if component is still mounted
        if (!isMounted) return;

        const players = (playersRaw as SqlRow[] | undefined)?.map(row => ({
          name: str(row.name),
          position: str(row.position),
          age: num(row.age),
          active: boolFromSql(row.active),
          aav: num(row.aav),
          start_year: num(row.start_year),
          end_year: num(row.end_year),
        })) ?? [];

        const freeAgents = (faRaw as SqlRow[] | undefined)?.map(row => ({
          name: str(row.name),
          position: str(row.position),
          expected_aav: num(row.expected_aav),
          years: num(row.years),
        })) ?? [];

        const capLedger = (capRaw as SqlRow[] | undefined)?.map(row => ({
          amount: num(row.amount),
        })) ?? [];

        setData({ players, freeAgents, capLedger });
      } catch (err) {
        console.error('Error fetching roster data:', err);
      }
    })();

    // Cleanup function to prevent state updates after unmount
    return () => {
      isMounted = false;
    };
  }, [isInitialized, isLoading, error, r]);

  const totalActive = useMemo(() => data?.players.filter(p => p.active).length ?? 0, [data]);
  const totalPayroll = useMemo(() => data?.players.reduce((s, p) => s + (p.aav || 0), 0) ?? 0, [data]);

  // Handle loading and error states
  if (isLoading) {
    return <div className="text-center text-gray-600">Initializing database...</div>;
  }

  if (error) {
    return <div className="text-center text-red-600">Database error: {error}</div>;
  }

  if (!data) {
    return <div className="text-center text-gray-600">Loading roster...</div>;
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Roster</h1>
        <div className="flex gap-3">
          <Button size="sm"><Plus className="w-4 h-4 mr-2" /> Add Player</Button>
          <Button variant="outline" size="sm"><Filter className="w-4 h-4 mr-2" /> Filters</Button>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-gray-600">Active Players</p>
            <p className="text-3xl font-bold text-gray-900">{totalActive}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-gray-600">Free Agents</p>
            <p className="text-3xl font-bold text-gray-900">{data.freeAgents.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-gray-600">Total Payroll</p>
            <p className="text-3xl font-bold text-gray-900">${totalPayroll.toLocaleString()}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-gray-900">Players</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-gray-600">
                  <th className="py-2 pr-4">Name</th>
                  <th className="py-2 pr-4">Pos</th>
                  <th className="py-2 pr-4">Age</th>
                  <th className="py-2 pr-4">AAV</th>
                  <th className="py-2 pr-4">Term</th>
                  <th className="py-2 pr-4">Status</th>
                </tr>
              </thead>
              <tbody>
                {data.players.map((p, i) => (
                  <tr key={i} className="border-t border-gray-200">
                    <td className="py-2 pr-4 font-medium text-gray-900">{p.name}</td>
                    <td className="py-2 pr-4">{p.position}</td>
                    <td className="py-2 pr-4">{p.age}</td>
                    <td className="py-2 pr-4">${p.aav.toLocaleString()}</td>
                    <td className="py-2 pr-4">{p.start_year} to {p.end_year}</td>
                    <td className="py-2 pr-4">{p.active ? <Badge variant="secondary">Active</Badge> : <Badge variant="destructive">Inactive</Badge>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-gray-900">Free Agents</CardTitle></CardHeader>
        <CardContent className="grid md:grid-cols-2 gap-4">
          {data.freeAgents.map((fa, i) => (
            <div key={i} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
              <div>
                <p className="font-medium text-gray-900">{fa.name} - {fa.position}</p>
                <p className="text-xs text-gray-600">{fa.years} years expected</p>
              </div>
              <p className="font-medium text-gray-900">${fa.expected_aav.toLocaleString()}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}