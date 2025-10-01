"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { openDatabase, exportDB, loadFromStorage, saveToStorage, seedDatabase, migrateDatabase } from "@/lib/database";
import { addWeeks, ensureWeekLabel, formatWeekLabel, getCurrentWeek, parseWeekLabel, weekOrderingSql } from "@/lib/timeline";
import type { NewMerchInvoice, NewMerchSalesOrder } from "@/types/erp";

interface DatabaseRow {
  [key: string]: string | number | boolean | null;
}

type DBApi = {
  run: (sql: string, params?: any[]) => void;
  query: (sql: string, params?: any[]) => DatabaseRow[];
};

// Global initialization flag to prevent multiple database initializations
let globalDbInitialized = false;
let globalDbInstance: any = null;

export function useDatabase() {
  const [isLoading, setLoading] = useState(!globalDbInitialized);
  const [isInitialized, setInitialized] = useState(globalDbInitialized);
  const [error, setError] = useState<string | null>(null);
  const dbRef = useRef<any | null>(globalDbInstance);
  const initializingRef = useRef(false);

  useEffect(() => {
    // If already initialized globally, just use the existing instance
    if (globalDbInitialized && globalDbInstance) {
      dbRef.current = globalDbInstance;
      setInitialized(true);
      setLoading(false);
      return;
    }

    // Prevent concurrent initialization attempts
    if (initializingRef.current) {
      return;
    }

    initializingRef.current = true;

    (async () => {
      try {
        console.log("Initializing database...");
        const persisted = await loadFromStorage();
        const db = await openDatabase(persisted ?? undefined);
        
        let shouldPersist = false;

        if (!persisted) {
          console.log("No persisted database found, seeding...");
          seedDatabase(db);
          shouldPersist = true;
        } else {
          console.log("Loaded persisted database from storage");
        }

        const migrated = migrateDatabase(db);
        if (migrated) {
          console.log("Database migrated to latest merchandise schema");
          shouldPersist = true;
        }

        if (shouldPersist) {
          await saveToStorage(db);
        }
        
        // Set global instance
        globalDbInstance = db;
        globalDbInitialized = true;
        dbRef.current = db;
        
        setInitialized(true);
        setLoading(false);
        console.log("Database initialization complete");
      } catch (e: any) {
        console.error("Database initialization failed:", e);
        setError(e?.message || String(e));
        setLoading(false);
        initializingRef.current = false;
      }
    })();
  }, []); // Empty dependency array - only run once

  const api: DBApi = useMemo(() => ({
    run: (sql, params = []) => {
      if (!dbRef.current) throw new Error("DB not ready");
      dbRef.current.run(sql, params);
    },
    query: (sql, params = []) => {
      if (!dbRef.current) throw new Error("DB not ready");
      const stmt = dbRef.current.prepare(sql);
      const rows: DatabaseRow[] = [];
      stmt.bind(params);
      while (stmt.step()) rows.push(stmt.getAsObject());
      stmt.free();
      return rows;
    },
  }), []);

  async function exportDatabase() {
    if (!dbRef.current) throw new Error("DB not ready");
    const data = await exportDB(dbRef.current);
    return new Uint8Array(data);
  }

  async function importDatabase(data: Uint8Array) {
    const db = await openDatabase(data);
    globalDbInstance = db;
    dbRef.current = db;
    await saveToStorage(db);
    setInitialized(true);
  }

  async function resetDatabase() {
    console.log("Resetting database...");
    const db = await openDatabase();
    seedDatabase(db);
    await saveToStorage(db);
    globalDbInstance = db;
    dbRef.current = db;
    setInitialized(true);
    // Force a page reload to reset all components
    window.location.reload();
  }

  const persistDatabase = useCallback(async () => {
    if (!dbRef.current) throw new Error("DB not ready");
    await saveToStorage(dbRef.current);
  }, []);

  return {
    isLoading,
    isInitialized,
    error,
    api,
    persistDatabase,
    exportDatabase,
    importDatabase,
    resetDatabase,
  };
}

// Convenience hooks for your specific data
function generateDocumentCode(prefix: string) {
  const week = getCurrentWeek();
  const randomPart = Math.floor(Math.random() * 900 + 100);
  return `${prefix}-W${String(week).padStart(2, "0")}-${randomPart}`;
}

