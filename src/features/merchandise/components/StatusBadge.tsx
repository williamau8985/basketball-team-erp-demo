import { Badge } from "@/components/ui/badge";

export type StatusBadgeVariant = "default" | "secondary" | "destructive" | "outline";

interface StatusBadgeProps {
  label: string;
  variant: StatusBadgeVariant;
}

export function StatusBadge({ label, variant }: StatusBadgeProps) {
  return <Badge variant={variant}>{label}</Badge>;
}
