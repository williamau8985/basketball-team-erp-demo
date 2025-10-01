"use client";

import { useMemo } from "react";
import { useDatabase } from "@/hooks/useDatabase";
import { formatWeekLabel, getCurrentWeek, parseWeekLabel, weekOrderingSql } from "@/lib/timeline";

const ARENA_CAPACITY = 10000;
const DEFAULT_AVERAGE_TICKET_PRICE = 75;
const ARENA_OPERATIONS_COST_PER_GAME = 125_000;

const roundCurrency = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

export interface MerchandiseOrderSummary {
  id: number;
  orderCode: string;
  orderDate: string;
  status: string;
  totalAmount: number;
}

export interface TicketGameSummary {
  id: number;
  opponent: string;
  date: string;
  venue: string;
  totalSeats: number;
  attendancePercentage: number;
  soldSeats: number;
  averageTicketPrice: number;
  potentialRevenue: number;
  realizedRevenue: number;
  lockedFloor: number;
  isClosed: boolean;
  lastUpdatedWeek: number | null;
  arenaOperationsCost: number;
}

export interface TicketWeeklySnapshot {
  gameId: number;
  weekLabel: string;
  attendancePercentage: number;
}

export interface AccountingSnapshot {
  totalRevenue: number;
  totalExpenses: number;
  netProfit: number;
  merchandiseRevenue: number;
  ticketRevenue: number;
  merchandiseCost: number;
  arenaOperationsExpense: number;
  arenaOperationsAccrual: number;
  otherExpenses: number;
  merchandiseOrders: MerchandiseOrderSummary[];
  ticketGames: TicketGameSummary[];
}