function buildProcurementRequestNote(
  quantity: number,
  minimumGap: number,
  backorderUnits: number
): string | null {
  const notes: string[] = [];

  if (minimumGap > 0) {
    if (quantity >= minimumGap) {
      notes.push(`Raises stock to minimum target (covers ${minimumGap} unit gap).`);
    } else {
      const remaining = minimumGap - quantity;
      notes.push(`Leaves ${remaining} unit${remaining === 1 ? "" : "s"} short of minimum target.`);
    }
  }

  if (backorderUnits > 0) {
    if (quantity >= backorderUnits) {
      notes.push(`Fulfills backorders (${backorderUnits} unit${backorderUnits === 1 ? "" : "s"}).`);
    } else {
      const remainingBackorders = backorderUnits - quantity;
      notes.push(
        `Leaves ${remainingBackorders} backordered unit${remainingBackorders === 1 ? "" : "s"}.`
      );
    }
  }

  if (!notes.length) {
    return null;
  }

  return notes.join(" ");
}

const INVENTORY_RESERVED_STATUS = "Successful - Inventory Reserved" as const;
const AWAITING_WAREHOUSE_APPROVAL_STAGE = "Awaiting Warehouse Approval" as const;
const PACKAGING_STAGE = "Packaging" as const;

export function useMerchandise() {
  const { api, isInitialized, persistDatabase } = useDatabase();

  return useMemo(() => ({
    isInitialized,
    getItems: isInitialized ? () => api.query('SELECT * FROM merch_item ORDER BY name') : undefined,
    getStores: isInitialized ? () => api.query('SELECT * FROM retail_store ORDER BY name') : undefined,
    getSalesOrders: isInitialized ? () => api.query(`
      SELECT so.*, rs.name as store_name, rs.tier as store_tier
      FROM merch_sales_order so
      JOIN retail_store rs ON so.store_id = rs.id
      ORDER BY ${weekOrderingSql("so.order_date", "DESC")}
    `) : undefined,
    getSalesOrderLines: isInitialized ? () => api.query(`
      SELECT sol.*, mi.name as item_name, mi.sku as item_sku, so.order_code
      FROM merch_sales_order_line sol
      JOIN merch_item mi ON sol.item_id = mi.id
      JOIN merch_sales_order so ON sol.order_id = so.id
      ORDER BY ${weekOrderingSql("so.order_date", "DESC")}, sol.id
    `) : undefined,
    getProcurementOrders: isInitialized ? () => api.query(`
      SELECT po.*, mi.name as item_name, mi.sku as item_sku
      FROM merch_procurement_po po
      JOIN merch_item mi ON po.item_id = mi.id
      ORDER BY ${weekOrderingSql("po.order_date", "DESC")}
    `) : undefined,
    getProcurementRequests: isInitialized ? () => api.query(`
      SELECT req.*, mi.name as item_name, mi.sku as item_sku
      FROM merch_procurement_request req
      JOIN merch_item mi ON req.item_id = mi.id
      ORDER BY ${weekOrderingSql("req.requested_at", "DESC")}, req.id DESC
    `) : undefined,
    getShipments: isInitialized ? () => api.query(`
      SELECT sh.*, rs.name as store_name, so.order_code
      FROM merch_shipment sh
      JOIN merch_sales_order so ON sh.order_id = so.id
      JOIN retail_store rs ON sh.store_id = rs.id
      ORDER BY CASE sh.status WHEN 'Delivered' THEN 1 ELSE 0 END, ${weekOrderingSql("sh.expected_delivery")}
    `) : undefined,
    getInvoices: isInitialized ? () => api.query(`
      SELECT inv.*, rs.name as store_name
      FROM merch_invoice inv
      JOIN retail_store rs ON inv.store_id = rs.id
      ORDER BY ${weekOrderingSql("inv.due_date")}
    `) : undefined,
    createSalesOrder: isInitialized
      ? async (order: NewMerchSalesOrder) => {
          if (!order.lines.length) {
            throw new Error("A sales order requires at least one line item.");
          }

          order.lines.forEach(line => {
            if (line.quantity < 5) {
              throw new Error("Each line item must meet the minimum order quantity of five units.");
            }
          });

          const orderCode = generateDocumentCode("SO");
          const totalAmount = order.lines.reduce(
            (sum, line) => sum + line.quantity * line.unitPrice,
            0
          );

          const orderWeek = ensureWeekLabel(order.orderDate);

          api.run(
            `INSERT INTO merch_sales_order (
              order_code,
              store_id,
              status,
              workflow_stage,
              order_date,
              total_amount,
              notes
            ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
              orderCode,
              order.storeId,
              order.status,
              order.workflowStage,
              orderWeek,
              totalAmount,
              order.notes ?? null,
            ]
          );

          const inserted = api.query("SELECT last_insert_rowid() as id");
          const orderId = Number(inserted[0]?.id ?? 0);

          order.lines.forEach(line => {
            api.run(
              `INSERT INTO merch_sales_order_line (order_id, item_id, quantity, unit_price)
               VALUES (?, ?, ?, ?)`,
              [orderId, line.itemId, line.quantity, line.unitPrice]
            );
          });

          recalculateInventoryAllocations(api);

          const uniqueItemIds = Array.from(new Set(order.lines.map(line => line.itemId)));
          uniqueItemIds.forEach(itemId => {
            maybeTriggerReorder(api, itemId, orderWeek);
          });

          await persistDatabase();
          return orderId;
        }
      : undefined,
    createInvoice: isInitialized
      ? async (invoice: NewMerchInvoice) => {
          const invoiceCode = generateDocumentCode("INV-M");
          const issuedWeek = ensureWeekLabel(invoice.issuedDate);
          const dueWeek = ensureWeekLabel(invoice.dueDate);

          api.run(
            `INSERT INTO merch_invoice (
              invoice_code,
              order_id,
              store_id,
              amount,
              issued_date,
              due_date,
              status
            ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
              invoiceCode,
              invoice.orderId,
              invoice.storeId,
              invoice.amount,
              issuedWeek,
              dueWeek,
              invoice.status,
            ]
          );
          await persistDatabase();
        }
      : undefined,
    updateInvoiceStatus: isInitialized
      ? async (invoiceId: number, status: string) => {
          const invoiceRows = api.query(
            `SELECT mi.id, mi.status, mi.amount, mi.order_id, mi.issued_date, so.order_code
             FROM merch_invoice mi
             JOIN merch_sales_order so ON so.id = mi.order_id
             WHERE mi.id = ?`,
            [invoiceId]
          );

          if (!invoiceRows.length) {
            return;
          }

          const invoiceRow = invoiceRows[0];
          const previousStatus = String(invoiceRow.status);

          if (previousStatus === status) {
            return;
          }

          api.run(`UPDATE merch_invoice SET status = ? WHERE id = ?`, [status, invoiceId]);

          if (status === "Paid") {
            const orderId = Number(invoiceRow.order_id);
            const invoiceAmount = Number(invoiceRow.amount ?? 0);
            const orderCode = String(invoiceRow.order_code ?? `SO-${orderId}`);

            const existingJournal = api.query(
              `SELECT 1
               FROM journal_line
               WHERE reference_type = 'sales_order'
                 AND reference_id = ?
               LIMIT 1`,
              [orderId]
            );

            if (!existingJournal.length && invoiceAmount > 0 && orderId) {
              const costRow = api.query(
                `SELECT COALESCE(SUM(sol.quantity * mi.cost_price), 0) AS cost
                 FROM merch_sales_order_line sol
                 JOIN merch_item mi ON mi.id = sol.item_id
                 WHERE sol.order_id = ?`,
                [orderId]
              );

              const orderCost = Number(costRow[0]?.cost ?? 0);

              const getAccountId = (code: string): number => {
                const accountRow = api.query(`SELECT id FROM gl_account WHERE code = ? LIMIT 1`, [code]);
                return Number(accountRow[0]?.id ?? 0);
              };

              const cashAccountId = getAccountId("1000");
              const revenueAccountId = getAccountId("4010");
              const cogsAccountId = getAccountId("5000");
              const inventoryAccountId = getAccountId("1200");

              if (cashAccountId && revenueAccountId) {
                const nextEntryNumber = (() => {
                  const latest = api.query(
                    `SELECT entry_number
                     FROM journal_entry
                     ORDER BY id DESC
                     LIMIT 1`
                  );

                  const lastNumber = String(latest[0]?.entry_number ?? "JE-0000");
                  const match = lastNumber.match(/JE-(\d+)/);
                  const nextSequence = match ? Number(match[1]) + 1 : 1;
                  return `JE-${String(nextSequence).padStart(4, "0")}`;
                })();

                const entryDate = formatWeekLabel(getCurrentWeek());
                const description = `Sales order ${orderCode} payment`;

                api.run(
                  `INSERT INTO journal_entry (entry_number, entry_date, description, posted)
                   VALUES (?, ?, ?, 1)`,
                  [nextEntryNumber, entryDate, description]
                );

                const inserted = api.query(`SELECT last_insert_rowid() as id`);
                const entryId = Number(inserted[0]?.id ?? 0);

                if (entryId) {
                  api.run(
                    `INSERT INTO journal_line (
                       journal_entry_id,
                       account_id,
                       debit,
                       credit,
                       reference_type,
                       reference_id,
                       invoice_id,
                       memo
                     ) VALUES (?, ?, ?, ?, 'sales_order', ?, ?, ?)`,
                    [
                      entryId,
                      cashAccountId,
                      invoiceAmount,
                      0,
                      orderId,
                      invoiceId,
                      `Cash received for ${orderCode}`,
                    ]
                  );

                  api.run(
                    `INSERT INTO journal_line (
                       journal_entry_id,
                       account_id,
                       debit,
                       credit,
                       reference_type,
                       reference_id,
                       invoice_id,
                       memo
                     ) VALUES (?, ?, ?, ?, 'sales_order', ?, ?, ?)`,
                    [
                      entryId,
                      revenueAccountId,
                      0,
                      invoiceAmount,
                      orderId,
                      invoiceId,
                      `Recognize merchandise revenue for ${orderCode}`,
                    ]
                  );

                  if (orderCost > 0 && cogsAccountId && inventoryAccountId) {
                    api.run(
                      `INSERT INTO journal_line (
                         journal_entry_id,
                         account_id,
                         debit,
                         credit,
                         reference_type,
                         reference_id,
                         invoice_id,
                         memo
                       ) VALUES (?, ?, ?, ?, 'sales_order', ?, ?, ?)`,
                      [
                        entryId,
                        cogsAccountId,
                        orderCost,
                        0,
                        orderId,
                        invoiceId,
                        `Record COGS for ${orderCode}`,
                      ]
                    );

                    api.run(
                      `INSERT INTO journal_line (
                         journal_entry_id,
                         account_id,
                         debit,
                         credit,
                         reference_type,
                         reference_id,
                         invoice_id,
                         memo
                       ) VALUES (?, ?, ?, ?, 'sales_order', ?, ?, ?)`,
                      [
                        entryId,
                        inventoryAccountId,
                        0,
                        orderCost,
                        orderId,
                        invoiceId,
                        `Reduce inventory for ${orderCode}`,
                      ]
                    );
                  }
                }
              }
            }
          }

          await persistDatabase();
        }
      : undefined,
    updateSalesOrderStatus: isInitialized
      ? async (orderId: number, status: string) => {
          const existing = api.query(
            `SELECT status FROM merch_sales_order WHERE id = ?`,
            [orderId]
          );
          if (!existing.length) return;
          const previousStatus = String(existing[0].status);
          if (previousStatus === status) {
            return;
          }

          api.run(`UPDATE merch_sales_order SET status = ? WHERE id = ?`, [status, orderId]);

          recalculateInventoryAllocations(api);

          await persistDatabase();
        }
      : undefined,
    resolveBackorders: isInitialized
      ? async () => {
          const backorderRows = api.query(
            `SELECT id, order_code FROM merch_sales_order
             WHERE status = 'Backorder'
             ORDER BY order_date ASC, id ASC`
          );

          const availableRows = api.query(
            `SELECT id, current_stock, allocated_stock, packaging_stock FROM merch_item`
          );

          const availableByItem = new Map<number, number>();
          availableRows.forEach(row => {
            const itemId = Number(row.id);
            const current = Number(row.current_stock ?? 0);
            const allocated = Number(row.allocated_stock ?? 0);
            const packaging = Number(row.packaging_stock ?? 0);
            availableByItem.set(itemId, Math.max(current - allocated - packaging, 0));
          });

          const resolvedOrders: Array<{ id: number; code: string }> = [];
          const unresolvedOrders: Array<{ id: number; code: string }> = [];

          backorderRows.forEach(row => {
            const orderId = Number(row.id);
            const orderCode = String(row.order_code ?? `SO-${orderId}`);
            const lines = api.query(
              `SELECT item_id, quantity FROM merch_sales_order_line WHERE order_id = ?`,
              [orderId]
            );

            const canFulfill = lines.every(line => {
              const itemId = Number(line.item_id);
              const quantity = Number(line.quantity ?? 0);
              const available = availableByItem.get(itemId) ?? 0;
              return available >= quantity;
            });

            if (!canFulfill) {
              unresolvedOrders.push({ id: orderId, code: orderCode });
              return;
            }

            resolvedOrders.push({ id: orderId, code: orderCode });
            api.run(
              `UPDATE merch_sales_order SET status = ? WHERE id = ?`,
              [INVENTORY_RESERVED_STATUS, orderId]
            );

            lines.forEach(line => {
              const itemId = Number(line.item_id);
              const quantity = Number(line.quantity ?? 0);
              const available = availableByItem.get(itemId) ?? 0;
              availableByItem.set(itemId, Math.max(available - quantity, 0));
            });
          });

          if (resolvedOrders.length) {
            recalculateInventoryAllocations(api);
            await persistDatabase();
          }

          return {
            totalBackorders: backorderRows.length,
            resolvedOrderCodes: resolvedOrders.map(order => order.code),
            unresolvedOrderCodes: unresolvedOrders.map(order => order.code),
          } as const;
        }
      : undefined,
    updateSalesOrderWorkflow: isInitialized
      ? async (
          orderId: number,
          workflowStage: string,
          options?: { carrier?: string | null; trackingNumber?: string | null }
        ) => {
          const existingOrder = api.query(
            `SELECT workflow_stage, status, store_id FROM merch_sales_order WHERE id = ?`,
            [orderId]
          );
          if (!existingOrder.length) return;

          const carrierOption =
            typeof options?.carrier === "string" ? options.carrier.trim() : "";
          const trackingOptionRaw =
            typeof options?.trackingNumber === "string"
              ? options.trackingNumber.trim()
              : options?.trackingNumber ?? "";
          const shouldUpdateCarrier = Object.prototype.hasOwnProperty.call(
            options ?? {},
            "carrier"
          );
          const shouldUpdateTracking = Object.prototype.hasOwnProperty.call(
            options ?? {},
            "trackingNumber"
          );

          const previousStage = String(existingOrder[0].workflow_stage);
          const previousStatus = String(existingOrder[0].status);
          let nextStatus = previousStatus;

          if (
            workflowStage !== AWAITING_WAREHOUSE_APPROVAL_STAGE &&
            previousStatus === "Backorder"
          ) {
            nextStatus = INVENTORY_RESERVED_STATUS;
          }

          if (workflowStage === "Delivered" && previousStatus !== "Cancelled") {
            nextStatus = INVENTORY_RESERVED_STATUS;
          }

          api.run(
            `UPDATE merch_sales_order SET workflow_stage = ?, status = ? WHERE id = ?`,
            [workflowStage, nextStatus, orderId]
          );

          if (previousStage !== "Shipped" && workflowStage === "Shipped") {
            const lines = api.query(
              `SELECT item_id, quantity FROM merch_sales_order_line WHERE order_id = ?`,
              [orderId]
            );
            lines.forEach(line => {
              const itemId = Number(line.item_id);
              const quantity = Number(line.quantity);
              api.run(
                `UPDATE merch_item
                 SET current_stock = MAX(current_stock - ?, 0)
                 WHERE id = ?`,
                [quantity, itemId]
              );
            });

            const existingShipment = api.query(
              `SELECT id, carrier, tracking_number FROM merch_shipment WHERE order_id = ?`,
              [orderId]
            );

            if (!existingShipment.length) {
              const shipmentCode = generateDocumentCode("SHIP");
              api.run(
                `INSERT INTO merch_shipment (
                  shipment_code,
                  order_id,
                  store_id,
                  carrier,
                  tracking_number,
                  status,
                  expected_delivery,
                  actual_delivery
                ) VALUES (?, ?, ?, ?, ?, ?, ?, NULL)`,
                [
                  shipmentCode,
                  orderId,
                  Number(existingOrder[0].store_id),
                  carrierOption.length ? carrierOption : "Pending Carrier",
                  typeof trackingOptionRaw === "string" ? trackingOptionRaw : "",
                  "Received from Inventory",
                  null,
                ]
              );
            } else {
              const shipmentId = Number(existingShipment[0].id);
              const updateFields: string[] = [];
              const updateValues: Array<string | number> = [];

              if (shouldUpdateCarrier) {
                updateFields.push("carrier = ?");
                updateValues.push(
                  carrierOption.length ? carrierOption : "Pending Carrier"
                );
              }

              if (shouldUpdateTracking) {
                const trackingValue =
                  typeof trackingOptionRaw === "string" ? trackingOptionRaw : "";
                updateFields.push("tracking_number = ?");
                updateValues.push(trackingValue);
              }

              if (updateFields.length) {
                updateValues.push(shipmentId);
                api.run(
                  `UPDATE merch_shipment SET ${updateFields.join(", ")} WHERE id = ?`,
                  updateValues
                );
              }
            }
          }

          if (previousStage === "Shipped" && workflowStage !== "Shipped") {
            const lines = api.query(
              `SELECT item_id, quantity FROM merch_sales_order_line WHERE order_id = ?`,
              [orderId]
            );
            lines.forEach(line => {
              const itemId = Number(line.item_id);
              const quantity = Number(line.quantity);
              api.run(
                `UPDATE merch_item
                 SET current_stock = current_stock + ?
                 WHERE id = ?`,
                [quantity, itemId]
              );
            });
          }

          if (workflowStage === "Delivered") {
            api.run(
              `UPDATE merch_shipment
               SET status = 'Delivered',
                   actual_delivery = COALESCE(actual_delivery, ?)
               WHERE order_id = ?`,
              [formatWeekLabel(getCurrentWeek()), orderId]
            );
          }

          recalculateInventoryAllocations(api);

          await persistDatabase();
        }
      : undefined,
    updateProcurementStatus: isInitialized
      ? async (procurementId: number, status: string) => {
          if (status !== "Open" && status !== "Closed") {
            return;
          }

          const existing = api.query(
            `SELECT status, item_id, qty_ordered FROM merch_procurement_po WHERE id = ?`,
            [procurementId]
          );
          if (!existing.length) return;

          const previousStatus = String(existing[0].status ?? "Open");
          if (previousStatus === status) {
            return;
          }

          api.run(`UPDATE merch_procurement_po SET status = ? WHERE id = ?`, [status, procurementId]);

          const itemId = Number(existing[0].item_id);
          const qty = Number(existing[0].qty_ordered);

          if (status === "Closed" && previousStatus !== "Closed") {
            api.run(
              `UPDATE merch_item
               SET incoming_stock = MAX(incoming_stock - ?, 0),
                   current_stock = current_stock + ?
               WHERE id = ?`,
              [qty, qty, itemId]
            );
          } else if (status === "Open" && previousStatus === "Closed") {
            api.run(
              `UPDATE merch_item
               SET incoming_stock = incoming_stock + ?,
                   current_stock = MAX(current_stock - ?, 0)
               WHERE id = ?`,
              [qty, qty, itemId]
            );
          }

          await persistDatabase();
        }
      : undefined,
    updateItemMinimumLevel: isInitialized
      ? async (itemId: number, minimumLevel: number) => {
          const item = api.query(
            `SELECT reorder_level FROM merch_item WHERE id = ?`,
            [itemId]
          );
          if (!item.length) {
            return;
          }

          const reorderLevel = Number(item[0].reorder_level ?? 0);
          const lowerBound = Math.min(Math.max(reorderLevel + 5, 0), 300);
          const normalized = Math.floor(Math.min(300, Math.max(lowerBound, minimumLevel)));

          api.run(
            `UPDATE merch_item
             SET min_inventory_level = ?
             WHERE id = ?`,
            [normalized, itemId]
          );

          await persistDatabase();
        }
      : undefined,
    createProcurementRequests: isInitialized
      ? async (
          requests: Array<{
            itemId: number;
            quantity: number;
            minimumGap: number;
            backorderUnits: number;
          }>
        ) => {
          if (!requests.length) {
            return;
          }

          const currentWeekLabel = formatWeekLabel(getCurrentWeek());

          requests.forEach(request => {
            const quantity = Math.max(0, Math.floor(request.quantity));
            if (quantity <= 0) {
              return;
            }

            const minimumGap = Math.max(0, Math.floor(request.minimumGap ?? 0));
            const backorderUnits = Math.max(0, Math.floor(request.backorderUnits ?? 0));
            const note = buildProcurementRequestNote(quantity, minimumGap, backorderUnits);

            api.run(
              `INSERT INTO merch_procurement_request (
                item_id,
                quantity_requested,
                minimum_gap,
                backorder_units,
                requested_at,
                note
              ) VALUES (?, ?, ?, ?, ?, ?)`,
              [request.itemId, quantity, minimumGap, backorderUnits, currentWeekLabel, note]
            );
          });

          await persistDatabase();
        }
      : undefined,
    approveProcurementRequest: isInitialized
      ? async (requestId: number) => {
          const requestRows = api.query(
            `SELECT item_id, quantity_requested FROM merch_procurement_request WHERE id = ?`,
            [requestId]
          );
          if (!requestRows.length) {
            return;
          }

          const itemId = Number(requestRows[0].item_id);
          const quantity = Math.max(0, Number(requestRows[0].quantity_requested ?? 0));
          if (quantity <= 0) {
            api.run(`DELETE FROM merch_procurement_request WHERE id = ?`, [requestId]);
            await persistDatabase();
            return;
          }

          const itemRows = api.query(`SELECT cost_price FROM merch_item WHERE id = ?`, [itemId]);
          if (!itemRows.length) {
            api.run(`DELETE FROM merch_procurement_request WHERE id = ?`, [requestId]);
            await persistDatabase();
            return;
          }

          const unitCost = Number(itemRows[0].cost_price ?? 0);
          const orderWeek = formatWeekLabel(getCurrentWeek());
          const leadTimeWeeks = 1;
          const expectedReceipt = addWeeks(orderWeek, leadTimeWeeks);
          const poCode = generateDocumentCode("PO");

          api.run(
            `INSERT INTO merch_procurement_po (
              po_code,
              item_id,
              qty_ordered,
              unit_cost,
              lead_time_days,
              status,
              order_date,
              expected_receipt
            ) VALUES (?, ?, ?, ?, ?, 'Open', ?, ?)`,
            [poCode, itemId, quantity, unitCost, leadTimeWeeks, orderWeek, expectedReceipt]
          );

          api.run(
            `UPDATE merch_item
             SET incoming_stock = incoming_stock + ?
             WHERE id = ?`,
            [quantity, itemId]
          );

          api.run(`DELETE FROM merch_procurement_request WHERE id = ?`, [requestId]);

          await persistDatabase();
        }
      : undefined,
    denyProcurementRequest: isInitialized
      ? async (requestId: number) => {
          api.run(`DELETE FROM merch_procurement_request WHERE id = ?`, [requestId]);
          await persistDatabase();
        }
      : undefined,
    updateShipmentStatus: isInitialized
      ? async (shipmentId: number, status: string, actualDelivery?: string | null) => {
          const existing = api.query(
            `SELECT status, order_id FROM merch_shipment WHERE id = ?`,
            [shipmentId]
          );
          if (!existing.length) return;

          const previousStatus = String(existing[0].status);
          if (previousStatus === status) {
            return;
          }

          const normalizedDelivery = actualDelivery ? ensureWeekLabel(actualDelivery) : null;

          api.run(
            `UPDATE merch_shipment
             SET status = ?,
                 actual_delivery = CASE WHEN ? IS NOT NULL THEN ? ELSE actual_delivery END
             WHERE id = ?`,
            [status, normalizedDelivery, normalizedDelivery, shipmentId]
          );

          if (status === "Delivered" && previousStatus !== "Delivered") {
            const orderId = Number(existing[0].order_id);
            api.run(
              `UPDATE merch_sales_order
               SET workflow_stage = 'Delivered',
                   status = CASE
                     WHEN status = 'Cancelled' THEN status
                     ELSE '${INVENTORY_RESERVED_STATUS}'
                   END
               WHERE id = ?`,
              [orderId]
            );

            const invoices = api.query(
              `SELECT id, status, due_date FROM merch_invoice WHERE order_id = ?`,
              [orderId]
            );
            const currentWeek = getCurrentWeek();
            invoices.forEach(invoice => {
              const existingStatus = String(invoice.status ?? "");
              if (existingStatus === "Paid") {
                return;
              }
              const dueWeek = parseWeekLabel(String(invoice.due_date ?? ""));
              const nextStatus = dueWeek < currentWeek ? "Overdue" : existingStatus;
              if (nextStatus !== existingStatus) {
                api.run(`UPDATE merch_invoice SET status = ? WHERE id = ?`, [nextStatus, Number(invoice.id)]);
              }
            });

            api.run(
              `UPDATE merch_shipment
               SET status = 'Delivered',
                   actual_delivery = COALESCE(actual_delivery, ?)
               WHERE order_id = ?`,
              [formatWeekLabel(currentWeek), orderId]
            );
          }

          recalculateInventoryAllocations(api);

          await persistDatabase();
        }
      : undefined,
  }), [api, isInitialized, persistDatabase]);
}

