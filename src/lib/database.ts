"use client";


import initSqlJs from 'sql.js';
import type { Database as SqlJsDatabase, SqlJsStatic } from 'sql.js';

const LATEST_DB_VERSION = 13;

function ensureMetadataTable(db: SqlJsDatabase) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS metadata (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
}

function getDatabaseVersion(db: SqlJsDatabase): number {
  ensureMetadataTable(db);
  const result = db.exec("SELECT value FROM metadata WHERE key = 'version'");
  if (result.length === 0 || result[0].values.length === 0) {
    return 0;
  }

  const raw = result[0].values[0][0];
  if (typeof raw === 'number') return raw;
  if (typeof raw === 'string') {
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function setDatabaseVersion(db: SqlJsDatabase, version: number) {
  ensureMetadataTable(db);
  db.exec(`
    INSERT INTO metadata (key, value)
    VALUES ('version', '${version}')
    ON CONFLICT(key) DO UPDATE SET value = excluded.value;
  `);
}

function ensureAccountingTables(db: SqlJsDatabase) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS gl_account (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL CHECK (type IN ('Asset', 'Liability', 'Equity', 'Revenue', 'Expense')),
      normal_balance TEXT NOT NULL CHECK (normal_balance IN ('Debit', 'Credit')),
      parent_id INTEGER,
      FOREIGN KEY (parent_id) REFERENCES gl_account(id)
    );

    CREATE TABLE IF NOT EXISTS vendor (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT
    );

    CREATE TABLE IF NOT EXISTS invoice (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_number TEXT UNIQUE NOT NULL,
      entity_type TEXT NOT NULL CHECK (entity_type IN ('Customer', 'Vendor')),
      entity_id INTEGER NOT NULL,
      invoice_date DATE NOT NULL,
      due_date DATE NOT NULL,
      total_amount DECIMAL(12,2) NOT NULL,
      status TEXT NOT NULL,
      description TEXT
    );

    CREATE TABLE IF NOT EXISTS journal_entry (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entry_number TEXT UNIQUE NOT NULL,
      entry_date DATE NOT NULL,
      description TEXT,
      posted INTEGER NOT NULL DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS journal_line (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      journal_entry_id INTEGER NOT NULL,
      account_id INTEGER NOT NULL,
      debit DECIMAL(12,2) NOT NULL DEFAULT 0,
      credit DECIMAL(12,2) NOT NULL DEFAULT 0,
      reference_type TEXT,
      reference_id INTEGER,
      invoice_id INTEGER,
      memo TEXT,
      FOREIGN KEY (journal_entry_id) REFERENCES journal_entry(id),
      FOREIGN KEY (account_id) REFERENCES gl_account(id),
      FOREIGN KEY (invoice_id) REFERENCES invoice(id)
    );

    CREATE TABLE IF NOT EXISTS payment (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_id INTEGER NOT NULL,
      payment_date DATE NOT NULL,
      amount DECIMAL(12,2) NOT NULL,
      method TEXT,
      direction TEXT NOT NULL CHECK (direction IN ('Inflow', 'Outflow')),
      reference TEXT,
      FOREIGN KEY (invoice_id) REFERENCES invoice(id)
    );
  `);
}

function ensureMerchandiseTables(db: SqlJsDatabase) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS retail_store (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      tier TEXT NOT NULL,
      contact_name TEXT,
      contact_email TEXT
    );

    CREATE TABLE IF NOT EXISTS merch_item (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sku TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      cost_price DECIMAL(10,2) NOT NULL,
      sell_price DECIMAL(10,2) NOT NULL,
      current_stock INTEGER NOT NULL DEFAULT 0,
      reorder_level INTEGER NOT NULL DEFAULT 0,
      min_inventory_level INTEGER NOT NULL DEFAULT 0,
      allocated_stock INTEGER NOT NULL DEFAULT 0,
      packaging_stock INTEGER NOT NULL DEFAULT 0,
      incoming_stock INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS merch_sales_order (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_code TEXT UNIQUE NOT NULL,
      store_id INTEGER NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('Successful - Inventory Reserved', 'Backorder', 'Cancelled')),
      workflow_stage TEXT NOT NULL CHECK (workflow_stage IN ('Awaiting Warehouse Approval', 'Packaging', 'Shipped', 'Delivered')),
      order_date DATE NOT NULL,
      total_amount DECIMAL(10,2) NOT NULL,
      notes TEXT,
      FOREIGN KEY (store_id) REFERENCES retail_store(id)
    );

    CREATE TABLE IF NOT EXISTS merch_sales_order_line (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      item_id INTEGER NOT NULL,
      quantity INTEGER NOT NULL CHECK (quantity >= 5),
      unit_price DECIMAL(10,2) NOT NULL,
      FOREIGN KEY (order_id) REFERENCES merch_sales_order(id),
      FOREIGN KEY (item_id) REFERENCES merch_item(id)
    );

    CREATE TABLE IF NOT EXISTS merch_procurement_po (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      po_code TEXT UNIQUE NOT NULL,
      item_id INTEGER NOT NULL,
      qty_ordered INTEGER NOT NULL,
      unit_cost DECIMAL(10,2) NOT NULL,
      lead_time_days INTEGER NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('Open', 'Closed')),
      order_date DATE NOT NULL,
      expected_receipt DATE,
      FOREIGN KEY (item_id) REFERENCES merch_item(id)
    );

    CREATE TABLE IF NOT EXISTS merch_procurement_request (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_id INTEGER NOT NULL,
      quantity_requested INTEGER NOT NULL,
      minimum_gap INTEGER NOT NULL DEFAULT 0,
      backorder_units INTEGER NOT NULL DEFAULT 0,
      requested_at DATE NOT NULL,
      note TEXT,
      FOREIGN KEY (item_id) REFERENCES merch_item(id)
    );

    CREATE TABLE IF NOT EXISTS merch_shipment (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      shipment_code TEXT UNIQUE NOT NULL,
      order_id INTEGER NOT NULL,
      store_id INTEGER NOT NULL,
      carrier TEXT NOT NULL,
      tracking_number TEXT,
      status TEXT NOT NULL CHECK (status IN ('Received from Inventory', 'Out for Delivery', 'Delivered')),
      expected_delivery DATE,
      actual_delivery DATE,
      FOREIGN KEY (order_id) REFERENCES merch_sales_order(id),
      FOREIGN KEY (store_id) REFERENCES retail_store(id)
    );

    CREATE TABLE IF NOT EXISTS merch_invoice (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_code TEXT UNIQUE NOT NULL,
      order_id INTEGER NOT NULL,
      store_id INTEGER NOT NULL,
      amount DECIMAL(10,2) NOT NULL,
      issued_date DATE NOT NULL,
      due_date DATE NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('Unpaid', 'Paid', 'Overdue')),
      FOREIGN KEY (order_id) REFERENCES merch_sales_order(id),
      FOREIGN KEY (store_id) REFERENCES retail_store(id)
    );
  `);
}

function seedAccountingDefaults(db: SqlJsDatabase): boolean {
  ensureAccountingTables(db);

  const requiredAccounts = [
    ['1000', "Operating Cash", 'Asset', 'Debit'],
    ['1100', "Accounts Receivable", 'Asset', 'Debit'],
    ['1200', "Merchandise Inventory", 'Asset', 'Debit'],
    ['2000', "Accounts Payable", 'Liability', 'Credit'],
    ['3000', "Owner's Equity", 'Equity', 'Credit'],
    ['4000', "Ticket Sales Revenue", 'Revenue', 'Credit'],
    ['4010', "Merchandise Revenue", 'Revenue', 'Credit'],
    ['5000', "Merchandise COGS", 'Expense', 'Debit'],
    ['5200', "Arena Operations Expense", 'Expense', 'Debit'],
  ] as const;

  const existingAccounts = db.exec(`
    SELECT code
    FROM gl_account
    WHERE code IN (${requiredAccounts.map(([code]) => `'${code}'`).join(', ')})
  `);
  const existingCodes = new Set(
    existingAccounts.flatMap(result => result.values.map(row => String(row[0])))
  );

  const missingAccounts = requiredAccounts.filter(([code]) => !existingCodes.has(code));
  if (!missingAccounts.length) {
    return false;
  }

  db.exec(`
    INSERT INTO gl_account (code, name, type, normal_balance)
    VALUES
      ${requiredAccounts
        .map(
          ([code, name, type, balance]) =>
            `('${code}', '${name.replace(/'/g, "''")}', '${type}', '${balance}')`
        )
        .join(', ')}
    ON CONFLICT(code) DO UPDATE SET
      name = excluded.name,
      type = excluded.type,
      normal_balance = excluded.normal_balance;
  `);

  return true;
}

function migrateMerchSalesOrderToV5(db: SqlJsDatabase) {
  const tableInfo = db.exec(`PRAGMA table_info(merch_sales_order)`);
  if (!tableInfo.length) {
    return;
  }

  const hasExpectedShipDate = tableInfo[0]?.values?.some(row => row?.[1] === 'expected_ship_date') ?? false;

  if (hasExpectedShipDate) {
    db.exec(`DROP TABLE IF EXISTS merch_sales_order_new;`);
    db.exec(`
      CREATE TABLE merch_sales_order_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_code TEXT UNIQUE NOT NULL,
        store_id INTEGER NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('Successful - Inventory Reserved', 'Backorder', 'Cancelled')),
        workflow_stage TEXT NOT NULL CHECK (workflow_stage IN ('Awaiting Warehouse Approval', 'Packaging', 'Shipped', 'Delivered')),
        order_date DATE NOT NULL,
        total_amount DECIMAL(10,2) NOT NULL,
        notes TEXT,
        FOREIGN KEY (store_id) REFERENCES retail_store(id)
      );
    `);

    db.exec(`
      INSERT INTO merch_sales_order_new (id, order_code, store_id, status, workflow_stage, order_date, total_amount, notes)
      SELECT
        id,
        order_code,
        store_id,
        CASE status
          WHEN 'Confirmed' THEN 'Successful - Inventory Reserved'
          WHEN 'Draft' THEN 'Backorder'
          WHEN 'Backorder' THEN 'Backorder'
          WHEN 'Cancelled' THEN 'Cancelled'
          ELSE 'Successful - Inventory Reserved'
        END,
        workflow_stage,
        order_date,
        total_amount,
        notes
      FROM merch_sales_order;
    `);

    db.exec(`DROP TABLE merch_sales_order;`);
    db.exec(`ALTER TABLE merch_sales_order_new RENAME TO merch_sales_order;`);
  } else {
    db.exec(`
      UPDATE merch_sales_order
      SET status = CASE status
        WHEN 'Confirmed' THEN 'Successful - Inventory Reserved'
        WHEN 'Draft' THEN 'Backorder'
        WHEN 'Backorder' THEN 'Backorder'
        WHEN 'Cancelled' THEN 'Cancelled'
        ELSE 'Successful - Inventory Reserved'
      END;
    `);
  }

  db.exec(`
    UPDATE sqlite_sequence
    SET seq = (SELECT COALESCE(MAX(id), 0) FROM merch_sales_order)
    WHERE name = 'merch_sales_order';
  `);
}

function migrateMerchSalesOrderToV6(db: SqlJsDatabase) {
  const tableExists = db.exec(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='merch_sales_order'"
  );
  if (!tableExists.length) {
    return;
  }

  db.exec(`DROP TABLE IF EXISTS merch_sales_order_v6;`);
  db.exec(`
    CREATE TABLE merch_sales_order_v6 (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_code TEXT UNIQUE NOT NULL,
      store_id INTEGER NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('Successful - Inventory Reserved', 'Backorder', 'Cancelled')),
      workflow_stage TEXT NOT NULL CHECK (workflow_stage IN ('Awaiting Warehouse Approval', 'Packaging', 'Shipped', 'Delivered')),
      order_date DATE NOT NULL,
      total_amount DECIMAL(10,2) NOT NULL,
      notes TEXT,
      FOREIGN KEY (store_id) REFERENCES retail_store(id)
    );
  `);

  db.exec(`
    INSERT INTO merch_sales_order_v6 (id, order_code, store_id, status, workflow_stage, order_date, total_amount, notes)
    SELECT
      id,
      order_code,
      store_id,
      CASE status
        WHEN 'Successful' THEN 'Successful - Inventory Reserved'
        WHEN 'Successful - Inventory Reserved' THEN 'Successful - Inventory Reserved'
        ELSE status
      END,
      CASE workflow_stage
        WHEN 'Awaiting Approval' THEN 'Awaiting Warehouse Approval'
        WHEN 'Awaiting Warehouse Approval' THEN 'Awaiting Warehouse Approval'
        ELSE workflow_stage
      END,
      order_date,
      total_amount,
      notes
    FROM merch_sales_order;
  `);

  db.exec(`DROP TABLE merch_sales_order;`);
  db.exec(`ALTER TABLE merch_sales_order_v6 RENAME TO merch_sales_order;`);

  db.exec(`
    UPDATE sqlite_sequence
    SET seq = (SELECT COALESCE(MAX(id), 0) FROM merch_sales_order)
    WHERE name = 'merch_sales_order';
  `);
}

function migrateMerchItemToV7(db: SqlJsDatabase) {
  const tableInfo = db.exec(`PRAGMA table_info(merch_item)`);
  const hasPackagingColumn =
    tableInfo.length > 0
      ? tableInfo[0].values.some(row => row?.[1] === "packaging_stock")
      : false;

  if (hasPackagingColumn) {
    return;
  }

  db.exec(`DROP TABLE IF EXISTS merch_item_v7;`);
  db.exec(`
    CREATE TABLE merch_item_v7 (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sku TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      cost_price DECIMAL(10,2) NOT NULL,
      sell_price DECIMAL(10,2) NOT NULL,
      current_stock INTEGER NOT NULL DEFAULT 0,
      reorder_level INTEGER NOT NULL DEFAULT 0,
      min_inventory_level INTEGER NOT NULL DEFAULT 0,
      allocated_stock INTEGER NOT NULL DEFAULT 0,
      packaging_stock INTEGER NOT NULL DEFAULT 0,
      incoming_stock INTEGER NOT NULL DEFAULT 0
    );
  `);

  db.exec(`
    INSERT INTO merch_item_v7 (id, sku, name, cost_price, sell_price, current_stock, reorder_level, min_inventory_level, allocated_stock, packaging_stock, incoming_stock)
    SELECT id, sku, name, cost_price, sell_price, current_stock, reorder_level, reorder_level, allocated_stock, pending_orders, incoming_stock
    FROM merch_item;
  `);

  db.exec(`DROP TABLE merch_item;`);
  db.exec(`ALTER TABLE merch_item_v7 RENAME TO merch_item;`);

  db.exec(`
    UPDATE sqlite_sequence
    SET seq = (SELECT COALESCE(MAX(id), 0) FROM merch_item)
    WHERE name = 'merch_item';
  `);
}

function migrateMerchItemToV8(db: SqlJsDatabase) {
  const tableInfo = db.exec(`PRAGMA table_info(merch_item)`);
  const hasMinimumColumn =
    tableInfo.length > 0
      ? tableInfo[0].values.some(row => row?.[1] === "min_inventory_level")
      : false;

  if (hasMinimumColumn) {
    return;
  }

  db.exec(`ALTER TABLE merch_item ADD COLUMN min_inventory_level INTEGER NOT NULL DEFAULT 0;`);
  db.exec(`
    UPDATE merch_item
    SET min_inventory_level = MIN(300, MAX(reorder_level + 20, reorder_level + 5));
  `);
}

function migrateProcurementToV9(db: SqlJsDatabase) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS merch_procurement_request (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_id INTEGER NOT NULL,
      quantity_requested INTEGER NOT NULL,
      minimum_gap INTEGER NOT NULL DEFAULT 0,
      backorder_units INTEGER NOT NULL DEFAULT 0,
      requested_at DATE NOT NULL,
      note TEXT,
      FOREIGN KEY (item_id) REFERENCES merch_item(id)
    );
  `);

  const tableSql = db.exec(
    "SELECT sql FROM sqlite_master WHERE type='table' AND name='merch_procurement_po'"
  );
  const alreadyModern = tableSql?.[0]?.values?.[0]?.[0]?.includes("'Open'") ?? false;

  if (alreadyModern) {
    return;
  }

  db.exec(`DROP TABLE IF EXISTS merch_procurement_po_new;`);
  db.exec(`
    CREATE TABLE merch_procurement_po_new (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      po_code TEXT UNIQUE NOT NULL,
      item_id INTEGER NOT NULL,
      qty_ordered INTEGER NOT NULL,
      unit_cost DECIMAL(10,2) NOT NULL,
      lead_time_days INTEGER NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('Open', 'Closed')),
      order_date DATE NOT NULL,
      expected_receipt DATE,
      FOREIGN KEY (item_id) REFERENCES merch_item(id)
    );
  `);

  db.exec(`
    INSERT INTO merch_procurement_po_new (
      id,
      po_code,
      item_id,
      qty_ordered,
      unit_cost,
      lead_time_days,
      status,
      order_date,
      expected_receipt
    )
    SELECT
      id,
      po_code,
      item_id,
      qty_ordered,
      unit_cost,
      lead_time_days,
      CASE status
        WHEN 'Received' THEN 'Closed'
        WHEN 'Closed' THEN 'Closed'
        ELSE 'Open'
      END AS status,
      order_date,
      expected_receipt
    FROM merch_procurement_po;
  `);

  db.exec(`DROP TABLE merch_procurement_po;`);
  db.exec(`ALTER TABLE merch_procurement_po_new RENAME TO merch_procurement_po;`);

  db.exec(`
    UPDATE sqlite_sequence
    SET seq = (SELECT COALESCE(MAX(id), 0) FROM merch_procurement_po)
    WHERE name = 'merch_procurement_po';
  `);
}

