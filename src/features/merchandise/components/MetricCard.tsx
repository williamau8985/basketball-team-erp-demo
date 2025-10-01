import type { ReactNode } from "react";

import { Card, CardContent } from "@/components/ui/card";

interface MetricCardProps {
  title: string;
  value: string;
  subText: string;
  icon: ReactNode;
}

export function MetricCard({ title, value, subText, icon }: MetricCardProps) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between p-6">
        <div>
          <p className="text-sm text-gray-600">{title}</p>
          <p className="text-3xl font-bold text-gray-900">{value}</p>
          <p className="text-xs text-gray-500">{subText}</p>
        </div>
        <div className="rounded-full bg-gray-100 p-3">{icon}</div>
      </CardContent>
    </Card>
  );
}