export function useAccounting() {
  const { api, isInitialized } = useDatabase();

  return useMemo(() => {
    if (!isInitialized) {
      return {
        isInitialized,
        getSnapshot: undefined,
        getMerchandiseRevenue: undefined,
        getTicketRevenue: undefined,
        getMerchandiseOrders: undefined,
        getTicketGames: undefined,
        getTicketWeeklySnapshots: undefined,
        updateGameAttendance: undefined,
        finalizeTicketWeek: undefined,
      } as const;
    }

    const getLedgerMerchandiseRevenue = (): number => {
      const rows = api.query(`
        SELECT ROUND(SUM(jl.credit - jl.debit), 2) AS total_revenue
        FROM journal_line jl
        JOIN gl_account ga ON ga.id = jl.account_id
        WHERE ga.code = '4010'
      `);

      return Number(rows[0]?.total_revenue ?? 0);
    };

    const getLedgerMerchandiseCost = (): number => {
      const rows = api.query(`
        SELECT ROUND(SUM(jl.debit - jl.credit), 2) AS total_cost
        FROM journal_line jl
        JOIN gl_account ga ON ga.id = jl.account_id
        WHERE ga.code = '5000'
      `);

      return Number(rows[0]?.total_cost ?? 0);
    };

    const getMerchandiseFinancials = () => {
      const ledgerRevenue = getLedgerMerchandiseRevenue();
      const ledgerCost = getLedgerMerchandiseCost();

      const recognizedOrderRows = api.query(`
        SELECT DISTINCT reference_id AS order_id
        FROM journal_line
        WHERE reference_type = 'sales_order' AND reference_id IS NOT NULL
      `);
      const recognizedOrderIds = new Set<number>(
        recognizedOrderRows.map(row => Number(row.order_id)).filter(id => Number.isFinite(id)),
      );

      const invoiceRows = api.query(`
        SELECT
          so.id AS order_id,
          so.total_amount AS order_total,
          COALESCE(SUM(CASE WHEN inv.status = 'Paid' THEN inv.amount ELSE 0 END), 0) AS paid_amount,
          COALESCE((
            SELECT SUM(sol.quantity * mi.cost_price)
            FROM merch_sales_order_line sol
            JOIN merch_item mi ON mi.id = sol.item_id
            WHERE sol.order_id = so.id
          ), 0) AS order_cost
        FROM merch_sales_order so
        LEFT JOIN merch_invoice inv ON inv.order_id = so.id
        GROUP BY so.id, so.total_amount
      `);

      let invoiceRevenue = 0;
      let invoiceCost = 0;

      invoiceRows.forEach(row => {
        const orderId = Number(row.order_id ?? 0);
        if (orderId && recognizedOrderIds.has(orderId)) {
          return;
        }

        const rawOrderTotal = Number(row.order_total ?? 0);
        const paidAmount = Number(row.paid_amount ?? 0);
        const orderCost = Number(row.order_cost ?? 0);

        if (paidAmount <= 0) {
          return;
        }

        const orderTotal = rawOrderTotal > 0 ? rawOrderTotal : 0;
        const recognizedRevenue = orderTotal > 0 ? Math.min(paidAmount, orderTotal) : Math.max(0, paidAmount);
        const recognitionRatio =
          orderTotal > 0
            ? Math.min(1, recognizedRevenue / orderTotal)
            : recognizedRevenue > 0
              ? 1
              : 0;

        invoiceRevenue += recognizedRevenue;
        invoiceCost += orderCost * recognitionRatio;
      });

      return {
        revenue: roundCurrency(ledgerRevenue + invoiceRevenue),
        cost: roundCurrency(ledgerCost + invoiceCost),
      } as const;
    };

    const getMerchandiseRevenue = (): number => {
      const { revenue } = getMerchandiseFinancials();
      return revenue;
    };

    const getMerchandiseOrders = (): MerchandiseOrderSummary[] => {
      const rows = api.query(`
        SELECT id, order_code, order_date, total_amount, status
        FROM merch_sales_order
        ORDER BY ${weekOrderingSql("order_date", "DESC")}
        LIMIT 8
      `);

      return rows.map(row => ({
        id: Number(row.id),
        orderCode: String(row.order_code),
        orderDate: String(row.order_date),
        status: String(row.status),
        totalAmount: Number(row.total_amount ?? 0),
      }));
    };

    const getTicketGames = (): TicketGameSummary[] => {
      const rows = api.query(`
        SELECT
          g.id,
          g.opponent,
          g.date,
          g.venue,
          COUNT(ti.id) AS total_seats,
          COALESCE(SUM(tt.price), 0) AS total_price_value,
          COALESCE(MAX(s.attendance_percentage), 0) AS attendance_percentage,
          COALESCE(MAX(s.locked_attendance_percentage), 0) AS locked_attendance_percentage,
          COALESCE(MAX(s.last_updated), '') AS last_updated
        FROM game g
        LEFT JOIN ticket_inventory ti ON g.id = ti.game_id
        LEFT JOIN ticket_type tt ON ti.type_id = tt.id
        LEFT JOIN game_ticket_sales s ON g.id = s.game_id
        GROUP BY g.id, g.opponent, g.date, g.venue
        ORDER BY ${weekOrderingSql("g.date")}
      `);

      const currentWeek = getCurrentWeek();

      return rows.map(row => {
        const attendancePercentage = Number(row.attendance_percentage ?? 0);
        const averageTicketPrice = DEFAULT_AVERAGE_TICKET_PRICE;
        const totalSeats = ARENA_CAPACITY;
        const soldSeats = Math.round((attendancePercentage / 100) * totalSeats);
        const potentialRevenue = Number((averageTicketPrice * totalSeats).toFixed(2));
        const realizedRevenue = Number((averageTicketPrice * soldSeats).toFixed(2));
        const gameWeek = parseWeekLabel(String(row.date));
        const lastUpdatedLabelRaw = String(row.last_updated ?? "").trim();
        const lastUpdatedWeek = lastUpdatedLabelRaw ? parseWeekLabel(lastUpdatedLabelRaw) : null;
        const lockedFloor = Math.max(
          0,
          Math.min(
            Math.min(100, Number(row.attendance_percentage ?? 0)),
            Math.min(100, Number(row.locked_attendance_percentage ?? 0)),
          ),
        );
        const isClosed = currentWeek >= gameWeek + 1;

        return {
          id: Number(row.id),
          opponent: String(row.opponent),
          date: String(row.date),
          venue: String(row.venue),
          totalSeats,
          attendancePercentage,
          soldSeats,
          averageTicketPrice,
          potentialRevenue,
          realizedRevenue,
          lockedFloor,
          isClosed,
          lastUpdatedWeek,
          arenaOperationsCost: isClosed ? ARENA_OPERATIONS_COST_PER_GAME : 0,
        } satisfies TicketGameSummary;
      });
    };

    const getTicketWeeklySnapshots = (): TicketWeeklySnapshot[] => {
      const rows = api.query(`
        SELECT
          gws.game_id,
          gws.week_label,
          gws.attendance_percentage
        FROM game_ticket_weekly_sales gws
        ORDER BY gws.game_id, ${weekOrderingSql("gws.week_label")}
      `);

      return rows.map(row => ({
        gameId: Number(row.game_id),
        weekLabel: String(row.week_label),
        attendancePercentage: Number(row.attendance_percentage ?? 0),
      }));
    };

    const getTicketRevenue = (): number => {
      return getTicketGames().reduce((sum, game) => sum + game.realizedRevenue, 0);
    };

    const getArenaExpenseFromJournal = (): number => {
      const rows = api.query(`
        SELECT ROUND(SUM(jl.debit - jl.credit), 2) AS total_expense
        FROM journal_line jl
        JOIN gl_account ga ON ga.id = jl.account_id
        WHERE ga.code = '5200'
      `);

      return Number(rows[0]?.total_expense ?? 0);
    };

    const getOtherExpenses = (): number => {
      const rows = api.query(`
        SELECT ROUND(SUM(jl.debit - jl.credit), 2) AS total_expense
        FROM journal_line jl
        JOIN gl_account ga ON ga.id = jl.account_id
        WHERE ga.type = 'Expense'
          AND ga.code NOT IN ('5000', '5200')
      `);

      return Number(rows[0]?.total_expense ?? 0);
    };

    const getSnapshot = (): AccountingSnapshot => {
      const { revenue: merchandiseRevenue, cost: merchandiseCost } = getMerchandiseFinancials();
      const merchandiseOrders = getMerchandiseOrders();
      const ticketGames = getTicketGames();
      const ticketRevenue = ticketGames.reduce((sum, game) => sum + game.realizedRevenue, 0);
      const arenaOperationsAccrual = ticketGames.reduce(
        (sum, game) => sum + game.arenaOperationsCost,
        0,
      );
      const recordedArenaExpense = getArenaExpenseFromJournal();
      const arenaOperationsExpense = recordedArenaExpense + arenaOperationsAccrual;
      const otherExpenses = getOtherExpenses();
      const totalRevenue = merchandiseRevenue + ticketRevenue;
      const totalExpenses = merchandiseCost + arenaOperationsExpense + otherExpenses;
      const netProfit = totalRevenue - totalExpenses;

      return {
        totalRevenue,
        totalExpenses,
        netProfit,
        merchandiseRevenue,
        ticketRevenue,
        merchandiseCost,
        arenaOperationsExpense,
        arenaOperationsAccrual,
        otherExpenses,
        merchandiseOrders,
        ticketGames,
      } satisfies AccountingSnapshot;
    };

    const updateGameAttendance = (gameId: number, attendancePercentage: number) => {
      const normalized = Math.max(
        0,
        Math.min(100, Number.isFinite(attendancePercentage) ? attendancePercentage : 0),
      );

      const existingAttendanceRow = api.query(
        "SELECT attendance_percentage, locked_attendance_percentage, last_updated FROM game_ticket_sales WHERE game_id = ?",
        [gameId],
      );
      const previousAttendance = Math.max(
        0,
        Math.min(100, Number(existingAttendanceRow[0]?.attendance_percentage ?? 0)),
      );
      const lockedAttendance = Math.max(
        0,
        Math.min(100, Number(existingAttendanceRow[0]?.locked_attendance_percentage ?? 0)),
      );
      const gameRow = api.query("SELECT date FROM game WHERE id = ? LIMIT 1", [gameId]);
      const rawGameDate = String(gameRow[0]?.date ?? formatWeekLabel(getCurrentWeek()));
      const gameWeek = parseWeekLabel(rawGameDate);
      const currentWeek = getCurrentWeek();
      const isClosed = currentWeek >= gameWeek + 1;

      if (isClosed) {
        return;
      }

      const lockedFloor = Math.max(lockedAttendance, previousAttendance);
      const effectiveAttendance = Math.max(lockedFloor, normalized);

      const weekLabel = formatWeekLabel(currentWeek);

      api.run(
        `INSERT INTO game_ticket_sales (game_id, attendance_percentage, locked_attendance_percentage, last_updated)
         VALUES (?, ?, ?, ?)
          ON CONFLICT(game_id) DO UPDATE SET
            attendance_percentage = excluded.attendance_percentage,
            locked_attendance_percentage = excluded.locked_attendance_percentage,
            last_updated = excluded.last_updated`,
        [gameId, effectiveAttendance, lockedAttendance, weekLabel],
      );

      api.run(
        `INSERT INTO game_ticket_weekly_sales (game_id, week_label, attendance_percentage)
         VALUES (?, ?, ?)
         ON CONFLICT(game_id, week_label) DO UPDATE SET
           attendance_percentage = excluded.attendance_percentage`,
        [gameId, weekLabel, effectiveAttendance],
      );
    };

    const finalizeTicketWeek = (week: number) => {
      const normalizedWeek = Math.max(1, Math.round(week));
      const weekLabel = formatWeekLabel(normalizedWeek);
      const games = getTicketGames();
      const weeklyRevenue = games
        .filter(game => parseWeekLabel(game.date) === normalizedWeek)
        .reduce((sum, game) => sum + game.realizedRevenue, 0);
      const normalizedRevenue = Number(weeklyRevenue.toFixed(2));

      api.run(
        `INSERT INTO ticket_weekly_revenue (week_label, revenue, finalized_at)
         VALUES (?, ?, ?)
         ON CONFLICT(week_label) DO UPDATE SET
           revenue = excluded.revenue,
           finalized_at = excluded.finalized_at`,
        [weekLabel, normalizedRevenue, new Date().toISOString()]
      );

      api.run(`
        UPDATE game_ticket_sales
        SET locked_attendance_percentage = CASE
          WHEN attendance_percentage > locked_attendance_percentage THEN attendance_percentage
          ELSE locked_attendance_percentage
        END
      `);

      return { weekLabel, revenue: normalizedRevenue } as const;
    };

    return {
      isInitialized,
      getSnapshot,
      getMerchandiseRevenue,
      getTicketRevenue,
      getMerchandiseOrders,
      getTicketGames,
      getTicketWeeklySnapshots,
      updateGameAttendance,
      finalizeTicketWeek,
    } as const;
  }, [api, isInitialized]);
}