function recalculateInventoryAllocations(api: DBApi) {
  const reservedRows = api.query(
    `SELECT sol.item_id as item_id, SUM(sol.quantity) as qty
     FROM merch_sales_order_line sol
     JOIN merch_sales_order so ON so.id = sol.order_id
     WHERE so.status = ? AND so.workflow_stage = ?
     GROUP BY sol.item_id`,
    [INVENTORY_RESERVED_STATUS, AWAITING_WAREHOUSE_APPROVAL_STAGE]
  );

  const packagingRows = api.query(
    `SELECT sol.item_id as item_id, SUM(sol.quantity) as qty
     FROM merch_sales_order_line sol
     JOIN merch_sales_order so ON so.id = sol.order_id
     WHERE so.workflow_stage = ? AND so.status != 'Cancelled'
     GROUP BY sol.item_id`,
    [PACKAGING_STAGE]
  );

  const reservedMap = new Map<number, number>();
  reservedRows.forEach(row => {
    const itemId = Number(row.item_id);
    const quantity = Number(row.qty ?? 0);
    reservedMap.set(itemId, quantity);
  });

  const packagingMap = new Map<number, number>();
  packagingRows.forEach(row => {
    const itemId = Number(row.item_id);
    const quantity = Number(row.qty ?? 0);
    packagingMap.set(itemId, quantity);
  });

  const items = api.query(`SELECT id FROM merch_item`);
  items.forEach(item => {
    const itemId = Number(item.id);
    const reserved = reservedMap.get(itemId) ?? 0;
    const packaging = packagingMap.get(itemId) ?? 0;
    api.run(
      `UPDATE merch_item
       SET allocated_stock = ?,
           packaging_stock = ?
       WHERE id = ?`,
      [reserved, packaging, itemId]
    );
  });
}

