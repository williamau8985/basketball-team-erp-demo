import type {
  MerchandiseSalesOrderStatus,
  MerchandiseWorkflowStage,
  NewMerchSalesOrderLine,
} from "@/types/erp";

export interface CreateOrderFormValues {
  storeId: number;
  orderDate: string;
  status: MerchandiseSalesOrderStatus;
  workflowStage: MerchandiseWorkflowStage;
  notes?: string;
  lines: NewMerchSalesOrderLine[];
  createInvoice: boolean;
  invoiceDueDate: string;
}

export interface StockExceptionLine {
  itemId: number;
  itemName: string;
  sku: string;
  requested: number;
  available: number;
}
