import { Card, CardContent } from "@/components/ui/card";
export default function StatCard({ label, value, RightIcon, valueClass = "" }: {
  label: string; value: string | number; RightIcon?: any; valueClass?: string;
}) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600">{label}</p>
            <p className={`text-3xl font-bold text-gray-900 ${valueClass}`}>{value}</p>
          </div>
          {RightIcon ? <RightIcon className="w-8 h-8" /> : null}
        </div>
      </CardContent>
    </Card>
  );
}