function maybeTriggerReorder(api: DBApi, itemId: number, orderWeek: string) {
  const itemRows = api.query(
    `SELECT id, cost_price, reorder_level, min_inventory_level, current_stock, allocated_stock, packaging_stock, incoming_stock
     FROM merch_item WHERE id = ?`,
    [itemId]
  );
  if (!itemRows.length) return;

  const item = itemRows[0];
  const reorderLevel = Number(item.reorder_level ?? 0);
  const minimumLevel = Number(item.min_inventory_level ?? reorderLevel);
  const currentStock = Number(item.current_stock ?? 0);
  const allocatedStock = Number(item.allocated_stock ?? 0);
  const packagingStock = Number(item.packaging_stock ?? 0);
  const incomingStock = Number(item.incoming_stock ?? 0);
  const availableAfterAllocation = currentStock - allocatedStock - packagingStock;
  const projectedAvailability = availableAfterAllocation + incomingStock;
  const triggerLevel = Math.max(reorderLevel, minimumLevel);

  if (projectedAvailability > triggerLevel) {
    return;
  }

  const openPurchaseOrders = api.query(
    `SELECT id FROM merch_procurement_po
     WHERE item_id = ? AND status = 'Open'
     LIMIT 1`,
    [itemId]
  );

  if (openPurchaseOrders.length) {
    return;
  }

  const outstandingDemand = Math.max(allocatedStock + packagingStock, 0);
  const shortfall = Math.max(triggerLevel - projectedAvailability, 0);
  const quantityToOrder = Math.max(triggerLevel * 2, outstandingDemand, shortfall + triggerLevel, 25);
  const poCode = generateDocumentCode("PO");
  const leadTimeWeeks = 1;
  const expectedReceipt = addWeeks(orderWeek, leadTimeWeeks);

  api.run(
    `INSERT INTO merch_procurement_po (
      po_code,
      item_id,
      qty_ordered,
      unit_cost,
      lead_time_days,
      status,
      order_date,
      expected_receipt
    ) VALUES (?, ?, ?, ?, ?, 'Open', ?, ?)`,
    [
      poCode,
      itemId,
      quantityToOrder,
      Number(item.cost_price ?? 0),
      leadTimeWeeks,
      ensureWeekLabel(orderWeek),
      expectedReceipt,
    ]
  );

  api.run(
    `UPDATE merch_item
     SET incoming_stock = incoming_stock + ?
     WHERE id = ?`,
    [quantityToOrder, itemId]
  );
}