function migrateTicketSalesToV10(db: SqlJsDatabase) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS game_ticket_sales (
      game_id INTEGER PRIMARY KEY,
      attendance_percentage REAL NOT NULL DEFAULT 0,
      locked_attendance_percentage REAL NOT NULL DEFAULT 0,
      last_updated DATE,
      FOREIGN KEY (game_id) REFERENCES game(id)
    );
  `);

  db.exec(`
    INSERT INTO game_ticket_sales (game_id, attendance_percentage, locked_attendance_percentage, last_updated)
    SELECT
      g.id,
      COALESCE(
        ROUND(
          CASE WHEN COUNT(ti.id) = 0 THEN 0
            ELSE (SUM(CASE WHEN ti.status IN ('Sold', 'Redeemed') THEN 1 ELSE 0 END) * 100.0) / COUNT(ti.id)
          END,
          1
        ),
        0
      ) AS attendance_percentage,
      0 AS locked_attendance_percentage,
      'Week 1'
    FROM game g
    LEFT JOIN ticket_inventory ti ON g.id = ti.game_id
    WHERE NOT EXISTS (
      SELECT 1 FROM game_ticket_sales existing WHERE existing.game_id = g.id
    )
    GROUP BY g.id;
  `);
}

function migrateTicketRevenueHistoryToV11(db: SqlJsDatabase) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS ticket_weekly_revenue (
      week_label TEXT PRIMARY KEY,
      revenue REAL NOT NULL DEFAULT 0,
      finalized_at TEXT
    );
  `);
}

