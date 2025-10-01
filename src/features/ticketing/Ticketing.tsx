import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { Progress } from "@/components/ui/progress";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { useTicketing, useDatabase } from "@/hooks/useDatabase";
import { useAccounting, type TicketGameSummary, type TicketWeeklySnapshot } from "@/hooks/useAccounting";
import { useTimeline } from "@/hooks/useTimeline";
import { num, str } from "@/lib/sqlUtils";
import { formatWeekLabel, parseWeekLabel } from "@/lib/timeline";
import type { TicketingData, SqlRow } from "@/types/erp";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";

const chartPalette = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
] as const;

type TicketChartDatum = {
  weekLabel: string;
  total: number;
} & Record<string, number | string>;

type LineConfig = {
  key: string;
  label: string;
  color: string;
};

const formatCurrency = (value: number) =>
  `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function Ticketing() {
  const { isInitialized, isLoading, error } = useDatabase();
  const tix = useTicketing();
  const accounting = useAccounting();
  const { currentWeek } = useTimeline();
  type TicketOrder = TicketingData["orders"][number];

  const [orders, setOrders] = useState<TicketOrder[]>([]);
  const [games, setGames] = useState<TicketGameSummary[]>([]);
  const [weeklySnapshots, setWeeklySnapshots] = useState<TicketWeeklySnapshot[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedGameId, setSelectedGameId] = useState<number | null>(null);
  const [sliderValue, setSliderValue] = useState(0);
  const [isSaving, setSaving] = useState(false);

  useEffect(() => {
    if (!isInitialized || isLoading || error || !tix.getTicketOrders) {
      return;
    }

    let isMounted = true;
    const timelineWeek = currentWeek;

    (async () => {
      try {
        const ordersRaw = await Promise.resolve(tix.getTicketOrders?.());

        if (!isMounted) {
          return;
        }

        const nextOrders = (ordersRaw as SqlRow[] | undefined)?.map(r => ({
          customer_name: str(r.customer_name),
          opponent: str(r.opponent),
          game_date: str(r.game_date),
          status: str(r.status),
          total: num(r.total),
        })) ?? [];

        const ticketGames = accounting.getTicketGames?.() ?? [];
        const ticketSnapshots = accounting.getTicketWeeklySnapshots?.() ?? [];

        if (!isMounted) {
          return;
        }

        if (timelineWeek !== currentWeek) {
          return;
        }

        setOrders(nextOrders);
        setGames(ticketGames);
        setWeeklySnapshots(ticketSnapshots);
      } catch (err) {
        console.error("Error fetching ticketing data:", err);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [isInitialized, isLoading, error, tix, accounting, currentWeek]);

  const openOrders = useMemo(() => orders.filter(o => o.status !== "Cancelled"), [orders]);
  const totalTicketRevenue = useMemo(
    () => games.reduce((sum, game) => sum + game.realizedRevenue, 0),
    [games],
  );

  const { weeklyData, lineConfigs } = useMemo<{
    weeklyData: TicketChartDatum[];
    lineConfigs: LineConfig[];
  }>(() => {
    if (games.length === 0) {
      return { weeklyData: [], lineConfigs: [] };
    }

    const sortedGames = [...games].sort((a, b) => {
      const weekDiff = parseWeekLabel(a.date) - parseWeekLabel(b.date);
      if (weekDiff !== 0) {
        return weekDiff;
      }
      return a.id - b.id;
    });

    const snapshotsByGame = weeklySnapshots.reduce(
      (acc, snapshot) => {
        const week = parseWeekLabel(snapshot.weekLabel);
        const next = acc.get(snapshot.gameId) ?? [];
        next.push({ week, attendancePercentage: snapshot.attendancePercentage });
        acc.set(snapshot.gameId, next);
        return acc;
      },
      new Map<number, { week: number; attendancePercentage: number }[]>(),
    );

    const snapshotWeeks = weeklySnapshots.map(snapshot => parseWeekLabel(snapshot.weekLabel));
    const maxSnapshotWeek = snapshotWeeks.length > 0 ? Math.max(...snapshotWeeks) : 1;
    const maxWeek = Math.max(currentWeek, maxSnapshotWeek, 1);

    const weekEntries = Array.from({ length: maxWeek }, (_, index) => {
      const weekNumber = index + 1;
      return {
        week: weekNumber,
        data: { weekLabel: formatWeekLabel(weekNumber), total: 0 } as TicketChartDatum,
      };
    });

    const lineConfigs = sortedGames.map((game, index) => {
      const key = `game_${game.id}`;
      const label = `${game.opponent} (${game.venue})`;
      const color = chartPalette[index % chartPalette.length];
      const snapshots = (snapshotsByGame.get(game.id) ?? []).sort((a, b) => a.week - b.week);

      let pointer = 0;
      let activePercentage = 0;
      let previousSeats = 0;

      weekEntries.forEach(({ week, data }) => {
        while (pointer < snapshots.length && snapshots[pointer].week <= week) {
          activePercentage = snapshots[pointer].attendancePercentage;
          pointer += 1;
        }

        const cumulativeSeats = Math.round((activePercentage / 100) * game.totalSeats);
        const weeklySeats = Math.max(0, cumulativeSeats - previousSeats);

        data[key] = weeklySeats;
        data.total += weeklySeats;
        previousSeats = cumulativeSeats;
      });

      return { key, label, color } satisfies LineConfig;
    });

    const weeklyData = weekEntries.map(({ data }) => data);

    return { weeklyData, lineConfigs };
  }, [currentWeek, games, weeklySnapshots]);

  const byGameChartConfig = useMemo<ChartConfig>(() => {
    return lineConfigs.reduce((acc, config) => {
      acc[config.key] = { label: config.label, color: config.color };
      return acc;
    }, {} as ChartConfig);
  }, [lineConfigs]);

  const aggregatedChartData = useMemo(
    () => weeklyData.map(dataPoint => ({ weekLabel: dataPoint.weekLabel, total: Number(dataPoint.total ?? 0) })),
    [weeklyData],
  );

  const aggregatedChartConfig = useMemo<ChartConfig>(
    () => ({ total: { label: "All Games", color: "var(--chart-1)" } }),
    [],
  );

  const selectedGame = useMemo(() => {
    if (selectedGameId === null) {
      return null;
    }

    return games.find(game => game.id === selectedGameId) ?? null;
  }, [games, selectedGameId]);

  useEffect(() => {
    if (!dialogOpen || !selectedGame) {
      return;
    }

    const baseline = Math.round(selectedGame.attendancePercentage);
    const lockedFloor = Math.round(selectedGame.lockedFloor);
    setSliderValue(Math.max(lockedFloor, baseline));
  }, [dialogOpen, selectedGame]);

  const sliderFloor = selectedGame ? Math.round(selectedGame.lockedFloor) : 0;

  const handleDialogChange = (open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      setSelectedGameId(null);
    }
  };

  const handleSaveAttendance = () => {
    if (!selectedGame || !accounting.updateGameAttendance) {
      return;
    }

    setSaving(true);
    try {
      const floor = Math.round(selectedGame.lockedFloor);
      const nextAttendance = Math.max(floor, sliderValue);

      accounting.updateGameAttendance(selectedGame.id, nextAttendance);

      const updatedGames = games.map(game => {
        if (game.id !== selectedGame.id) {
          return game;
        }

        const soldSeats = Math.round((nextAttendance / 100) * game.totalSeats);
        const realizedRevenue = Number((game.averageTicketPrice * soldSeats).toFixed(2));

        return {
          ...game,
          attendancePercentage: nextAttendance,
          soldSeats,
          realizedRevenue,
          lockedFloor: game.lockedFloor,
          lastUpdatedWeek: currentWeek,
        } satisfies TicketGameSummary;
      });

      setGames(updatedGames);
      const nextWeekLabel = formatWeekLabel(currentWeek);
      setWeeklySnapshots(previousSnapshots => {
        const withoutCurrentWeek = previousSnapshots.filter(
          snapshot => !(snapshot.gameId === selectedGame.id && snapshot.weekLabel === nextWeekLabel),
        );
        return [
          ...withoutCurrentWeek,
          {
            gameId: selectedGame.id,
            weekLabel: nextWeekLabel,
            attendancePercentage: nextAttendance,
          },
        ];
      });
      setDialogOpen(false);
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return <div className="text-center text-gray-600">Initializing database...</div>;
  }

  if (error) {
    return <div className="text-center text-red-600">Database error: {error}</div>;
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Ticketing</h1>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-gray-600">Scheduled Games</p>
            <p className="text-3xl font-bold text-gray-900">{games.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-gray-600">Open Orders</p>
            <p className="text-3xl font-bold text-gray-900">{openOrders.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-gray-600">Ticket Revenue to Date</p>
            <p className="text-3xl font-bold text-gray-900">{formatCurrency(totalTicketRevenue)}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-gray-900">Weekly Ticket Sales Overview</CardTitle>
          <CardDescription>Track how many tickets have been sold for each matchup.</CardDescription>
        </CardHeader>
        <CardContent>
          {weeklyData.length === 0 || lineConfigs.length === 0 ? (
            <p className="text-sm text-gray-500">Ticket sales data will appear once games are scheduled.</p>
          ) : (
            <Tabs defaultValue="by-game" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="by-game">By Game</TabsTrigger>
                <TabsTrigger value="all-games">All Games</TabsTrigger>
              </TabsList>
              <TabsContent value="by-game" className="mt-4">
                <ChartContainer config={byGameChartConfig} className="h-64 !aspect-auto">
                  <LineChart
                    accessibilityLayer
                    data={weeklyData}
                    margin={{ left: 12, right: 12 }}
                  >
                    <CartesianGrid vertical={false} />
                    <XAxis dataKey="weekLabel" tickLine={false} axisLine={false} tickMargin={8} />
                    <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={40} />
                    <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
                    {lineConfigs.map(config => (
                      <Line
                        key={config.key}
                        dataKey={config.key}
                        type="step"
                        stroke={`var(--color-${config.key})`}
                        strokeWidth={2}
                        dot={false}
                      />
                    ))}
                  </LineChart>
                </ChartContainer>
              </TabsContent>
              <TabsContent value="all-games" className="mt-4">
                <ChartContainer config={aggregatedChartConfig} className="h-64 !aspect-auto">
                  <LineChart
                    accessibilityLayer
                    data={aggregatedChartData}
                    margin={{ left: 12, right: 12 }}
                  >
                    <CartesianGrid vertical={false} />
                    <XAxis dataKey="weekLabel" tickLine={false} axisLine={false} tickMargin={8} />
                    <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={40} />
                    <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
                    <Line
                      dataKey="total"
                      type="step"
                      stroke="var(--color-total)"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ChartContainer>
              </TabsContent>
            </Tabs>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-gray-900">Manage Attendance &amp; Ticket Sales</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {games.map(game => (
            <div key={game.id} className="rounded-lg border border-gray-200 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-medium text-gray-900">{game.date} vs {game.opponent}</p>
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
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={game.isClosed}
                    onClick={() => {
                      if (game.isClosed) {
                        return;
                      }
                      setSelectedGameId(game.id);
                      setDialogOpen(true);
                    }}
                  >
                    Adjust Attendance
                  </Button>
                </div>
              </div>
              <div className="mt-3 space-y-2">
                <div className="flex items-center justify-between text-xs text-gray-600">
                  <span>Attendance</span>
                  <span>
                    {Math.round(game.attendancePercentage)}% · {game.soldSeats.toLocaleString()} / {game.totalSeats.toLocaleString()} seats
                  </span>
                </div>
                <Progress value={game.attendancePercentage} />
                <div className="flex items-center justify-between text-sm text-gray-700">
                  <span>Projected revenue</span>
                  <span className="font-medium">{formatCurrency(game.realizedRevenue)}</span>
                </div>
              </div>
            </div>
          ))}
          {games.length === 0 && (
            <p className="text-sm text-gray-500">No games scheduled yet.</p>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={handleDialogChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adjust attendance</DialogTitle>
            {selectedGame && (
              <DialogDescription>
                Ticket availability for {selectedGame.opponent} — {selectedGame.date}
              </DialogDescription>
            )}
          </DialogHeader>

          {selectedGame ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-sm text-gray-700">
                <span>Attendance</span>
                <span>
                  {Math.round(sliderValue)}% · {Math.round((sliderValue / 100) * selectedGame.totalSeats).toLocaleString()} /
                  {" "}
                  {selectedGame.totalSeats.toLocaleString()} seats
                </span>
              </div>
              <Slider
                value={[sliderValue]}
                onValueChange={values => {
                  const rawValue = Math.round(values[0] ?? sliderFloor);
                  setSliderValue(Math.max(sliderFloor, Math.min(100, rawValue)));
                }}
                min={sliderFloor}
                max={100}
                step={1}
              />
              <div className="rounded-md bg-gray-50 p-3 text-sm text-gray-700">
                <div className="flex items-center justify-between">
                  <span>Estimated revenue</span>
                  <span className="font-semibold">
                    {formatCurrency(
                      Number((selectedGame.averageTicketPrice * Math.round((sliderValue / 100) * selectedGame.totalSeats)).toFixed(2))
                    )}
                  </span>
                </div>
                <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
                  <span>Average ticket price</span>
                  <span>{formatCurrency(selectedGame.averageTicketPrice)}</span>
                </div>
                <div className="mt-1 text-xs text-gray-500">
                  Capacity locks one week after the game week ({formatWeekLabel(parseWeekLabel(selectedGame.date) + 1)}).
                </div>
              </div>
              {selectedGame.lockedFloor > 0 && (
                <p className="text-xs text-amber-600">
                  Ticket sales from previous weeks are final. Attendance can only increase beyond the
                  saved total.
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-600">Select a game to manage attendance.</p>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveAttendance}
              disabled={!selectedGame || isSaving}
            >
              {isSaving ? "Saving..." : "Save attendance"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