export function useTicketing() {
  const { api, isInitialized } = useDatabase();

  return useMemo(() => ({
    isInitialized,
    getGames: isInitialized ? () => api.query(`SELECT * FROM game ORDER BY ${weekOrderingSql("date")}`) : undefined,
    getTicketOrders: isInitialized ? () => api.query(`
      SELECT to_table.*, c.name as customer_name, g.opponent, g.date as game_date
      FROM ticket_order to_table
      JOIN customer c ON to_table.customer_id = c.id
      JOIN game g ON to_table.game_id = g.id
      ORDER BY to_table.created_at DESC
    `) : undefined,
  }), [api, isInitialized]);
}

export function useRoster() {
  const { api, isInitialized } = useDatabase();

  return useMemo(() => ({
    isInitialized,
    getPlayers: isInitialized ? () => api.query(`
      SELECT p.*, c.aav, c.start_year, c.end_year, c.status as contract_status
      FROM player p
      LEFT JOIN contract c ON p.id = c.player_id AND c.status = 'Active'
      ORDER BY p.name
    `) : undefined,
    getFreeAgents: isInitialized ? () => api.query('SELECT * FROM free_agent ORDER BY expected_aav DESC') : undefined,
    getCapLedger: isInitialized ? (season?: number) => {
      const currentSeason = season || 2025;
      return api.query(`
        SELECT cl.*, p.name as player_name, p.position
        FROM cap_ledger cl
        JOIN player p ON cl.player_id = p.id
        WHERE cl.season = ?
        ORDER BY cl.amount DESC
      `, [currentSeason]);
    } : undefined,
  }), [api, isInitialized]);
}