function migrateTicketSalesLocksToV12(db: SqlJsDatabase) {
  const tableInfo = db.exec(`PRAGMA table_info(game_ticket_sales);`);
  const hasLockedColumn =
    tableInfo.length > 0 && tableInfo[0].values.some(row => row?.[1] === "locked_attendance_percentage");

  if (!hasLockedColumn) {
    db.exec(`ALTER TABLE game_ticket_sales ADD COLUMN locked_attendance_percentage REAL NOT NULL DEFAULT 0;`);
    db.exec(`
      UPDATE game_ticket_sales
      SET locked_attendance_percentage = attendance_percentage
      WHERE attendance_percentage > locked_attendance_percentage;
    `);
  }
}

function migrateTicketWeeklySalesSnapshotsToV13(db: SqlJsDatabase) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS game_ticket_weekly_sales (
      game_id INTEGER NOT NULL,
      week_label TEXT NOT NULL,
      attendance_percentage REAL NOT NULL DEFAULT 0,
      PRIMARY KEY (game_id, week_label),
      FOREIGN KEY (game_id) REFERENCES game(id)
    );
  `);

  db.exec(`
    INSERT INTO game_ticket_weekly_sales (game_id, week_label, attendance_percentage)
    SELECT
      gts.game_id,
      COALESCE(gts.last_updated, 'Week 1') AS week_label,
      gts.attendance_percentage
    FROM game_ticket_sales gts
    WHERE NOT EXISTS (
      SELECT 1
      FROM game_ticket_weekly_sales existing
      WHERE existing.game_id = gts.game_id
        AND existing.week_label = COALESCE(gts.last_updated, 'Week 1')
    );
  `);
}

function seedMerchandiseModule(db: SqlJsDatabase) {
  ensureMerchandiseTables(db);

  const storeCount = db.exec("SELECT COUNT(*) as count FROM retail_store");
  const existingStores = storeCount.length > 0 ? Number(storeCount[0].values[0][0]) : 0;
  if (existingStores > 0) {
    return;
  }

  db.exec(`
    INSERT INTO retail_store (name, tier, contact_name, contact_email) VALUES
      ('Caps Canada', 'Gold', 'Alicia Bennett', 'ordering@capscanada.ca'),
      ('BootLocker', 'Platinum', 'Jordan Patel', 'bulk@bootlocker.com'),
      ('Naikee', 'Silver', 'Diego Ramirez', 'retail@naikee.com');

    INSERT INTO merch_item (sku, name, cost_price, sell_price, current_stock, reorder_level, min_inventory_level, allocated_stock, packaging_stock, incoming_stock) VALUES
      ('JERSEY-HOME-23', 'Home Jersey #23', 42.50, 89.99, 180, 60, 100, 54, 36, 0),
      ('JERSEY-AWAY-14', 'Away Jersey #14', 42.50, 89.99, 140, 50, 85, 40, 28, 0),
      ('HOODIE-CLASSIC', 'Classic Team Hoodie', 28.00, 59.99, 90, 40, 70, 26, 18, 0),
      ('CAP-SNAPBACK', 'Snapback Cap', 9.00, 24.99, 210, 80, 125, 64, 32, 0),
      ('TEE-PRIMARY', 'Primary Logo Tee', 6.50, 19.99, 320, 120, 180, 48, 30, 0),
      ('BASKETBALL-SIG', 'Signature Basketball', 18.00, 39.99, 75, 30, 60, 20, 12, 0);
  `);
}

export function migrateDatabase(db: SqlJsDatabase): boolean {
  ensureMetadataTable(db);
  ensureMerchandiseTables(db);
  ensureAccountingTables(db);

  const currentVersion = getDatabaseVersion(db);
  if (currentVersion < 5) {
    migrateMerchSalesOrderToV5(db);
  }

  if (currentVersion < 6) {
    migrateMerchSalesOrderToV6(db);
  }

  if (currentVersion < 7) {
    migrateMerchItemToV7(db);
  }

  if (currentVersion < 8) {
    migrateMerchItemToV8(db);
  }

  if (currentVersion < 9) {
    migrateProcurementToV9(db);
  }

  if (currentVersion < 10) {
    migrateTicketSalesToV10(db);
  }

  if (currentVersion < 11) {
    migrateTicketRevenueHistoryToV11(db);
  }

  if (currentVersion < 12) {
    migrateTicketSalesLocksToV12(db);
  }

  if (currentVersion < 13) {
    migrateTicketWeeklySalesSnapshotsToV13(db);
  }

  // Only seed the merchandise module when migrating from older versions
  seedMerchandiseModule(db);
  const seededAccounts = seedAccountingDefaults(db);
  setDatabaseVersion(db, LATEST_DB_VERSION);
  return currentVersion < LATEST_DB_VERSION || seededAccounts;
}

/** Cache the sql.js module once loaded in the browser */
let SQLPromise: Promise<SqlJsStatic> | null = null;

export async function getSQL(): Promise<SqlJsStatic> {
  if (typeof window === "undefined") {
    throw new Error("SQL requested on server. Use getSQL() only in the browser.");
  }

  if (!SQLPromise) {
    SQLPromise = initSqlJs({
      locateFile: (file: string) => {
        if (file === "sql-wasm.wasm") {
          // Use the local WASM file from the public folder
          return "/sql-wasm.wasm";
        }
        return file;
      },
    });
  }

  return SQLPromise;
}

export async function openDatabase(existing?: Uint8Array): Promise<SqlJsDatabase> {
  const SQL = await getSQL();
  return existing ? new SQL.Database(existing) : new SQL.Database();
}

export async function exportDB(db: SqlJsDatabase): Promise<Uint8Array> {
  return db.export();
}

/** Simple localStorage persistence */
const STORAGE_KEY = "basketball_erp_db";

export async function loadFromStorage(): Promise<Uint8Array | null> {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;

    // base64 -> Uint8Array
    const binary = atob(stored);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  } catch (error) {
    console.warn("Failed to load database from storage:", error);
    return null;
  }
}

export async function saveToStorage(db: SqlJsDatabase): Promise<void> {
  try {
    const data: Uint8Array = db.export();

    // Convert Uint8Array to base64 more efficiently for large data
    let binary = '';
    const chunkSize = 8192; // Process in chunks to avoid stack overflow
    for (let i = 0; i < data.length; i += chunkSize) {
      const chunk = data.slice(i, i + chunkSize);
      binary += String.fromCharCode.apply(null, Array.from(chunk));
    }
    const base64 = btoa(binary);

    localStorage.setItem(STORAGE_KEY, base64);
  } catch (error) {
    console.warn("Failed to save database to storage:", error);
  }
}

export function seedDatabase(db: SqlJsDatabase): void {
  try {
    // Check if already seeded
    const result = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='customer'");
    if (result.length > 0) {
      const customerCount = db.exec("SELECT COUNT(*) as count FROM customer");
      if (customerCount.length > 0 && customerCount[0]?.values?.[0]?.[0]) {
        const count = customerCount[0].values[0][0];
        if (typeof count === 'number' && count > 0) {
          console.log("Database already seeded");
          return;
        }
      }
    }

    console.log("Seeding database...");

    // Schema
    db.exec(`
      CREATE TABLE IF NOT EXISTS metadata (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS customer (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL
      );

      CREATE TABLE IF NOT EXISTS item (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sku TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        price DECIMAL(10,2) NOT NULL,
        qty_on_hand INTEGER NOT NULL DEFAULT 0,
        reorder_point INTEGER NOT NULL DEFAULT 5
      );

      CREATE TABLE IF NOT EXISTS sales_order (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_id INTEGER NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('Draft', 'Approved', 'Fulfilled')),
        total DECIMAL(10,2) NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (customer_id) REFERENCES customer(id)
      );

      CREATE TABLE IF NOT EXISTS game (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        opponent TEXT NOT NULL,
        date DATE NOT NULL,
        venue TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS ticket_order (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_id INTEGER NOT NULL,
        game_id INTEGER NOT NULL,
        total DECIMAL(10,2) NOT NULL,
        status TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (customer_id) REFERENCES customer(id),
        FOREIGN KEY (game_id) REFERENCES game(id)
      );

      CREATE TABLE IF NOT EXISTS section (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS seat (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        section_id INTEGER NOT NULL,
        row TEXT NOT NULL,
        number INTEGER NOT NULL,
        FOREIGN KEY (section_id) REFERENCES section(id)
      );

      CREATE TABLE IF NOT EXISTS ticket_type (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        price DECIMAL(10,2) NOT NULL
      );

      CREATE TABLE IF NOT EXISTS ticket_inventory (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        game_id INTEGER NOT NULL,
        seat_id INTEGER NOT NULL,
        type_id INTEGER NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('Available', 'Held', 'Sold', 'Redeemed')),
        FOREIGN KEY (game_id) REFERENCES game(id),
        FOREIGN KEY (seat_id) REFERENCES seat(id),
        FOREIGN KEY (type_id) REFERENCES ticket_type(id)
      );

      CREATE TABLE IF NOT EXISTS game_ticket_sales (
        game_id INTEGER PRIMARY KEY,
        attendance_percentage REAL NOT NULL DEFAULT 0,
        locked_attendance_percentage REAL NOT NULL DEFAULT 0,
        last_updated DATE,
        FOREIGN KEY (game_id) REFERENCES game(id)
      );

      CREATE TABLE IF NOT EXISTS game_ticket_weekly_sales (
        game_id INTEGER NOT NULL,
        week_label TEXT NOT NULL,
        attendance_percentage REAL NOT NULL DEFAULT 0,
        PRIMARY KEY (game_id, week_label),
        FOREIGN KEY (game_id) REFERENCES game(id)
      );

      CREATE TABLE IF NOT EXISTS ticket_weekly_revenue (
        week_label TEXT PRIMARY KEY,
        revenue REAL NOT NULL DEFAULT 0,
        finalized_at TEXT
      );

      CREATE TABLE IF NOT EXISTS player (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        position TEXT NOT NULL,
        age INTEGER NOT NULL,
        overall INTEGER NOT NULL,
        active BOOLEAN NOT NULL DEFAULT 1
      );

      CREATE TABLE IF NOT EXISTS contract (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        player_id INTEGER NOT NULL,
        start_year INTEGER NOT NULL,
        end_year INTEGER NOT NULL,
        aav DECIMAL(12,2) NOT NULL,
        guaranteed DECIMAL(12,2) NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('Active', 'Expired', 'Buyout')),
        FOREIGN KEY (player_id) REFERENCES player(id)
      );

      CREATE TABLE IF NOT EXISTS cap_ledger (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        season INTEGER NOT NULL,
        player_id INTEGER NOT NULL,
        amount DECIMAL(12,2) NOT NULL,
        reason TEXT NOT NULL,
        FOREIGN KEY (player_id) REFERENCES player(id)
      );

      CREATE TABLE IF NOT EXISTS free_agent (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        position TEXT NOT NULL,
        expected_aav DECIMAL(12,2) NOT NULL,
        years INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS gl_account (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        type TEXT NOT NULL CHECK (type IN ('Asset', 'Liability', 'Equity', 'Revenue', 'Expense')),
        normal_balance TEXT NOT NULL CHECK (normal_balance IN ('Debit', 'Credit')),
        parent_id INTEGER,
        FOREIGN KEY (parent_id) REFERENCES gl_account(id)
      );

      CREATE TABLE IF NOT EXISTS vendor (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT
      );

      CREATE TABLE IF NOT EXISTS invoice (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        invoice_number TEXT UNIQUE NOT NULL,
        entity_type TEXT NOT NULL CHECK (entity_type IN ('Customer', 'Vendor')),
        entity_id INTEGER NOT NULL,
        invoice_date DATE NOT NULL,
        due_date DATE NOT NULL,
        total_amount DECIMAL(12,2) NOT NULL,
        status TEXT NOT NULL,
        description TEXT
      );

      CREATE TABLE IF NOT EXISTS journal_entry (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        entry_number TEXT UNIQUE NOT NULL,
        entry_date DATE NOT NULL,
        description TEXT,
        posted INTEGER NOT NULL DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS journal_line (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        journal_entry_id INTEGER NOT NULL,
        account_id INTEGER NOT NULL,
        debit DECIMAL(12,2) NOT NULL DEFAULT 0,
        credit DECIMAL(12,2) NOT NULL DEFAULT 0,
        reference_type TEXT,
        reference_id INTEGER,
        invoice_id INTEGER,
        memo TEXT,
        FOREIGN KEY (journal_entry_id) REFERENCES journal_entry(id),
        FOREIGN KEY (account_id) REFERENCES gl_account(id),
        FOREIGN KEY (invoice_id) REFERENCES invoice(id)
      );

      CREATE TABLE IF NOT EXISTS payment (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        invoice_id INTEGER NOT NULL,
        payment_date DATE NOT NULL,
        amount DECIMAL(12,2) NOT NULL,
        method TEXT,
        direction TEXT NOT NULL CHECK (direction IN ('Inflow', 'Outflow')),
        reference TEXT,
        FOREIGN KEY (invoice_id) REFERENCES invoice(id)
      );
    `);

    // Seed rows
    db.exec(`
      INSERT INTO customer (name, email) VALUES 
        ('John Smith', 'john.smith@email.com'),
        ('Sarah Johnson', 'sarah.johnson@email.com'),
        ('Mike Davis', 'mike.davis@email.com'),
        ('Lisa Wilson', 'lisa.wilson@email.com'),
        ('David Brown', 'david.brown@email.com');

      INSERT INTO item (sku, name, price, qty_on_hand, reorder_point) VALUES
        ('JERSEY-001', 'Home Jersey #23', 89.99, 45, 10),
        ('JERSEY-002', 'Away Jersey #14', 89.99, 32, 10),
        ('HOODIE-001', 'Team Hoodie', 59.99, 28, 8),
        ('CAP-001', 'Team Baseball Cap', 24.99, 67, 15),
        ('T-SHIRT-001', 'Team T-Shirt', 19.99, 4, 20);

      INSERT INTO game (opponent, date, venue) VALUES
        ('Lakers', 'Week 3', 'Home Arena'),
        ('Warriors', 'Week 3', 'Away'),
        ('Celtics', 'Week 4', 'Home Arena'),
        ('Bulls', 'Week 5', 'Away');

      INSERT INTO section (name) VALUES
        ('Lower Level'),
        ('Upper Level'),
        ('VIP Box'),
        ('Courtside');

      INSERT INTO seat (section_id, row, number) VALUES
        (1, 'A', 1), (1, 'A', 2), (1, 'A', 3), (1, 'A', 4), (1, 'A', 5),
        (1, 'B', 1), (1, 'B', 2), (1, 'B', 3), (1, 'B', 4), (1, 'B', 5),
        (2, 'AA', 1), (2, 'AA', 2), (2, 'AA', 3), (2, 'AA', 4), (2, 'AA', 5),
        (4, 'COURT', 1), (4, 'COURT', 2), (4, 'COURT', 3), (4, 'COURT', 4);

      INSERT INTO ticket_type (name, price) VALUES
        ('General Admission', 35.00),
        ('Premium', 65.00),
        ('VIP', 125.00),
        ('Courtside', 250.00);

      INSERT INTO ticket_inventory (game_id, seat_id, type_id, status) VALUES
        (1, 1, 2, 'Available'), (1, 2, 2, 'Available'), (1, 3, 2, 'Sold'),
        (1, 4, 2, 'Sold'), (1, 5, 2, 'Available'), (1, 6, 2, 'Available'),
        (1, 7, 2, 'Available'), (1, 8, 2, 'Available'), (1, 9, 2, 'Available'),
        (1, 10, 2, 'Available'), (1, 11, 1, 'Available'), (1, 12, 1, 'Available'),
        (1, 13, 1, 'Available'), (1, 14, 1, 'Available'), (1, 15, 1, 'Available'),
        (1, 16, 4, 'Sold'), (1, 17, 4, 'Sold'), (1, 18, 4, 'Available');

      INSERT INTO game_ticket_sales (game_id, attendance_percentage, locked_attendance_percentage, last_updated)
      SELECT
        g.id,
        COALESCE(
          ROUND(
            CASE WHEN COUNT(ti.id) = 0 THEN 0
              ELSE (SUM(CASE WHEN ti.status IN ('Sold', 'Redeemed') THEN 1 ELSE 0 END) * 100.0) / COUNT(ti.id)
            END,
            1
          ),
          0
        ) AS attendance_percentage,
        0 AS locked_attendance_percentage,
        'Week 1'
      FROM game g
      LEFT JOIN ticket_inventory ti ON g.id = ti.game_id
      GROUP BY g.id;

      INSERT INTO game_ticket_weekly_sales (game_id, week_label, attendance_percentage)
      SELECT
        gts.game_id,
        COALESCE(gts.last_updated, 'Week 1') AS week_label,
        gts.attendance_percentage
      FROM game_ticket_sales gts;

      INSERT INTO player (name, position, age, overall, active) VALUES
        ('James Anderson', 'Point Guard', 24, 85, 1),
        ('Marcus Johnson', 'Shooting Guard', 26, 82, 1),
        ('David Williams', 'Small Forward', 25, 88, 1),
        ('Robert Davis', 'Power Forward', 28, 84, 1),
        ('Michael Thompson', 'Center', 27, 86, 1);

      INSERT INTO contract (player_id, start_year, end_year, aav, guaranteed, status) VALUES
        (1, 2024, 2027, 2100000, 6300000, 'Active'),
        (2, 2023, 2026, 1800000, 5400000, 'Active'),
        (3, 2024, 2029, 2500000, 12500000, 'Active'),
        (4, 2022, 2025, 1900000, 5700000, 'Active'),
        (5, 2023, 2027, 2200000, 8800000, 'Active');

      INSERT INTO cap_ledger (season, player_id, amount, reason) VALUES
        (2025, 1, 2100000, 'Base Salary'),
        (2025, 2, 1800000, 'Base Salary'),
        (2025, 3, 2500000, 'Base Salary'),
        (2025, 4, 1900000, 'Base Salary'),
        (2025, 5, 2200000, 'Base Salary');

      INSERT INTO free_agent (name, position, expected_aav, years) VALUES
        ('Kevin Rodriguez', 'Shooting Guard', 1500000, 3),
        ('Tony Martinez', 'Power Forward', 1200000, 2),
        ('Alex Turner', 'Point Guard', 1800000, 4);

      INSERT INTO vendor (name, email) VALUES
        ('Arena Operations Co.', 'ops@arena-co.com'),
        ('City Apparel Supply', 'sales@cityapparel.com');

      INSERT INTO gl_account (code, name, type, normal_balance) VALUES
        ('1000', 'Operating Cash', 'Asset', 'Debit'),
        ('1100', 'Accounts Receivable', 'Asset', 'Debit'),
        ('1200', 'Merchandise Inventory', 'Asset', 'Debit'),
        ('2000', 'Accounts Payable', 'Liability', 'Credit'),
        ('3000', 'Owner''s Equity', 'Equity', 'Credit'),
        ('4000', 'Ticket Sales Revenue', 'Revenue', 'Credit'),
        ('4010', 'Merchandise Revenue', 'Revenue', 'Credit'),
        ('5000', 'Merchandise COGS', 'Expense', 'Debit'),
        ('5200', 'Arena Operations Expense', 'Expense', 'Debit');

      INSERT INTO invoice (invoice_number, entity_type, entity_id, invoice_date, due_date, total_amount, status, description) VALUES
        ('INV-1001', 'Customer', 1, 'Week 1', 'Week 1', 109.98, 'Paid', 'Merchandise order JERSEY-001/002'),
        ('INV-1002', 'Customer', 2, 'Week 2', 'Week 2', 130.00, 'Paid', 'Ticket order for Lakers game'),
        ('INV-1003', 'Customer', 3, 'Week 3', 'Week 4', 2500.00, 'Partially Paid', 'Corporate suite package'),
        ('BILL-2001', 'Vendor', 1, 'Week 2', 'Week 3', 7800.00, 'Open', 'Arena staffing and security services'),
        ('BILL-2002', 'Vendor', 2, 'Week 1', 'Week 5', 5200.00, 'Partially Paid', 'Merchandise restock PO-334');

      INSERT INTO payment (invoice_id, payment_date, amount, method, direction, reference) VALUES
        (1, 'Week 1', 109.98, 'Card', 'Inflow', 'Point-of-sale capture'),
        (2, 'Week 2', 130.00, 'Cash', 'Inflow', 'Box office sale'),
        (3, 'Week 3', 1000.00, 'ACH', 'Inflow', 'Corporate deposit'),
        (5, 'Week 4', 1200.00, 'ACH', 'Outflow', 'Partial vendor payment');

      INSERT INTO journal_entry (entry_number, entry_date, description, posted) VALUES
        ('JE-0001', 'Week 1', 'Opening equity funding', 1),
        ('JE-0002', 'Week 2', 'Merchandise restock PO-334', 1),
        ('JE-0003', 'Week 1', 'Merchandise sale SO-1', 1),
        ('JE-0004', 'Week 1', 'Merchandise COGS recognition SO-1', 1),
        ('JE-0005', 'Week 2', 'Ticket order revenue TO-1', 1),
        ('JE-0006', 'Week 3', 'Corporate suite invoice INV-1003', 1),
        ('JE-0007', 'Week 3', 'Arena staffing invoice BILL-2001', 1),
        ('JE-0008', 'Week 3', 'Corporate suite deposit INV-1003', 1),
        ('JE-0009', 'Week 4', 'Partial payment on BILL-2002', 1);

      INSERT INTO journal_line (journal_entry_id, account_id, debit, credit, reference_type, reference_id, invoice_id, memo) VALUES
        (1, 1, 75000.00, 0, NULL, NULL, NULL, 'Seed cash position'),
        (1, 5, 0, 75000.00, NULL, NULL, NULL, 'Owner contribution'),

        (2, 3, 5200.00, 0, 'invoice', 5, 5, 'Merch restock from City Apparel'),
        (2, 4, 0, 5200.00, 'invoice', 5, 5, 'Accounts payable for PO-334'),

        (3, 1, 109.98, 0, 'sales_order', 1, 1, 'Cash sale from sales order #1'),
        (3, 7, 0, 109.98, 'sales_order', 1, 1, 'Recognize merchandise revenue'),

        (4, 9, 44.00, 0, 'sales_order', 1, 1, 'COGS on merchandise sale'),
        (4, 3, 0, 44.00, 'sales_order', 1, 1, 'Reduce inventory for sale'),

        (5, 1, 130.00, 0, 'ticket_order', 1, 2, 'Cash received for ticket order'),
        (5, 6, 0, 130.00, 'ticket_order', 1, 2, 'Recognize ticket revenue'),

        (6, 2, 2500.00, 0, 'invoice', 3, 3, 'Corporate suite billed to customer'),
        (6, 6, 0, 2500.00, 'invoice', 3, 3, 'Suite revenue accrual'),

        (7, 9, 7800.00, 0, 'invoice', 4, 4, 'Arena staffing expense'),
        (7, 4, 0, 7800.00, 'invoice', 4, 4, 'Liability to Arena Operations Co.'),

        (8, 1, 1000.00, 0, 'payment', 3, 3, 'Corporate suite deposit received'),
        (8, 2, 0, 1000.00, 'payment', 3, 3, 'Apply payment against receivable'),

        (9, 4, 1200.00, 0, 'payment', 5, 5, 'Reduce AP from vendor payment'),
        (9, 1, 0, 1200.00, 'payment', 5, 5, 'Cash disbursement to City Apparel');

      INSERT INTO sales_order (customer_id, status, total) VALUES (1, 'Approved', 109.98);
      INSERT INTO ticket_order (customer_id, game_id, total, status) VALUES (2, 1, 130.00, 'Confirmed');

    `);

    seedMerchandiseModule(db);
    setDatabaseVersion(db, LATEST_DB_VERSION);

    console.log("Database seeded successfully");
  } catch (error) {
    console.error("Failed to seed database:", error);
    throw error;
  }
}