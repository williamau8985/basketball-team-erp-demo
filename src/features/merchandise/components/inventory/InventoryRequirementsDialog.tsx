import { Loader2, Settings2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Slider } from "@/components/ui/slider";

import type { MerchandiseItem } from "@/types/erp";

interface InventoryRequirementsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prioritizedItems: MerchandiseItem[];
  minimumLevels: Record<number, number>;
  onMinimumLevelChange: (item: MerchandiseItem, values: number[]) => void;
  onSave: () => Promise<void> | void;
  isSaving: boolean;
  getSliderMinimum: (item: MerchandiseItem) => number;
  clampMinimumLevel: (value: number, item: MerchandiseItem) => number;
  getAvailableUnits: (item: MerchandiseItem) => number;
  backorderUnitsByItem: Map<number, number>;
}

export function InventoryRequirementsDialog({
  open,
  onOpenChange,
  prioritizedItems,
  minimumLevels,
  onMinimumLevelChange,
  onSave,
  isSaving,
  getSliderMinimum,
  clampMinimumLevel,
  getAvailableUnits,
  backorderUnitsByItem,
}: InventoryRequirementsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5" />
            Inventory Requirements
          </DialogTitle>
          <DialogDescription>
            Adjust minimum inventory thresholds for each SKU to stay ahead of merchandising
            demand.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[500px] pr-4">
          <div className="space-y-6">
            {prioritizedItems.map(item => {
              const sliderMin = getSliderMinimum(item);
              const target = clampMinimumLevel(
                minimumLevels[item.id] ?? item.minInventoryLevel,
                item,
              );
              const available = getAvailableUnits(item);
              const backorders = backorderUnitsByItem.get(item.id) ?? 0;

              return (
                <div
                  key={item.id}
                  className="space-y-4 rounded-lg border border-gray-200 p-4"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <div>
                      <h3 className="font-medium text-gray-900">{item.name}</h3>
                      <div className="mt-1 flex items-center gap-2">
                        <span className="rounded bg-gray-100 px-2 py-1 text-xs font-mono text-gray-600">
                          {item.sku}
                        </span>
                        {backorders > 0 && (
                          <span className="rounded bg-red-100 px-2 py-1 text-xs font-medium text-red-600">
                            {backorders} backordered
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right text-xs text-gray-500">
                      <div>Available: {available} units</div>
                      <div>Reorder level: {item.reorderLevel}</div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Slider
                      value={[target]}
                      min={sliderMin}
                      max={300}
                      step={5}
                      onValueChange={values => onMinimumLevelChange(item, values)}
                      className="w-full"
                    />
                    <div className="flex items-center justify-between text-xs text-gray-600">
                      <span>
                        Target minimum:{" "}
                        <span className="font-semibold text-gray-900">{target}</span> units
                      </span>
                      <span>Range: {sliderMin} - 300</span>
                    </div>
                  </div>
                </div>
              );
            })}
            {prioritizedItems.length === 0 && (
              <div className="py-8 text-center">
                <Settings2 className="mx-auto mb-3 h-12 w-12 text-gray-300" />
                <p className="text-gray-500">No merchandise items configured</p>
              </div>
            )}
          </div>
        </ScrollArea>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={() => void onSave()} disabled={isSaving}>
            {isSaving ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving Changes
              </span>
            ) : (
              "Save Requirements"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
