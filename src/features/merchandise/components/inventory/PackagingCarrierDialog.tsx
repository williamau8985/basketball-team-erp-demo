import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

interface PackagingCarrierDialogProps {
  open: boolean;
  orderCode?: string;
  storeName?: string;
  carriers: readonly string[];
  selectedCarrier: string;
  onCarrierChange: (carrier: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
  isSubmitting: boolean;
}

export function PackagingCarrierDialog({
  open,
  orderCode,
  storeName,
  carriers,
  selectedCarrier,
  onCarrierChange,
  onConfirm,
  onCancel,
  isSubmitting,
}: PackagingCarrierDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={next => {
        if (!next && !isSubmitting) {
          onCancel();
        }
      }}
    >
      <DialogContent showCloseButton={!isSubmitting} onCloseAutoFocus={event => event.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Assign shipping carrier</DialogTitle>
          <DialogDescription>
            {orderCode ? `Select a carrier for ${orderCode}${storeName ? ` · ${storeName}` : ""}.` : "Select a carrier to finalize the shipment."}
          </DialogDescription>
        </DialogHeader>

        <RadioGroup
          value={selectedCarrier}
          onValueChange={value => onCarrierChange(value)}
          className="mt-4 gap-2"
        >
          {carriers.map(carrier => (
            <Label
              key={carrier}
              className={`flex cursor-pointer items-center justify-between rounded-md border border-gray-200 bg-white px-4 py-3 text-sm transition hover:border-purple-400 hover:shadow-sm ${
                selectedCarrier === carrier ? "border-purple-500 ring-2 ring-purple-200" : ""
              }`}
            >
              <div className="flex flex-col">
                <span className="font-medium text-gray-900">{carrier}</span>
                <span className="text-xs text-gray-500">Trusted partner delivery</span>
              </div>
              <RadioGroupItem value={carrier} className="ml-3" />
            </Label>
          ))}
        </RadioGroup>

        <DialogFooter className="mt-6">
          <Button variant="outline" onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={onConfirm} disabled={isSubmitting}>
            {isSubmitting ? "Assigning..." : "Assign carrier"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
