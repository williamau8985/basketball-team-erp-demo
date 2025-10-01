import {
  type FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { Plus, Check, ChevronsUpDown, X, Info, Calculator } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useTimeline } from "@/hooks/useTimeline";

import type { MerchandiseItem, MerchandiseStore } from "@/types/erp";

import { addWeeksToLabel } from "../utils";
import { type CreateOrderFormValues, type StockExceptionLine } from "../types";
import { StockExceptionDialog } from "./StockExceptionDialog";

interface CreateSalesOrderDialogProps {
  open: boolean;
  stores: MerchandiseStore[];
  items: MerchandiseItem[];
  onClose: () => void;
  onSubmit: (values: CreateOrderFormValues) => Promise<void>;
  isSubmitting: boolean;
}

interface StockExceptionState {
  shortages: StockExceptionLine[];
}

export function CreateSalesOrderDialog({
  open,
  stores,
  items,
  onClose,
  onSubmit,
  isSubmitting,
}: CreateSalesOrderDialogProps) {
  const { currentWeekLabel } = useTimeline();

  const initialState = useMemo<CreateOrderFormValues>(
    () => ({
      storeId: stores[0]?.id ?? 0,
      orderDate: currentWeekLabel,
      status: "Successful - Inventory Reserved",
      workflowStage: "Awaiting Warehouse Approval",
      notes: "",
      lines:
        items.length > 0
          ? [
              {
                itemId: items[0].id,
                quantity: 5,
                unitPrice: items[0].sellPrice,
              },
            ]
          : [],
      createInvoice: true,
      invoiceDueDate: addWeeksToLabel(currentWeekLabel, 2),
    }),
    [items, stores, currentWeekLabel]
  );

  const dueWeekOptions = useMemo(
    () => Array.from({ length: 4 }, (_, index) => addWeeksToLabel(currentWeekLabel, index + 1)),
    [currentWeekLabel]
  );

  const [formState, setFormState] = useState<CreateOrderFormValues>(initialState);
  const [stockException, setStockException] = useState<StockExceptionState | null>(null);
  const [openStoreCombobox, setOpenStoreCombobox] = useState(false);
  const [openItemComboboxes, setOpenItemComboboxes] = useState<Record<number, boolean>>({});
  const initializedRef = useRef(false);

  useEffect(() => {
    if (!open) {
      initializedRef.current = false;
      return;
    }
    if (initializedRef.current) return;
    setFormState(initialState);
    setStockException(null);
    setOpenStoreCombobox(false);
    setOpenItemComboboxes({});
    initializedRef.current = true;
  }, [open, initialState]);

  if (!open) return null;

  const totalAmount = formState.lines.reduce(
    (sum, line) => sum + line.quantity * line.unitPrice,
    0
  );
  const totalUnits = formState.lines.reduce((sum, line) => sum + line.quantity, 0);
  const hasQtyIssue = formState.lines.some(line => line.quantity < 5);
  const missingConfiguration = stores.length === 0 || items.length === 0;
  const disableSubmit =
    isSubmitting ||
    missingConfiguration ||
    !formState.storeId ||
    formState.lines.length === 0 ||
    hasQtyIssue;

  const getAvailableForItem = (itemId: number) => {
    const item = items.find(entry => entry.id === itemId);
    if (!item) return 0;
    return Math.max(item.currentStock - item.allocatedStock - item.packagingStock, 0);
  };

  const canPartialFulfill = stockException
    ? stockException.shortages.every(shortage => shortage.available >= 5)
    : false;

  const submitOrder = async (
    options?: {
      statusOverride?: CreateOrderFormValues["status"];
      skipStockValidation?: boolean;
    }
  ) => {
    const submission: CreateOrderFormValues = {
      ...formState,
      status: options?.statusOverride ?? formState.status,
    };

    const shouldValidateStock =
      !options?.skipStockValidation &&
      submission.status === "Successful - Inventory Reserved";

    if (shouldValidateStock) {
      const shortages: StockExceptionLine[] = submission.lines.flatMap(line => {
        const item = items.find(entry => entry.id === line.itemId);
        if (!item) return [];
        const available = getAvailableForItem(line.itemId);
        if (line.quantity <= available) {
          return [];
        }

        return [
          {
            itemId: line.itemId,
            itemName: item.name,
            sku: item.sku,
            requested: line.quantity,
            available,
          },
        ];
      });

      if (shortages.length > 0) {
        setStockException({ shortages });
        return;
      }
    }

    await onSubmit(submission);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await submitOrder();
  };

  const handleStoreChange = (storeId: number) => {
    setFormState(prev => ({
      ...prev,
      storeId,
    }));
    setOpenStoreCombobox(false);
  };

  const handleNotesChange = (value: string) => {
    setFormState(prev => ({ ...prev, notes: value }));
  };

  const handleLineItemChange = (index: number, itemId: number) => {
    const item = items.find(entry => entry.id === itemId);
    setFormState(prev => ({
      ...prev,
      lines: prev.lines.map((line, lineIndex) =>
        lineIndex === index
          ? {
              ...line,
              itemId,
              unitPrice: item?.sellPrice ?? line.unitPrice,
            }
          : line
      ),
    }));
    setOpenItemComboboxes(prev => ({ ...prev, [index]: false }));
  };

  const handleLineQuantityChange = (index: number, value: number) => {
    setFormState(prev => ({
      ...prev,
      lines: prev.lines.map((line, lineIndex) =>
        lineIndex === index
          ? {
              ...line,
              quantity: Number.isNaN(value) ? 0 : value,
            }
          : line
      ),
    }));
  };

  const handleAddLine = () => {
    if (!items.length) return;
    setFormState(prev => ({
      ...prev,
      lines: [
        ...prev.lines,
        {
          itemId: items[0].id,
          quantity: 5,
          unitPrice: items[0].sellPrice,
        },
      ],
    }));
  };

  const handleRemoveLine = (index: number) => {
    setFormState(prev => ({
      ...prev,
      lines: prev.lines.filter((_, lineIndex) => lineIndex !== index),
    }));
  };

  const handleInvoiceToggle = (checked: boolean) => {
    setFormState(prev => ({
      ...prev,
      createInvoice: checked,
      invoiceDueDate: checked
        ? prev.invoiceDueDate || addWeeksToLabel(prev.orderDate, 2)
        : prev.invoiceDueDate,
    }));
  };

  const handleInvoiceDueChange = (value: string) => {
    setFormState(prev => ({ ...prev, invoiceDueDate: value }));
  };

  const handlePartialFulfillment = async () => {
    if (!stockException) return;
    const adjustedLines = formState.lines.map(line => {
      const shortage = stockException.shortages.find(entry => entry.itemId === line.itemId);
      if (!shortage) return line;
      return {
        ...line,
        quantity: shortage.available,
      };
    });

    await onSubmit({
      ...formState,
      lines: adjustedLines,
    });

    setStockException(null);
  };

  const handleBackorderFromException = async () => {
    await submitOrder({ statusOverride: "Backorder", skipStockValidation: true });
    setStockException(null);
  };

  const selectedStore = stores.find(store => store.id === formState.storeId);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Create Sales Order
          </DialogTitle>
          <DialogDescription>
            Convert retail demand into allocations and optional invoicing.
          </DialogDescription>
        </DialogHeader>

        {missingConfiguration && (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700 flex items-center gap-2">
            <Info className="h-4 w-4 flex-shrink-0" />
            Configure at least one retail partner and merchandise item before creating an order.
          </div>
        )}

        <form id="sales-order-form" onSubmit={handleSubmit} className="flex-1 overflow-hidden">
          <div className="grid lg:grid-cols-3 gap-6 h-full">
            {/* Left Column - Order Details */}
            <div className="lg:col-span-2 space-y-4">
              {/* Store and Date Row */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Retail Partner</Label>
                  <Popover open={openStoreCombobox} onOpenChange={setOpenStoreCombobox}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={openStoreCombobox}
                        className="w-full justify-between"
                      >
                        {selectedStore
                          ? `${selectedStore.name} • Tier ${selectedStore.tier}`
                          : "Select store..."}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-full p-0">
                      <Command>
                        <CommandInput placeholder="Search stores..." />
                        <CommandList>
                          <CommandEmpty>No store found.</CommandEmpty>
                          <CommandGroup>
                            {stores.map((store) => (
                              <CommandItem
                                key={store.id}
                                value={`${store.name} ${store.tier}`}
                                onSelect={() => handleStoreChange(store.id)}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    formState.storeId === store.id ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                {store.name} • Tier {store.tier}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium">Order Week</Label>
                  <div className="h-10 px-3 flex items-center rounded-md border border-gray-200 bg-gray-50 text-sm font-semibold text-gray-700">
                    {formState.orderDate}
                  </div>
                  <p className="text-xs text-gray-500">Orders are logged in the active simulation week.</p>
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Internal Notes</Label>
                <Textarea
                  value={formState.notes ?? ""}
                  onChange={event => handleNotesChange(event.target.value)}
                  rows={2}
                  placeholder="Special packaging, rush handling, or merchandising notes"
                  className="resize-none"
                />
              </div>

              {/* Line Items */}
              <div className="space-y-3 flex-1">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">Line Items</Label>
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm" 
                    onClick={handleAddLine} 
                    disabled={!items.length}
                    className="flex items-center gap-1"
                  >
                    <Plus className="h-3 w-3" />
                    Add Line
                  </Button>
                </div>

                {hasQtyIssue && (
                  <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded p-2 flex items-center gap-2">
                    <Info className="h-3 w-3 flex-shrink-0" />
                    Each line must include at least 5 units to satisfy MOQ requirement.
                  </div>
                )}

                <ScrollArea className="h-[300px] pr-2">
                  <div className="space-y-3">
                    {formState.lines.map((line, index) => {
                      const item = items.find(entry => entry.id === line.itemId);
                      const available = getAvailableForItem(line.itemId);
                      const isItemComboboxOpen = openItemComboboxes[index] || false;
                      const lineTotal = line.quantity * line.unitPrice;
                      
                      return (
                        <div key={`${line.itemId}-${index}`} className="border border-gray-200 rounded-lg p-3 space-y-3">
                          {/* Item Selection */}
                          <div className="flex items-end gap-2">
                            <div className="flex-1 space-y-1">
                              <Label className="text-xs font-medium text-gray-600">Item</Label>
                              <Popover 
                                open={isItemComboboxOpen} 
                                onOpenChange={(open) => 
                                  setOpenItemComboboxes(prev => ({ ...prev, [index]: open }))
                                }
                              >
                                <PopoverTrigger asChild>
                                  <Button
                                    variant="outline"
                                    role="combobox"
                                    aria-expanded={isItemComboboxOpen}
                                    className="w-full justify-between h-9 text-sm"
                                  >
                                    {item
                                      ? `${item.name} (${item.sku})`
                                      : "Select item..."}
                                    <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-full p-0">
                                  <Command>
                                    <CommandInput placeholder="Search items..." />
                                    <CommandList>
                                      <CommandEmpty>No item found.</CommandEmpty>
                                      <CommandGroup>
                                        {items.map((itemOption) => (
                                          <CommandItem
                                            key={itemOption.id}
                                            value={`${itemOption.name} ${itemOption.sku}`}
                                            onSelect={() => handleLineItemChange(index, itemOption.id)}
                                          >
                                            <Check
                                              className={cn(
                                                "mr-2 h-4 w-4",
                                                line.itemId === itemOption.id ? "opacity-100" : "opacity-0"
                                              )}
                                            />
                                            {itemOption.name} ({itemOption.sku})
                                          </CommandItem>
                                        ))}
                                      </CommandGroup>
                                    </CommandList>
                                  </Command>
                                </PopoverContent>
                              </Popover>
                            </div>

                            {formState.lines.length > 1 && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRemoveLine(index)}
                                className="h-9 w-9 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            )}
                          </div>

                          {/* Quantity, Price, and Total */}
                          <div className="grid grid-cols-3 gap-3 text-sm">
                            <div className="space-y-1">
                              <Label className="text-xs font-medium text-gray-600">Quantity</Label>
                              <Input
                                type="number"
                                min={5}
                                value={line.quantity}
                                onChange={event =>
                                  handleLineQuantityChange(index, Number.parseInt(event.target.value, 10))
                                }
                                className="h-8 text-center"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs font-medium text-gray-600">Unit Price</Label>
                              <div className="h-8 px-3 py-1 bg-gray-50 border border-gray-200 rounded-md flex items-center text-sm font-medium">
                                ${item?.sellPrice.toFixed(2) || "0.00"}
                              </div>
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs font-medium text-gray-600">Line Total</Label>
                              <div className="h-8 px-3 py-1 bg-blue-50 border border-blue-200 rounded-md flex items-center text-sm font-semibold text-blue-700">
                                ${lineTotal.toFixed(2)}
                              </div>
                            </div>
                          </div>

                          {/* Availability Info */}
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-gray-500">Available: {available} units</span>
                            {line.quantity > available && (
                              <Badge variant="destructive" className="text-xs">
                                Insufficient Stock
                              </Badge>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              </div>
            </div>

            {/* Right Column - Summary & Invoice */}
            <div className="space-y-4">
              {/* Order Summary */}
              <div className="rounded-lg border border-gray-200 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Calculator className="h-4 w-4 text-gray-600" />
                  <Label className="text-sm font-semibold text-gray-900">Order Summary</Label>
                </div>
                <Separator />
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Total Units:</span>
                    <span className="font-medium">{totalUnits}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Line Items:</span>
                    <span className="font-medium">{formState.lines.length}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between text-base">
                    <span className="font-medium text-gray-900">Total Amount:</span>
                    <span className="font-bold text-green-600">${totalAmount.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* Invoice Settings */}
              <div className="rounded-lg border border-gray-200 p-4 space-y-3">
                <Label className="text-sm font-semibold text-gray-900">Invoice Settings</Label>
                <Separator />
                
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-sm font-medium">Auto-create Invoice</Label>
                    <p className="text-xs text-gray-500">Generate invoice upon order confirmation</p>
                  </div>
                  <Switch
                    checked={formState.createInvoice}
                    onCheckedChange={handleInvoiceToggle}
                  />
                </div>

                {formState.createInvoice && (
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Invoice Due Date</Label>
                    <select
                      value={formState.invoiceDueDate}
                      onChange={event => handleInvoiceDueChange(event.target.value)}
                      className="h-9 w-full rounded-md border border-gray-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {dueWeekOptions.map(option => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Store Info */}
              {selectedStore && (
                <div className="rounded-lg border border-gray-200 p-4 space-y-2">
                  <Label className="text-sm font-semibold text-gray-900">Store Details</Label>
                  <Separator />
                  <div className="space-y-1 text-sm">
                    <div>
                      <span className="font-medium">{selectedStore.name}</span>
                      <Badge variant="secondary" className="ml-2 text-xs">
                        Tier {selectedStore.tier}
                      </Badge>
                    </div>
                    <p className="text-gray-600">{selectedStore.contactName}</p>
                    <p className="text-gray-500 text-xs">{selectedStore.contactEmail}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </form>

        <DialogFooter className="flex-shrink-0">
          <Button 
            type="button" 
            variant="outline" 
            onClick={onClose} 
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button 
            type="submit" 
            disabled={disableSubmit}
            form="sales-order-form"
            className="min-w-[120px]"
          >
            {isSubmitting ? "Creating..." : "Create Order"}
          </Button>
        </DialogFooter>
      </DialogContent>

      {stockException && (
        <StockExceptionDialog
          shortages={stockException.shortages}
          onCancel={() => setStockException(null)}
          onPartial={handlePartialFulfillment}
          onBackorder={handleBackorderFromException}
          canPartial={canPartialFulfill}
        />
      )}
    </Dialog>
  );
}