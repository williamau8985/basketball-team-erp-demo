// src/types/erp.ts
export type NavSection =
  | "dashboard"
  | "merchandise"
  | "ticketing"
  | "roster"
  | "accounting";
export type SqlRow = Record<string, unknown>;

export interface DashboardData {
  revenue: {
    merchandise: { total_revenue: number; order_count: number };
    tickets: { total_revenue: number; order_count: number };
  };
  players: Array<{ name: string; position: string; active: boolean; aav: number }>;
  games: Array<{ date: string; opponent: string; venue: string }>;
}

export interface MerchandiseData {
  stores: MerchandiseStore[];
  items: MerchandiseItem[];
  orders: MerchandiseSalesOrder[];
  orderLines: MerchandiseSalesOrderLine[];
  procurementOrders: MerchandiseProcurementOrder[];
  procurementRequests: MerchandiseProcurementRequest[];
  shipments: MerchandiseShipment[];
  invoices: MerchandiseInvoice[];
}

export interface MerchandiseStore {
  id: number;
  name: string;
  tier: string;
  contactName: string;
  contactEmail: string;
}

export interface MerchandiseItem {
  id: number;
  name: string;
  sku: string;
  costPrice: number;
  sellPrice: number;
  currentStock: number;
  reorderLevel: number;
  minInventoryLevel: number;
  allocatedStock: number;
  packagingStock: number;
  incomingStock: number;
}

export type MerchandiseSalesOrderStatus =
  | "Successful - Inventory Reserved"
  | "Backorder"
  | "Cancelled";

export type MerchandiseWorkflowStage =
  | "Awaiting Warehouse Approval"
  | "Packaging"
  | "Shipped"
  | "Delivered";

export interface MerchandiseSalesOrder {
  id: number;
  orderCode: string;
  storeId: number;
  storeName: string;
  storeTier: string;
  status: MerchandiseSalesOrderStatus;
  workflowStage: MerchandiseWorkflowStage;
  orderDate: string;
  totalAmount: number;
  notes: string;
}

export interface MerchandiseSalesOrderLine {
  id: number;
  orderId: number;
  orderCode: string;
  itemId: number;
  itemName: string;
  itemSku: string;
  quantity: number;
  unitPrice: number;
}

export type MerchandiseProcurementStatus = "Open" | "Closed";

export interface MerchandiseProcurementOrder {
  id: number;
  poCode: string;
  itemId: number;
  itemName: string;
  itemSku: string;
  qtyOrdered: number;
  unitCost: number;
  leadTimeWeeks: number;
  status: MerchandiseProcurementStatus;
  orderDate: string;
  expectedReceipt: string | null;
}

export interface MerchandiseProcurementRequest {
  id: number;
  itemId: number;
  itemName: string;
  itemSku: string;
  quantityRequested: number;
  minimumGap: number;
  backorderUnits: number;
  requestedAt: string;
  note: string | null;
}

export interface MerchandiseShipment {
  id: number;
  shipmentCode: string;
  orderId: number;
  orderCode: string;
  storeId: number;
  storeName: string;
  carrier: string;
  trackingNumber: string;
  status: string;
  expectedDelivery: string | null;
  actualDelivery: string | null;
}

export interface MerchandiseInvoice {
  id: number;
  invoiceCode: string;
  orderId: number;
  storeId: number;
  storeName: string;
  amount: number;
  issuedDate: string;
  dueDate: string;
  status: string;
}

export interface NewMerchSalesOrderLine {
  itemId: number;
  quantity: number;
  unitPrice: number;
}

export interface NewMerchSalesOrder {
  storeId: number;
  status: MerchandiseSalesOrderStatus;
  workflowStage: MerchandiseWorkflowStage;
  orderDate: string;
  notes?: string;
  lines: NewMerchSalesOrderLine[];
}

export interface NewMerchInvoice {
  orderId: number;
  storeId: number;
  amount: number;
  issuedDate: string;
  dueDate: string;
  status: string;
}

export interface TicketingData {
  games: Array<{ id: number; date: string; opponent: string; venue: string }>;
  orders: Array<{ customer_name: string; opponent: string; game_date: string; status: string; total: number }>;
}

export interface RosterData {
  players: Array<{ name: string; position: string; age: number; active: boolean; aav: number; start_year: number; end_year: number }>;
  freeAgents: Array<{ name: string; position: string; expected_aav: number; years: number }>;
  capLedger: Array<{ amount: number }>;
}

export interface AccountingLedgerRow {
  code: string;
  name: string;
  type: string;
  balance: number;
}

export interface AccountingAgingSummary {
  entityType: "Customer" | "Vendor";
  current: number;
  bucket30: number;
  bucket60: number;
  bucket90: number;
  bucket120: number;
}
